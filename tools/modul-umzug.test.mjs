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
const HILFE = [
  "import type { TA } from '../../shared/sub/x.ts'",
  'export interface TH { m: number }',
  'export const ha = () => 2',
  'export const holeTa = (): TA => ({ n: 1 })',
  'export const holeTh = (): TH => ({ m: 1 })',
  '',
].join('\n')
const STANDARD = 'export default 7\nexport const t1 = 1\n'
const WEB = [
  "import { fa, fb, type TA } from '../../shared/sub/x.ts'", // relativ geschrieben: im Ziel wird es der Alias
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

/** Jeder Fall bekommt einen frischen Baum aus den gemeinsamen Dateien plus `extra`; ein Rückgabetext ist der Fehler. */
function pruefe(name, aufgabe, extra = {}) {
  const dateien = {
    'shared/sub/x.ts': SHARED,
    'web/src/h.ts': HILFE,
    'web/src/d.ts': STANDARD,
    'web/src/a.tsx': WEB,
    'worker/src/w.ts': WEB,
    'worker/src/h.ts': HILFE,
    ...extra,
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

const gleich = (ist, soll) => (ist === soll ? '' : `erwartet:\n${soll}\n--- erhalten:\n${ist}`)

const SOLL_A = [
  "import { fa } from '../../shared/sub/x.ts'",
  "import { eins, zwei } from './b.tsx'",
  '',
  '// Abschnittskommentar, bleibt (Leerzeile darunter)',
  '',
  '/** Doku drei, bleibt */',
  'export function drei() { return fa(1) }',
  '',
  'export function nutzt() { return eins(1) + zwei() + drei() }',
  '',
].join('\n')
const SOLL_B = [
  "import { fa, fb, type TA } from '@shared/sub/x.ts'",
  "import { ha } from './h.ts'",
  '',
  '// Kopf der Konstante',
  'const LIMIT = 5',
  '',
  '/** Doku von eins */',
  '// Zusatz',
  'export function eins(x: TA) { return fa(x) + LIMIT }',
  '',
  'export function zwei() { return fb() + ha() } // Zeilenkommentar zwei',
  '',
].join('\n')

pruefe('zwei Läufe aus derselben Quelle: je Quelle ein Import, Namen sortiert, Kommentare und Konstante wandern', (w) => {
  const erster = NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  if (!erster.stdout.includes('mitgenommen') || !erster.stdout.includes('LIMIT')) return `Meldung „mitgenommen: LIMIT“ fehlt:\n${erster.stdout}`
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'zwei')
  return (
    gleich(lies(w, 'web/src/a.tsx'), SOLL_A) ||
    gleich(lies(w, 'web/src/b.tsx'), SOLL_B)
  )
})

pruefe('relativer shared-Pfad der Quelle wird im Ziel der Alias; im Worker bleibt er relativ', (w) => {
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  NAMEN(w, 'worker/src/w.ts', 'worker/src/b.ts', 'eins')
  const web = lies(w, 'web/src/b.tsx')
  const worker = lies(w, 'worker/src/b.ts')
  if (!web.includes("from '@shared/sub/x.ts'") || web.includes('../shared')) return `Web ohne Alias:\n${web}`
  if (!worker.includes("from '../../shared/sub/x.ts'") || worker.includes('@shared')) return `Worker nicht relativ:\n${worker}`
})

const ABSCHNITT = [
  "import { ha } from './h.ts'",
  "import { holeTh } from './h.ts'",
  "import { holeTa } from './h.ts'",
  'export function g() {',
  '  const th = holeTh()',
  '  const ta = holeTa()',
  '  console.log(th.m + ha() + ta.n)',
  '  return ta',
  '}',
  '',
].join('\n')

pruefe('abschnitt: Typen über den Alias, ein Import je Quelle im Ziel, unbenutzte Importe der Quelle weg', (w) => {
  umzug(w, 'abschnitt', join(w, 'web/src/g.ts'), '7', '7', join(w, 'web/src/g2.ts'), 'zeige')
  const quelle = lies(w, 'web/src/g.ts')
  const ziel = lies(w, 'web/src/g2.ts')
  if (!ziel.includes("import type { TA } from '@shared/sub/x.ts'")) return `Ziel ohne Typ-Alias:\n${ziel}`
  if (!ziel.includes("import { ha, type TH } from './h.ts'")) return `Ziel: ein Import je Quelle fehlt:\n${ziel}`
  if (/from '\.\/h\.ts'/g[Symbol.match](quelle).length !== 1 || quelle.includes('{ ha')) return `Quelle: unbenutzter Import blieb oder zwei Importe:\n${quelle}`
}, { 'web/src/g.ts': ABSCHNITT })

pruefe('abschnitt im Worker: Typ-Import bleibt relativ', (w) => {
  umzug(w, 'abschnitt', join(w, 'worker/src/g.ts'), '7', '7', join(w, 'worker/src/g2.ts'), 'zeige')
  const ziel = lies(w, 'worker/src/g2.ts')
  if (!ziel.includes("import type { TA } from '../../shared/sub/x.ts'")) return `Ziel:\n${ziel}`
}, { 'worker/src/g.ts': ABSCHNITT })

const KOMPONENTE = [
  "import { ha } from './h.ts'",
  "import { holeTh } from './h.ts'",
  'export function Komp() {',
  '  const th = holeTh()',
  '  return (',
  '    <div>',
  '      <span>{ha()}</span>',
  '      <b>{th.m}</b>',
  '    </div>',
  '  )',
  '}',
  '',
].join('\n')

pruefe('jsx: ein Import je Quelle im Ziel, unbenutzter Import der Quelle weg', (w) => {
  umzug(w, 'jsx', join(w, 'web/src/k.tsx'), '7', '8', join(w, 'web/src/k2.tsx'), 'Teil')
  const ziel = lies(w, 'web/src/k2.tsx')
  const quelle = lies(w, 'web/src/k.tsx')
  if (!ziel.includes("import { ha, type TH } from './h.ts'")) return `Ziel:\n${ziel}`
  if (quelle.includes('{ ha')) return `Quelle behält ha:\n${quelle}`
}, { 'web/src/k.tsx': KOMPONENTE })

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

pruefe('Konstante, die die Quelle noch braucht, bleibt dort; `let` und exportierte Konstanten wandern nie', (w) => {
  writeFileSync(join(w, 'web/src/a.tsx'), `${WEB}export const nochmal = () => LIMIT\n`)
  NAMEN(w, 'web/src/a.tsx', 'web/src/b.tsx', 'eins')
  if (!lies(w, 'web/src/a.tsx').includes('const LIMIT = 5')) return `LIMIT fehlt in der Quelle:\n${lies(w, 'web/src/a.tsx')}`
  const q = 'let zaehler = 0\nexport const OEFFENTLICH = 5\nexport function f() { zaehler++; return OEFFENTLICH }\n'
  writeFileSync(join(w, 'web/src/l.ts'), q)
  NAMEN(w, 'web/src/l.ts', 'web/src/l2.ts', 'f')
  const l = lies(w, 'web/src/l.ts')
  if (!l.includes('let zaehler = 0') || !l.includes('export const OEFFENTLICH = 5')) return `let oder exportierte Konstante gewandert:\n${l}`
})

pruefe('Leerzeilen an der Schnittstelle: ohne Leerzeile bleibt keine, mit Leerzeile bleibt eine', (w) => {
  writeFileSync(join(w, 'web/src/dicht.ts'), 'export const p = 1\nexport const q = 2\nexport const r = 3\n')
  NAMEN(w, 'web/src/dicht.ts', 'web/src/dicht2.ts', 'q')
  if (!lies(w, 'web/src/dicht.ts').includes('export const p = 1\nexport const r = 3')) return `dicht:\n${lies(w, 'web/src/dicht.ts')}`
  writeFileSync(join(w, 'web/src/luft.ts'), 'export const p = 1\n\nexport const q = 2\n\nexport const r = 3\n')
  NAMEN(w, 'web/src/luft.ts', 'web/src/luft2.ts', 'q')
  if (!lies(w, 'web/src/luft.ts').includes('export const p = 1\n\nexport const r = 3')) return `luftig:\n${lies(w, 'web/src/luft.ts')}`
})

pruefe('Standard- und benannter Import derselben Quelle werden einer; zwei Standardimporte bleiben getrennt', (w) => {
  const q = "import Standard, { t1 } from './d.ts'\nexport function f() { return Standard + t1 }\nexport const bleibt = 1\n"
  writeFileSync(join(w, 'web/src/s.ts'), q)
  NAMEN(w, 'web/src/s.ts', 'web/src/s2.ts', 'f')
  if (!lies(w, 'web/src/s2.ts').includes("import Standard, { t1 } from './d.ts'")) return `Ziel:\n${lies(w, 'web/src/s2.ts')}`
  const zwei = "import A from './d.ts'\nimport B from './d.ts'\nexport const x = A + B\nexport const mv = 1\n"
  writeFileSync(join(w, 'web/src/z.ts'), zwei)
  NAMEN(w, 'web/src/z.ts', 'web/src/z2.ts', 'mv')
  const quelle = lies(w, 'web/src/z.ts')
  if (!quelle.includes("import A from './d.ts'\nimport B from './d.ts'")) return `zwei Standardimporte verändert:\n${quelle}`
})

/** Ein Import mit `laenge` Zeichen in einer Zeile (genau an der Grenze 120) bzw. eins darüber, mehrzeilig. */
function langerImport(laenge) {
  const rumpf = laenge - "import {  } from '@shared/sub/x.ts'".length - 4
  const namen = ['alpha', 'beta', 'g'.repeat(rumpf - 'alpha'.length - 'beta'.length)]
  const q = [
    `import { ${namen.join(', ')} } from '../../shared/sub/x.ts'`,
    `export function f() { return ${namen.join(' + ')} }`,
    'export const bleibt = 1',
    '',
  ].join('\n')
  return { namen, q, x: `${namen.map((n) => `export const ${n} = 1`).join('\n')}\n` }
}

for (const [laenge, mehrzeilig] of [[120, false], [121, true]]) {
  pruefe(`Importzeile mit ${laenge} Zeichen ${mehrzeilig ? 'wird mehrzeilig' : 'bleibt einzeilig'}`, (w) => {
    const { namen, q, x } = langerImport(laenge)
    writeFileSync(join(w, 'shared/sub/x.ts'), x)
    writeFileSync(join(w, 'web/src/lang.ts'), q)
    NAMEN(w, 'web/src/lang.ts', 'web/src/lang2.ts', 'f')
    const ziel = lies(w, 'web/src/lang2.ts')
    const einzeilig = `import { ${namen.join(', ')} } from '@shared/sub/x.ts'`
    const erwartet = mehrzeilig ? `import {\n${namen.map((n) => `  ${n},`).join('\n')}\n} from '@shared/sub/x.ts'` : einzeilig
    if (einzeilig.length !== laenge) return `Testfehler: Zeilenlänge ${einzeilig.length}`
    if (!ziel.startsWith(erwartet)) return `Ziel:\n${ziel}`
  })
}

pruefe('Namensraum- und Nebenwirkungs-Import bleiben unberührt, Einzelimport behält seine Reihenfolge', (w) => {
  const q = "import * as H from './h.ts'\nimport './h.ts'\nimport { fb, fa } from '../../shared/sub/x.ts'\nexport function f() { return H.ha() }\nexport const beides = fb() + fa(1)\n"
  writeFileSync(join(w, 'web/src/n.ts'), q)
  NAMEN(w, 'web/src/n.ts', 'web/src/n2.ts', 'f')
  const quelle = lies(w, 'web/src/n.ts')
  if (!quelle.includes("import './h.ts'\n") || !quelle.includes("import { fb, fa } from '../../shared/sub/x.ts'")) return `Quelle:\n${quelle}`
  if (!lies(w, 'web/src/n2.ts').includes("import * as H from './h.ts'")) return `Ziel:\n${lies(w, 'web/src/n2.ts')}`
})

pruefe('Quelle ohne Importe: der Import des Ziels steht in der ersten Zeile', (w) => {
  writeFileSync(join(w, 'web/src/o.ts'), 'export const p = 1\nexport const q = p + 1\n')
  NAMEN(w, 'web/src/o.ts', 'web/src/o2.ts', 'p')
  return gleich(lies(w, 'web/src/o.ts'), "import { p } from './o2.ts'\n\nexport const q = p + 1\n")
})

if (fehler.length) {
  console.error(`modul-umzug.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('modul-umzug.test: 4 Fälle (abschnitt) und 14 Fälle (Importe, Alias, Kommentare, Konstanten, Leerzeilen) ok.')
