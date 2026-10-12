/**
 * `npm run check:logic`: führt die Prüfungen aus tools/check-logic-liste.txt nacheinander mit tsx aus.
 * Eine Datei je Zeile (Pfad ab Repo-Wurzel), `#` beginnt einen Kommentar. Der erste Fehler bricht ab
 * und gibt dessen Exit-Code zurück. Mit `--alle` laufen alle durch, am Ende steht die Liste der roten
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
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** Eine Ausnahme, deren Pfade nicht mehr gelesen werden, ist überflüssig: Der Wächter verlangt, sie zu streichen. */
function pruefeAusnahmeGenutzt(ausnahme, spurDatei) {
  const gelesen = new Set(existsSync(spurDatei) ? readFileSync(spurDatei, 'utf8').split('\n').filter(Boolean) : [])
  const unnoetig = ausnahme.erlaubt.filter((p) => !gelesen.has(p))
  if (unnoetig.length) abbruch(`${ausnahme.datei} liest ${unnoetig.join(', ')} nicht mehr: die Ausnahme (tools/check-logic-bestand-ausnahmen.json) streichen.`)
}

const dateien = readFileSync(resolve(wurzel, listeArg), 'utf8')
  .split(/\r?\n/)
  .map((z) => z.trim())
  .filter((z) => z && !z.startsWith('#'))

if (dateien.length === 0) {
  console.error(`${name}: ${listeArg} enthält keine Prüfung.`)
  process.exit(1)
}

const unsortiert = dateien.find((d, i) => i > 0 && d < dateien[i - 1])
if (unsortiert) {
  console.error(`${name}: ${listeArg} muss alphabetisch sortiert sein (${unsortiert} steht zu früh).`)
  process.exit(1)
}

const alle = process.argv.includes('--alle')
const rote = []

const ausnahmen = ladeAusnahmen(dateien)
const spurOrdner = mkdtempSync(join(tmpdir(), 'bestand-spur-'))
for (const [i, datei] of dateien.entries()) {
  console.log(`[${name} ${i + 1}/${dateien.length}] ${datei}`)
  const spurDatei = join(spurOrdner, 'spur.txt')
  rmSync(spurDatei, { force: true })
  const lauf = spawnSync(process.execPath, [tsx, datei], { cwd: wurzel, stdio: 'inherit', env: umgebung(ausnahmen.get(datei), spurDatei) })
  if (lauf.status === 0) {
    if (ausnahmen.has(datei)) pruefeAusnahmeGenutzt(ausnahmen.get(datei), spurDatei)
    continue
  }
  rote.push(datei)
  if (!alle) {
    console.error(`${name}: ${datei} ist rot (nach ${i} grünen von ${dateien.length}).`)
    console.error(`Weitere Fehler dahinter bleiben verdeckt. Alle roten Prüfungen auf einmal: \`npm run ${mitSperre ? 'check:logic' : 'check:bestand-liste'} -- --alle\`.`)
    process.exit(lauf.status ?? 1)
  }
}
rmSync(spurOrdner, { recursive: true, force: true })
if (rote.length > 0) {
  console.error(`${name}: ${rote.length} von ${dateien.length} Prüfungen rot:`)
  for (const datei of rote) console.error(`  - ${datei}`)
  process.exit(1)
}
console.log(`${name}: ${dateien.length} von ${dateien.length} Prüfungen grün.`)
