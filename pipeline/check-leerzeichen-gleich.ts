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

function selbstpruefung(): number {
  // Ausgelassen wird nur, was ein `=` mit Leerraum davor und danach hat oder gar kein Zuweisungs-`=` ist.
  const gut = [
    'const x = 1', 'const x =\n  1', 'a == b', 'a === b', 'a => b', 'a += 1', 'a !== b', 'a <= b',
    "const s = 'x =y'", 'const r = /a =b/', 'const t = `a =b`', '// x =y', '/* x =y */',
    'const j = <a href="x" b={1} />', 'const x= 1', 'const { a = 1 } = o',
  ]
  const schlecht: [string, number][] = [
    ['const x =y', 1], ['let x =[1]', 1], ['x =f()', 1], ['const x =\'a\'', 1], ['const x =`a`', 1],
    ['const erst ={ a: 1 }', 1], ['const f =(a: number) => a', 1], ['function f(a =1) {}', 1],
    ['const a =1\nconst b =2', 2], ["const s = `${(x =y)}`", 1],
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
  return fehler
}

function main(): number {
  let fehler = selbstpruefung()
  const dateien = execFileSync('git', ['ls-files', '-z', ...ORDNER], { cwd: WURZEL, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 })
    .split('\0')
    .filter((d) => /\.(ts|tsx|mjs|cjs|js)$/.test(d))
  if (dateien.length < 1000) {
    console.error(`FEHLER: nur ${dateien.length} Quelldateien gefunden`)
    return 1
  }
  let treffer = 0
  for (const datei of dateien) {
    for (const f of findeVerschluckte(readFileSync(resolve(WURZEL, datei), 'utf8'), datei)) {
      treffer++
      console.error(`FEHLER: ${datei}:${f.zeile} Leerzeichen nach = fehlt: ${f.text}`)
    }
  }
  fehler += treffer
  console.log(`check-leerzeichen-gleich: ${fehler ? 'FEHLER' : 'ok'} (${dateien.length} Dateien, ${treffer} Treffer, 26 Selbstfälle)`)
  return fehler ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
