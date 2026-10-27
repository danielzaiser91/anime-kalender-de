/**
 * Wächter gegen verschluckte Leerzeichen nach `=` („const x =y“, 24 Stellen in PR 2194 repariert).
 * Prüft alle getrackten Quelldateien in pipeline, shared, web/src, tools, extension und worker; Läufe in `check:logic`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findeVerschluckte } from './lib/leerzeichen-gleich.ts'

const WURZEL = resolve(import.meta.dirname, '..')
const ORDNER = ['pipeline', 'shared', 'web/src', 'tools', 'extension', 'worker']
const ENDUNGEN = ['ts', 'tsx', 'mjs', 'cjs', 'js']

/** Urteil über eine Dateiliste: Meldungen und Zahl der Treffer; fehlt ein Ordner oder eine Endung, ist der Wächter blind. */
export function bewerte(dateien: string[], lies: (d: string) => string): { meldungen: string[]; treffer: number } {
  const meldungen: string[] = []
  for (const o of ORDNER) {
    if (!dateien.some((d) => d.startsWith(`${o}/`))) meldungen.push(`Ordner ${o}: keine Datei gescannt`)
  }
  for (const e of ENDUNGEN) {
    if (!dateien.some((d) => d.endsWith(`.${e}`))) meldungen.push(`Endung .${e}: keine Datei gescannt`)
  }
  let treffer = 0
  for (const datei of dateien) {
    for (const f of findeVerschluckte(lies(datei), datei)) {
      treffer++
      meldungen.push(`${datei}:${f.zeile} Leerzeichen nach = fehlt: ${f.text}`)
    }
  }
  return { meldungen, treffer }
}

function selbstpruefung(): number {
  // Ausgelassen wird nur, was ein `=` mit Leerraum davor und danach hat oder gar kein Zuweisungs-`=` ist.
  const gut = [
    'const x = 1', 'const x =\n  1', 'a == b', 'a === b', 'a => b', 'a += 1', 'a !== b', 'a <= b',
    "const s = 'x =y'", 'const r = /a =b/', 'const t = `a =b`', '// x =y', '/* x =y */',
    'const j = <a href="x" b={1} />', 'const x= 1', 'const { a = 1 } = o', 'a =',
  ]
  const schlecht: [string, number][] = [
    ['const x =y', 1], ['let x =[1]', 1], ['x =f()', 1], ['const x =\'a\'', 1], ['const x =`a`', 1],
    ['const erst ={ a: 1 }', 1], ['const f =(a: number) => a', 1], ['function f(a =1) {}', 1],
    ['const a =1\nconst b =2', 2], ["const s = `${(x =y)}`", 1],
    // JSX-Zweig (TSX): ein Attribut mit Leerraum davor ist verschluckt, eines ohne nicht.
    ['const j = <div a ="1" />', 1], ['const j = <div a ="1" b="2" c ={3} />', 2],
  ]
  let fehler = 0
  for (const text of gut) {
    const n = findeVerschluckte(text, 'x.tsx').length
    if (n !== 0) { fehler++; console.error(`FEHLER: ${JSON.stringify(text)} gilt als verschluckt (${n})`) }
  }
  for (const [text, soll] of schlecht) {
    const n = findeVerschluckte(text, 'x.tsx').length
    if (n !== soll) { fehler++; console.error(`FEHLER: ${JSON.stringify(text)} ergibt ${n} statt ${soll}`) }
  }
  // Ende ohne Zeichen danach (danach === '') darf nicht abstürzen und gilt nicht als Treffer, auch ohne TSX.
  if (findeVerschluckte('a =', 'x.ts').length !== 0) { fehler++; console.error('FEHLER: „a =“ am Dateiende') }
  return fehler + torpruefung()
}

/** Ein geplanter Treffer muss den Exit-Code von `lauf` auf 1 setzen, ein fehlender Ordner, eine fehlende Endung oder ein roter Selbstfall ebenso. */
function torpruefung(): number {
  const stumm = { log: () => undefined, error: () => undefined }
  const alle = [...ORDNER.map((o) => `${o}/a.ts`), 'x/b.tsx', 'x/c.mjs', 'x/d.cjs', 'x/e.js']
  const sauber = () => 'const x = 1'
  const geplant = (d: string) => (d === 'tools/a.ts' ? 'const x =y' : 'const x = 1')
  const faelle: [string, number, number][] = [
    ['saubere Liste', lauf(alle, sauber, 0, stumm), 0],
    ['geplanter Treffer', lauf(alle, geplant, 0, stumm), 1],
    ['fehlender Ordner', lauf(alle.filter((d) => !d.startsWith('worker/')), sauber, 0, stumm), 1],
    ['fehlende Endung', lauf(alle.filter((d) => !d.endsWith('.cjs')), sauber, 0, stumm), 1],
    ['roter Selbstfall', lauf(alle, sauber, 1, stumm), 1],
  ]
  let fehler = 0
  for (const [name, ist, soll] of faelle) {
    if (ist !== soll) { fehler++; console.error(`FEHLER: ${name}: Exit ${ist} statt ${soll}`) }
  }
  const zaehlung = bewerte(alle, geplant)
  if (zaehlung.treffer !== 1 || zaehlung.meldungen.length !== 1) { fehler++; console.error('FEHLER: geplanter Treffer nicht gezählt') }
  return fehler
}

interface Ausgabe {
  log: (s: string) => void
  error: (s: string) => void
}

/** Exit-Code für Dateiliste und Ergebnis der Selbstprüfung (Anzahl roter Selbstfälle). */
function lauf(dateien: string[], lies: (d: string) => string, selbst: number, aus: Ausgabe): number {
  const { meldungen, treffer } = bewerte(dateien, lies)
  for (const m of meldungen) aus.error(`FEHLER: ${m}`)
  const rot = selbst + meldungen.length
  aus.log(`check-leerzeichen-gleich: ${rot ? 'FEHLER' : 'ok'} (${dateien.length} Dateien, ${treffer} Treffer, 6 Ordner, 5 Endungen)`)
  return rot ? 1 : 0
}

function main(): number {
  const selbst = selbstpruefung()
  const dateien = execFileSync('git', ['ls-files', '-z', ...ORDNER], { cwd: WURZEL, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 })
    .split('\0')
    .filter((d) => /\.(ts|tsx|mjs|cjs|js)$/.test(d))
  return lauf(dateien, (d) => readFileSync(resolve(WURZEL, d), 'utf8'), selbst, console)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
