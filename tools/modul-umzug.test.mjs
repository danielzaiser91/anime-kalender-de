/** Tests für tools/modul-umzug.mjs `abschnitt`: die zwei stillen Fehlverschiebungen vom 12.11.2026 brechen jetzt ab, ein ganzer Abschnitt geht durch. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WERKZEUG = new URL('./modul-umzug.mjs', import.meta.url).pathname
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

if (fehler.length) {
  console.error(`modul-umzug.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('modul-umzug.test: 4 Fälle ok.')
