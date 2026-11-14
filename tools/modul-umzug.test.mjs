/** Tests für tools/modul-umzug.mjs `abschnitt`: die zwei stillen Fehlverschiebungen vom 12.11.2026 brechen jetzt ab, ein ganzer Abschnitt geht durch. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WERKZEUG = fileURLToPath(new URL('./modul-umzug.mjs', import.meta.url))
const QUELLE = [
  "const log = (s: string) => console.log(s)", // 1
  'export function f(xs: number[]) {', // 2
  '  let n = 0', // 3
  '  for (const x of xs) n += x', // 4
  '  if (n)', // 5
  '    log(`${n}`)', // 6
  '  {', // 7
  '    const m = xs.length', // 8
  '    log(`${m}`)', // 9
  '  }', // 10
  '}', // 11
  '',
].join('\n')

const fehler = []
function fall(name, von, bis, zielName, erwartet) {
  const ordner = mkdtempSync(join(tmpdir(), 'modul-umzug-'))
  try {
    const quelle = join(ordner, 'a.ts')
    writeFileSync(quelle, QUELLE)
    const ziel = zielName === 'a.ts' ? quelle : join(ordner, zielName)
    const lauf = spawnSync(process.execPath, [WERKZEUG, 'abschnitt', quelle, String(von), String(bis), ziel, 'g'], { encoding: 'utf8', timeout: 60000 })
    const unveraendert = readFileSync(quelle, 'utf8') === QUELLE
    const ok = erwartet === 'ok'
      ? lauf.status === 0 && !unveraendert && /export function g\(/.test(readFileSync(ziel, 'utf8'))
      : lauf.status !== 0 && unveraendert && lauf.stderr.includes(erwartet)
    if (ok) return console.log(`  ✓ ${name}`)
    fehler.push(name)
    console.error(`  ✗ ${name} — Exit ${lauf.status}, Quelle unverändert: ${unveraendert}\n${lauf.stderr}`)
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

fall('Bereich endet auf `if (n)`, Rumpf in der Folgezeile: Abbruch', 3, 5, 'b.ts', 'schneiden die Anweisung in Zeile 5–6')
fall('Bereich endet vor der schließenden Klammer eines Blocks: Abbruch', 7, 9, 'b.ts', 'schneiden die Anweisung in Zeile 7–10')
fall('Ziel ist die Quelle: Abbruch', 7, 10, 'a.ts', 'Ziel ist die Quelldatei')
fall('ganze Anweisungen in eine neue Datei: verschoben', 7, 10, 'b.ts', 'ok')


// ---- Importe, Alias, Kommentare, Konstanten (14.11.2026) ----
const SHARED = 'export interface TA { n: number }\nexport const fa = (x: number) => x\nexport const fb = () => 1\n'
const HILFE = "import type { TA } from '../../shared/x.ts'\nexport const ha = () => 2\nexport const holeTa = (): TA => ({ n: 1 })\n"
const WEB = [
  "import { fa, fb, type TA } from '../../shared/x.ts'", // relativ geschrieben: im Ziel wird es der Alias
  "import { ha } from './h.ts'",
  '',
  '// Kopf der Konstante',
  'const LIMIT = 5',
  '',
  '/** Doku von eins */',
  '// Zusatz',
  'export function eins(x: TA) { return fa(x) + LIMIT }',
  '',
  '// Abschnittskommentar, bleibt (Leerzeile darunter)',
  '',
  'export function zwei() { return fb() + ha() } // Zeilenkommentar zwei',
  '',
  '/** Doku drei, bleibt */',
  'export function drei() { return fa(1) }',
  '',
  'export function nutzt() { return eins(1) + zwei() + drei() }',
  '',
].join('\n')

function baum(dateien) {
  const wurzel = mkdtempSync(join(tmpdir(), 'modul-umzug-'))
  const schreibe = (pfad, inhalt) => {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
    writeFileSync(join(wurzel, pfad), inhalt)
  }
  const basis = { module: 'esnext', moduleResolution: 'bundler', allowImportingTsExtensions: true, jsx: 'react-jsx', strict: true, noEmit: true }
  schreibe('tsconfig.json', JSON.stringify({ compilerOptions: { ...basis, paths: { '@shared/*': ['shared/*'] } } }))
  schreibe('worker/tsconfig.json', JSON.stringify({ compilerOptions: basis }))
  for (const [pfad, inhalt] of Object.entries(dateien)) schreibe(pfad, inhalt)
  return wurzel
}

function umzug(wurzel, ...args) {
  const lauf = spawnSync(process.execPath, [WERKZEUG, ...args], { encoding: 'utf8', timeout: 60000, cwd: wurzel })
  if (lauf.status !== 0) throw new Error(`Exit ${lauf.status}\n${lauf.stderr}`)
  return lauf
}

const lies = (wurzel, pfad) => readFileSync(join(wurzel, pfad), 'utf8')
const zaehle = (text, muster) => (text.match(muster) ?? []).length
const NAMEN = (w, quelle, ziel, namen) => umzug(w, 'namen', join(w, quelle), join(w, ziel), namen)

function pruefe(name, aufgabe) {
  const dateien = {
    'shared/x.ts': SHARED,
    'web/src/h.ts': HILFE,
    'web/src/a.tsx': WEB,
    'worker/src/w.ts': WEB.replaceAll('../../shared', '../../../shared'),
    'worker/src/h.ts': HILFE.replaceAll('../../shared', '../../../shared'),
  }
  const wurzel = baum(dateien)
  try {
    const meldung = aufgabe(wurzel)
    if (meldung) throw new Error(meldung)
    console.log(`  ✓ ${name}`)
  } catch (e) {
    fehler.push(name)
    console.error(`  ✗ ${name} — ${e.message}`)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

pruefe('zwei Läufe aus derselben Quelle: je Quelle genau ein Import, Namen sortiert (Quelle und Ziel)', (w) => {
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'zwei')
  const a = lies(w, 'web/src/a.tsx')
  const b = lies(w, 'web/src/b.tsx')
  if (!a.includes("import { eins, zwei } from './b.tsx'")) return `Quelle ohne gemeinsamen Import:\n${a}`
  if (zaehle(a, /from '\.\/b\.tsx'/g) !== 1) return `Quelle: mehrere Importe von b.tsx\n${a}`
  if (zaehle(b, /from '@shared\/x\.ts'/g) !== 1) return `Ziel: mehrere Importe aus shared\n${b}`
  if (!b.includes("import { fa, fb, type TA } from '@shared/x.ts'")) return `Ziel: Namen nicht gemeinsam/sortiert\n${b}`
})

pruefe('relativer shared-Pfad der Quelle wird im Ziel der Alias; im Worker bleibt er relativ', (w) => {
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  NAMEN(w, 'worker/src/w.ts', 'worker/src/b.ts', 'eins')
  const web = lies(w, 'web/src/b.tsx')
  const worker = lies(w, 'worker/src/b.ts')
  if (!web.includes("from '@shared/x.ts'") || web.includes('../shared')) return `Web ohne Alias:\n${web}`
  if (!worker.includes("from '../../../shared/x.ts'") || worker.includes('@shared')) return `Worker nicht relativ:\n${worker}`
})

pruefe('Typ, den die Quelle nicht importiert, kommt im Ziel über den Alias (abschnitt)', (w) => {
  const quelle = ["import { holeTa } from './h.ts'", 'export function g() {', '  const t = holeTa()', '  console.log(t.n)', '}', ''].join('\n')
  writeFileSync(join(w, 'web/src/g.ts'), quelle)
  umzug(w, 'abschnitt', join(w, 'web/src/g.ts'), '4', '4', join(w, 'web/src/g2.ts'), 'zeige')
  const ziel = lies(w, 'web/src/g2.ts')
  if (!ziel.includes("import type { TA } from '@shared/x.ts'")) return `Ziel:\n${ziel}`
})

pruefe('Kommentarblock wandert mit; getrennter Kommentar und der über einer bleibenden Deklaration bleiben', (w) => {
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins,zwei')
  const a = lies(w, 'web/src/a.tsx')
  const b = lies(w, 'web/src/b.tsx')
  if (!b.includes('/** Doku von eins */\n// Zusatz\nexport function eins')) return `Block nicht im Ziel:\n${b}`
  if (!b.includes('// Zeilenkommentar zwei')) return `Zeilenkommentar nicht im Ziel:\n${b}`
  if (a.includes('Doku von eins') || a.includes('Zusatz') || a.includes('Zeilenkommentar')) return `Rest in der Quelle:\n${a}`
  if (!a.includes('// Abschnittskommentar, bleibt (Leerzeile darunter)')) return `getrennter Kommentar fehlt:\n${a}`
  if (b.includes('Abschnittskommentar')) return `getrennter Kommentar mitgewandert:\n${b}`
  if (!a.includes('/** Doku drei, bleibt */\nexport function drei')) return `Kommentar über bleibender Deklaration verloren:\n${a}`
  if (/\n\n\n/.test(a) || /\n\n\n/.test(b)) return 'zwei Leerzeilen hintereinander'
})

pruefe('Konstante nur der verschobenen Teile steht am Dateianfang des Ziels (hinter den Importen), nicht in der Quelle', (w) => {
  writeFileSync(join(w, 'web/src/b.tsx'), "import { ha } from './h.ts'\n\nexport const vorhanden = ha()\n")
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  const a = lies(w, 'web/src/a.tsx')
  const b = lies(w, 'web/src/b.tsx')
  if (a.includes('LIMIT')) return `LIMIT blieb in der Quelle:\n${a}`
  const limit = b.indexOf('// Kopf der Konstante\nconst LIMIT = 5')
  if (limit < 0 || limit > b.indexOf('export const vorhanden')) return `LIMIT nicht vor dem bisherigen Inhalt:\n${b}`
  if (b.includes('export const LIMIT')) return 'LIMIT wurde unnötig exportiert'
})

pruefe('Konstante, die die Quelle noch braucht, bleibt dort', (w) => {
  writeFileSync(join(w, 'web/src/a.tsx'), `${WEB}export const nochmal = () => LIMIT\n`)
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  const a = lies(w, 'web/src/a.tsx')
  if (!a.includes('const LIMIT = 5')) return `LIMIT fehlt in der Quelle:\n${a}`
})

if (fehler.length) {
  console.error(`modul-umzug.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('modul-umzug.test: 4 Fälle (abschnitt) und 6 Fälle (Importe, Alias, Kommentare, Konstanten) ok.')
