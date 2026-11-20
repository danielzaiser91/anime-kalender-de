// Test für tools/liegegut-vorrat.mjs: liegende `vergeben-*.md` im Vorrat. Aufruf: node tools/liegegut-vorrat.test.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dateiFund, vorratFunde, vorratMeldung, zeitAusZeile } from './liegegut-vorrat.mjs'
import { main, meldeLiegt } from './liegegut.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// 14.11.2026 13:00 Berlin (MEZ, UTC+1)
const JETZT = Date.parse('2026-11-14T12:00:00Z')
const KEINE = new Set()
const zeile = (rest) => `# Auftrag\n\n**Vergeben:** ${rest}\n\nText\n`
const ROUTINE = 'Routine https://claude.ai/code/routines/trig_x'
const PR = (n) => `https://github.com/derNamenloseDaniel/anime-kalender-de/pull/${n}`
const fund = (text, offene = KEINE, mtime = JETZT, jetzt = JETZT) => dateiFund('vergeben-a.md', text, mtime, offene, jetzt)

console.log('liegegut-vorrat: Zeit aus der Vergeben-Zeile (Berlin, Jahr aus jetzt)')
pruefe('Winterzeit: 13.11. 14:43 Berlin = 13:43 UTC', zeitAusZeile('**Vergeben:** x (13.11. 14:43)', JETZT) === Date.parse('2026-11-13T13:43:00Z'))
pruefe('Sommerzeit: 14.07. 12:00 Berlin = 10:00 UTC', zeitAusZeile('(14.07. 12:00)', Date.parse('2026-11-14T12:00:00Z')) === Date.parse('2026-07-14T10:00:00Z'))
pruefe('Jahreswechsel: 31.12. im Januar = Vorjahr', zeitAusZeile('(31.12. 10:00)', Date.parse('2027-01-02T12:00:00Z')) === Date.parse('2026-12-31T09:00:00Z'))
pruefe('ohne Uhrzeit → null', zeitAusZeile('**Vergeben:** PR-Link folgt', JETZT) === null)

console.log('liegegut-vorrat: Grenze 24 h (13.11. 13:00 Berlin = genau 24 h)')
pruefe('genau 24 h → keine Meldung', fund(zeile(`${ROUTINE} (13.11. 13:00)`)) === null)
const eine = fund(zeile(`${ROUTINE} (13.11. 12:59)`))
pruefe('eine Minute über 24 h → Meldung mit Dateiname, Alter, Hinweis', eine === 'vergeben-a.md (24 h vergeben, kein PR-Link – PR prüfen)', eine)
pruefe('Gegenprobe: 23 h alt → keine Meldung', fund(zeile(`${ROUTINE} (13.11. 14:00)`)) === null)
pruefe('Alter wird ausgegeben: 13.11. 10:00 → 27 h', /\(27 h vergeben/.test(fund(zeile(`${ROUTINE} (13.11. 10:00)`)) ?? ''))

console.log('liegegut-vorrat: PR-Zuordnung über PR-Links der Vergeben-Zeile')
const alt = `(12.11. 10:00)`
pruefe('PR-Link offen → keine Meldung', fund(zeile(`${PR(3870)} ${alt}`), new Set([3870])) === null)
const zu = fund(zeile(`${PR(3870)} ${alt}`), new Set([3999]))
pruefe('Gegenprobe: PR-Link nicht offen → Meldung mit Nummer', /PR #3870 nicht offen – PR prüfen/.test(zu ?? ''), zu)
pruefe('zwei Links, einer offen → keine Meldung', fund(zeile(`${PR(3870)} ${PR(3871)} ${alt}`), new Set([3871])) === null)
pruefe('PR-Link steht nur im Text (nicht in der Vergeben-Zeile) → zählt nicht', /kein PR-Link/.test(fund(`${zeile(`${ROUTINE} ${alt}`)}\n${PR(3870)}\n`, new Set([3870])) ?? ''))
pruefe('ohne Vergeben-Zeile: Rückfall mtime, 30 h → Meldung', /30 h vergeben, kein PR-Link/.test(fund('# Auftrag\nText\n', KEINE, JETZT - 30 * 3600 * 1000) ?? ''))
pruefe('mtime 2 h → keine Meldung', fund('# Auftrag\n', KEINE, JETZT - 2 * 3600 * 1000) === null)
pruefe('Zeit in der Zeile gewinnt gegen frische mtime', fund(zeile(`${ROUTINE} ${alt}`), KEINE, JETZT) !== null)

console.log('liegegut-vorrat: Ordner')
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'liegegut-vorrat-'))
const schreibe = (name, text, alterH) => {
  const datei = path.join(ordner, name)
  fs.writeFileSync(datei, text)
  const t = new Date(JETZT - alterH * 3600 * 1000)
  fs.utimesSync(datei, t, t)
}
schreibe('vergeben-liegt.md', zeile(`${ROUTINE} ${alt}`), 1)
schreibe('vergeben-trifft-offenen-pr.md', zeile(`${PR(3870)} ${alt}`), 1)
schreibe('vergeben-ohne-zeile.md', '# Auftrag\n', 50)
schreibe('vergeben-frisch.md', zeile(`${ROUTINE} (14.11. 12:00)`), 1)
schreibe('erledigt-alt.md', zeile(`${ROUTINE} ${alt}`), 99)
schreibe('z-wartet-alt.md', '# Auftrag\n', 99)
const funde = vorratFunde(ordner, new Set([3870]), JETZT)
pruefe('nur die zwei liegenden vergeben-Dateien, sortiert; erledigt-, z-wartet-, frische und PR-offene nicht', funde.length === 2 && funde[0].startsWith('vergeben-liegt.md') && funde[1].startsWith('vergeben-ohne-zeile.md'), funde)
pruefe('Ordner fehlt (CI, Cloud) → leer, kein Fehler', vorratFunde(path.join(ordner, 'gibt-es-nicht'), KEINE, JETZT).length === 0)

console.log('liegegut-vorrat: Gesamtlauf über meldeLiegt und main (gh-Attrappe, Hauptordner aus git)')
const aufrufe = []
const gh = (args) => {
  aufrufe.push(args.join(' '))
  if (args[0] === 'pr') return JSON.stringify([{ number: 3870, title: 't', headRefOid: 'a'.repeat(40), createdAt: new Date(JETZT - 3600e3).toISOString(), mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', isDraft: false, body: '', baseRefName: 'main', reviews: [], statusCheckRollup: [], comments: [] }])
  if (args[1] === 'graphql') return `${'a'.repeat(40)} ${new Date(JETZT - 3600e3).toISOString()}`
  return ''
}
const hauptMitVorrat = fs.mkdtempSync(path.join(os.tmpdir(), 'liegegut-haupt-'))
const vorratImHaupt = path.join(hauptMitVorrat, 'daniel-zum-abarbeiten', 'vorrat')
fs.mkdirSync(vorratImHaupt, { recursive: true })
fs.writeFileSync(path.join(vorratImHaupt, 'vergeben-liegt.md'), zeile(`${ROUTINE} ${alt}`))
fs.writeFileSync(path.join(vorratImHaupt, 'vergeben-mit-pr.md'), zeile(`${PR(3870)} ${alt}`))
const gitMit = (haupt) => (a) => (a[0] === 'rev-parse' ? `${path.join(haupt, '.git')}\n` : '')
const lauf = (haupt) => {
  fs.mkdirSync(path.join(haupt, 'daniel-zum-abarbeiten'), { recursive: true })
  fs.writeFileSync(path.join(haupt, 'daniel-zum-abarbeiten', 'stand.md'), '### Jetzt\n')
  const aus = []
  meldeLiegt(gh, gitMit(haupt), (t) => aus.push(t), JETZT)
  const ausMain = []
  const exit = main(gh, gitMit(haupt), (t) => ausMain.push(t), JETZT)
  return { aus, ausMain, exit }
}
delete process.env.AK_VORRAT_ORDNER
const mit = lauf(hauptMitVorrat)
pruefe('meldeLiegt: eine LIEGT-VORRAT-Zeile, nur die Datei ohne offenen PR', mit.aus.length === 1 && /^LIEGT-VORRAT: vergeben-liegt\.md \(51 h vergeben, kein PR-Link – PR prüfen\)$/.test(mit.aus[0]), mit.aus)
pruefe('main: Zeile steht vor der Schlusszeile, Exit 0', mit.exit === 0 && /^LIEGT-VORRAT: vergeben-liegt\.md \(51 h/.test(mit.ausMain.at(-2)) && /^liegegut: 0 auffällige PRs$/.test(mit.ausMain.at(-1)), mit.ausMain)
aufrufe.length = 0
const ohneHaupt = fs.mkdtempSync(path.join(os.tmpdir(), 'liegegut-leer-'))
const ohne = lauf(ohneHaupt)
pruefe('Gegenprobe Ordner fehlt: keine Vorrat-Zeile, Schlusszeile da, Exit 0', ohne.aus.length === 0 && ohne.exit === 0 && ohne.ausMain.length === 1, ohne)
pruefe('ohne Vorrat-Ordner kein zusätzlicher gh-Aufruf (nur die zwei Läufe der PR-Abfrage)', !aufrufe.some((a) => a.endsWith('--json number')), aufrufe)
process.env.AK_VORRAT_ORDNER = path.join(ordner, 'gibt-es-nicht')
pruefe('AK_VORRAT_ORDNER überschreibt den Ordner (hier: fehlt → still)', vorratMeldung(gh, hauptMitVorrat, JETZT) === null)
delete process.env.AK_VORRAT_ORDNER

for (const d of [ordner, hauptMitVorrat, ohneHaupt]) fs.rmSync(d, { recursive: true, force: true })
if (fehler.length > 0) {
  console.error(`liegegut-vorrat.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('liegegut-vorrat.test: alle Fälle grün (Zeit Winter/Sommer/Jahreswechsel, Grenze 24 h, PR-Zuordnung, mtime-Rückfall, Ordner fehlt, Gesamtlauf meldeLiegt und main)')
