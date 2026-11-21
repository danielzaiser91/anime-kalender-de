/**
 * Führt jede `tools/*.test.mjs` und `.claude/hooks/*-test.mjs` aus: bis zu 6 gleichzeitig (`tools/arbeiterpool.mjs`), Ausgabe je Test gepuffert und alphabetisch.
 * Die langsamsten Tests starten zuerst (sonst läuft am Ende einer allein, Messung 15.10.2026: zusammen 110 s).
 * Ohne `--alle` startet nach dem ersten roten Test keiner mehr; mit `--alle` laufen alle durch, am Ende steht die Liste der roten (Exit 1).
 * Alle Tests laufen unter der Bestandssperre (`tools/bestand-sperre.cjs`, wie `check:logic`); sie dürfen `public/data` nicht lesen.
 * Mit `--teil k/n` nur Teil k von n (`tools/tests-teil.mjs`; die PR-Kette fährt zwei Teile in zwei Jobs).
 * Ohne `--nachts` fehlen die Tests, die `tools/pruefung-ort.json` für die Nacht nennt; `--nachts` fährt nur sie (`npm run check:nachts`).
 * Im PR-Ereignis laufen davon die mit, deren `liest`-Datei der PR ändert (`beruehrteDateien`).
 * Läuft in `npm run check:workflows`. Eine neue Test-Datei ist damit ohne Eintrag in `package.json` dabei:
 * die lange `&&`-Kette dort war die Stelle, an der jeder PR mit neuem Test mit den anderen kollidierte.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { laufePool } from './arbeiterpool.mjs'
import { ohneCiToken } from './bau-umgebung.mjs'
import { beruehrteDateien, leseModus, leseOrt, nachOrt } from './pruefung-ort.mjs'
import { sperreUmgebung } from './sperre-umgebung.mjs'
import { findeTests } from './tests-liste.mjs'
import { leseTeil, waehleTeil } from './tests-teil.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
// Ort jeder Prüfung (tools/pruefung-ort.mjs): ohne --nachts laufen die Nacht-Einträge nicht mit (außer der PR ändert eine ihrer Lesedateien), mit --nachts nur sie.
const modus = leseModus(process.argv)
const beruehrt = modus === 'pr' ? beruehrteDateien(wurzel) : []
const alleTests = nachOrt(findeTests(tools, wurzel), leseOrt(wurzel), 'tests', modus, (t) => `tools/${t}`, beruehrt)
const nachtsMit = alleTests.filter((t) => leseOrt(wurzel).tests?.[`tools/${t}`]?.ort === 'nachts')
if (modus === 'pr' && nachtsMit.length > 0) console.log(`tests-alle: Nacht-Tests mit berührter Lesedatei laufen im PR mit: ${nachtsMit.join(', ')}`)
const alle = process.argv.includes('--alle')
const LANGSAM = ['quellen-pr.test.mjs', 'quellen-pr-pruefung.test.mjs', 'bash-an-angehaengtes-log.test.mjs', 'commit-data.test.mjs', 'akroot-schreibziel.test.mjs']
const teil = leseTeil(process.argv)
const tests = teil ? waehleTeil(alleTests, teil, LANGSAM) : alleTests
if (teil) console.log(`tests-alle: Teil ${teil.k}/${teil.n}, ${tests.length} von ${alleTests.length} Tests.`)

const auftraege = tests.map((test) => ({ befehl: process.execPath, args: [join(tools, test)], cwd: wurzel, env: ohneCiToken(sperreUmgebung()) }))
const { rote, gelaufen, veraendert } = await laufePool(auftraege, {
  wurzel,
  alle,
  anfang: LANGSAM.map((t) => tests.indexOf(t)).filter((i) => i >= 0),
  meldung: (i, sekunden) => console.log(`[tests-alle] tools/${tests[i]} (${sekunden.toFixed(1)} s)`),
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
