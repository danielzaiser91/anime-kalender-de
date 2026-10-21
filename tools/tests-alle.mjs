/**
 * Führt jede `tools/*.test.mjs` aus: bis zu 6 gleichzeitig (`tools/arbeiterpool.mjs`), Ausgabe je Test gepuffert und alphabetisch.
 * Die langsamsten Tests starten zuerst (sonst läuft am Ende einer allein, Messung 15.10.2026: zusammen 110 s).
 * Ohne `--alle` startet nach dem ersten roten Test keiner mehr; mit `--alle` laufen alle durch, am Ende steht die Liste der roten (Exit 1).
 * Alle Tests laufen unter der Bestandssperre (`tools/bestand-sperre.cjs`, wie `check:logic`); sie dürfen `public/data` nicht lesen.
 * Läuft in `npm run check:workflows`. Eine neue Test-Datei ist damit ohne Eintrag in `package.json` dabei:
 * die lange `&&`-Kette dort war die Stelle, an der jeder PR mit neuem Test mit den anderen kollidierte.
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { laufePool } from './arbeiterpool.mjs'
import { sperreUmgebung } from './sperre-umgebung.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const tests = readdirSync(tools).filter((f) => f.endsWith('.test.mjs')).sort()
const alle = process.argv.includes('--alle')
const LANGSAM = ['quellen-pr.test.mjs', 'quellen-pr-pruefung.test.mjs', 'bash-an-angehaengtes-log.test.mjs', 'commit-data.test.mjs', 'akroot-schreibziel.test.mjs']

const auftraege = tests.map((test) => ({ befehl: process.execPath, args: [join(tools, test)], cwd: wurzel, env: sperreUmgebung() }))
const { rote, gelaufen, veraendert } = await laufePool(auftraege, {
  wurzel,
  alle,
  anfang: LANGSAM.map((t) => tests.indexOf(t)).filter((i) => i >= 0),
  meldung: (i) => console.log(`[tests-alle] tools/${tests[i]}`),
})
if (rote.length > 0 && !alle) {
  console.error(`tests-alle: tools/${tests[rote[0].index]} ist rot.`)
  console.error('Weitere Fehler dahinter bleiben verdeckt. Alle roten Tests auf einmal: `node tools/tests-alle.mjs --alle`.')
  process.exit(rote[0].status)
}
if (rote.length > 0) {
  console.error(`tests-alle: ${rote.length} von ${tests.length} Tests rot:`)
  for (const r of rote) console.error(`  - tools/${tests[r.index]}`)
  process.exit(1)
}
if (veraendert.length > 0) process.exit(1)
console.log(`tests-alle: ${gelaufen} von ${tests.length} Tests grün.`)
