/**
 * `npm run check:logic`: führt die Prüfungen aus tools/check-logic-liste.txt mit tsx aus, bis zu 6 gleichzeitig (tools/arbeiterpool.mjs; Ausgabe je Prüfung gepuffert, in Listenreihenfolge).
 * Eine Datei je Zeile (Pfad ab Repo-Wurzel), `#` beginnt einen Kommentar. Nach dem ersten Fehler startet keine weitere Prüfung;
 * dessen Exit-Code ist der des Laufs. Mit `--alle` laufen alle durch, am Ende steht die Liste der roten
 * (Exit 1). Eigene Datei statt einer Kette in package.json, damit zwei PRs,
 * die je einen Check ergänzen, nicht in derselben Zeile kollidieren; die Liste ist sortiert, damit sie auch
 * nicht an derselben Stelle (Listenende) einfügen.
 *
 * Dieselbe Mechanik fährt `npm run check:bestand-liste` (tools/check-bestand-liste.txt): `node tools/check-logic-alle.mjs <liste> <name>`.
 *
 * **Wächter (12.10.2026):** In `check:logic` darf keine Prüfung `public/data` lesen (`tools/bestand-sperre.cjs`, Zugriff auf die Sperre
 * gibt dieser Lauf per `NODE_OPTIONS` an jede Prüfung und deren Unterprozesse weiter). Der Bestand liegt oft hinter neueren Rohdaten
 * zurück; eine Prüfung, die ihn liest, macht PRs rot, die nichts dafür können. Altlasten stehen in
 * `tools/check-logic-bestand-ausnahmen.json`: mit Frist, nur die genannten Pfade, und nur, solange sie wirklich gelesen werden.
 * Die Zahl der Ausnahmen (`hoechstens`) wird nur gesenkt, nie erhöht.
 *
 * **Vollständigkeit (12.10.2026):** `check:logic` wird rot, wenn eine Prüfdatei in pipeline/ oder tools/ in keiner Prüfliste steht
 * (`tools/check-logic-vollstaendig.mjs`, bewusste Ausnahmen in `tools/check-logic-liste-ausnahmen.txt`).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { laufePool } from './arbeiterpool.mjs'
import { pruefeVollstaendig } from './check-logic-vollstaendig.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const [listeArg = 'tools/check-logic-liste.txt', name = 'check:logic'] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const mitSperre = name === 'check:logic'
const ausnahmenDatei = process.env.BESTAND_AUSNAHMEN ?? join(tools, 'check-logic-bestand-ausnahmen.json')

function abbruch(text) {
  console.error(`${name}: ${text}`)
  process.exit(1)
}

/** Ausnahmen laden und gegen ihre Regeln prüfen: Höchstzahl, Frist, Datei steht in der Liste. */
function ladeAusnahmen(dateien) {
  if (!mitSperre || !existsSync(ausnahmenDatei)) return new Map()
  const roh = JSON.parse(readFileSync(ausnahmenDatei, 'utf8'))
  const heute = new Date().toISOString().slice(0, 10)
  if (roh.ausnahmen.length > roh.hoechstens) abbruch(`${roh.ausnahmen.length} Ausnahmen, erlaubt höchstens ${roh.hoechstens} (${ausnahmenDatei}).`)
  for (const a of roh.ausnahmen) {
    if (!dateien.includes(a.datei)) abbruch(`Ausnahme für ${a.datei}, die nicht in der Liste steht: streichen.`)
    if (a.bis < heute) abbruch(`Die Frist der Ausnahme für ${a.datei} ist am ${a.bis} abgelaufen: Prüfung nach check:bestand verschieben.`)
  }
  return new Map(roh.ausnahmen.map((a) => [a.datei, a]))
}

/** Umgebung einer Prüfung: mit Sperre, bei einer Ausnahme mit den erlaubten Pfaden und einer Spur-Datei. */
function umgebung(ausnahme, spurDatei) {
  if (!mitSperre) return process.env
  const sperre = join(tools, 'bestand-sperre.cjs').replace(/\\/g, '/')
  const optionen = `${process.env.NODE_OPTIONS ?? ''} --require ${sperre}`.trim()
  return { ...process.env, NODE_OPTIONS: optionen, BESTAND_ERLAUBT: ausnahme?.erlaubt.join(',') ?? '', BESTAND_SPUR: spurDatei }
}

/** Eine Ausnahme, deren Pfade nicht mehr gelesen werden, ist überflüssig: Der Wächter verlangt, sie zu streichen (Fehltext oder null). */
function pruefeAusnahmeGenutzt(ausnahme, spurDatei) {
  const gelesen = new Set(existsSync(spurDatei) ? readFileSync(spurDatei, 'utf8').split('\n').filter(Boolean) : [])
  const unnoetig = ausnahme.erlaubt.filter((p) => !gelesen.has(p))
  if (unnoetig.length) return `${name}: ${ausnahme.datei} liest ${unnoetig.join(', ')} nicht mehr: die Ausnahme (tools/check-logic-bestand-ausnahmen.json) streichen.`
  return null
}

const dateien = readFileSync(resolve(wurzel, listeArg), 'utf8')
  .split(/\r?\n/)
  .map((z) => z.trim())
  .filter((z) => z && !z.startsWith('#'))

if (dateien.length === 0) {
  console.error(`${name}: ${listeArg} enthält keine Prüfung.`)
  process.exit(1)
}

if (mitSperre) {
  const unverdrahtet = pruefeVollstaendig(wurzel)
  for (const f of unverdrahtet) console.error(`${name}: ${f}`)
  if (unverdrahtet.length) process.exit(1)
}

const unsortiert = dateien.find((d, i) => i > 0 && d < dateien[i - 1])
if (unsortiert) {
  console.error(`${name}: ${listeArg} muss alphabetisch sortiert sein (${unsortiert} steht zu früh).`)
  process.exit(1)
}

const doppelt = dateien.find((d, i) => dateien.indexOf(d) !== i)
if (doppelt) {
  console.error(`${name}: ${doppelt} steht mehrfach in ${listeArg}: eine Zeile streichen.`)
  process.exit(1)
}

const alle = process.argv.includes('--alle')
const ausnahmen = ladeAusnahmen(dateien)
const spurOrdner = mkdtempSync(join(tmpdir(), 'bestand-spur-'))

/** Ein Auftrag je Prüfung; die Spur-Datei ist je Prüfung eigen, weil Prüfungen gleichzeitig laufen. */
const auftraege = dateien.map((datei, i) => {
  const spurDatei = join(spurOrdner, `spur-${i}.txt`)
  return {
    befehl: process.execPath,
    args: [tsx, datei],
    cwd: wurzel,
    env: umgebung(ausnahmen.get(datei), spurDatei),
    nachher: () => (ausnahmen.has(datei) ? pruefeAusnahmeGenutzt(ausnahmen.get(datei), spurDatei) : null),
  }
})

const { rote, gelaufen, veraendert } = await laufePool(auftraege, {
  wurzel,
  alle,
  meldung: (i) => console.log(`[${name} ${i + 1}/${dateien.length}] ${dateien[i]}`),
})
rmSync(spurOrdner, { recursive: true, force: true })
if (rote.length > 0 && !alle) {
  console.error(`${name}: ${dateien[rote[0].index]} ist rot (${gelaufen - rote.length} von ${dateien.length} Prüfungen grün gelaufen).`)
  console.error(`Weitere Fehler dahinter bleiben verdeckt. Alle roten Prüfungen auf einmal: \`npm run ${mitSperre ? 'check:logic' : 'check:bestand-liste'} -- --alle\`.`)
  process.exit(rote[0].status)
}
if (rote.length > 0) {
  console.error(`${name}: ${rote.length} von ${dateien.length} Prüfungen rot:`)
  for (const r of rote) console.error(`  - ${dateien[r.index]}`)
  process.exit(1)
}
if (veraendert.length > 0) process.exit(1)
console.log(`${name}: ${dateien.length} von ${dateien.length} Prüfungen grün.`)
