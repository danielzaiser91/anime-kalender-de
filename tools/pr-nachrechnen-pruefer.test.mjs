/**
 * Tests für tools/pr-nachrechnen-pruefer.mjs (Merge-Sperre „Prüfer verlangt Änderung“, 12.11.2026).
 * Fixture: eingefrorene Kommentar- und Commit-Listen von PR 3393, 3398, 3565, 3566 (`gh pr view N --json comments,commits`, 12.11.2026,
 * Kommentare auf die erste Zeile gekürzt; das Werkzeug liest nur diese). `bis(pr, zeit)` schneidet den Stand zu einem Zeitpunkt.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { prueferSperre, urteilAus } from './pr-nachrechnen-pruefer.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const PR = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./pr-nachrechnen-pruefer-fixture.json', import.meta.url)), 'utf8'))
const bis = (nr, zeit) => ({
  comments: PR[nr].comments.filter((c) => Date.parse(c.createdAt) <= Date.parse(zeit)),
  commits: PR[nr].commits.filter((c) => Date.parse(c.committedDate) <= Date.parse(zeit)),
})
const sperre = (nr, zeit) => {
  const s = bis(nr, zeit)
  return prueferSperre(s.comments, s.commits)
}
const SPERRE = /^PRÜFER VERLANGT ÄNDERUNG \(Urteil \S+, letzter Commit \S+\)$/
const gesperrt = (nr, zeit) => SPERRE.test(sperre(nr, zeit) ?? '')

console.log('pr-nachrechnen-pruefer: wörtliche Kommentarformen')
pruefe('3393: „Prüfer Runde 1: ändern (klein)“, nur der erste Commit -> gesperrt', gesperrt('3393', '2026-11-10T19:01:43Z'), sperre('3393', '2026-11-10T19:01:43Z'))
pruefe('3393: Meldung nennt beide Zeiten', sperre('3393', '2026-11-10T19:01:43Z') === 'PRÜFER VERLANGT ÄNDERUNG (Urteil 2026-11-10T19:01:43Z, letzter Commit 2026-11-10T18:58:22Z)')
pruefe('3393: Folgecommit 19:06 nach dem Urteil -> frei', sperre('3393', '2026-11-10T19:06:11Z') === null)
pruefe('3393: Nachtrag ohne Commit trägt kein Urteil -> weiter gesperrt', prueferSperre(bis('3393', '2026-11-10T19:06:11Z').comments, bis('3393', '2026-11-10T19:01:43Z').commits) !== null)
pruefe('3393: Abnahme Dirigent („freigeben“, ohne „Prüfer“) hebt nicht auf', prueferSperre(bis('3393', '2026-11-10T19:06:56Z').comments, bis('3393', '2026-11-10T19:01:43Z').commits) !== null)
pruefe('3393: ganzer Verlauf -> frei', sperre('3393', '2099-12-31T00:00:00Z') === null)
pruefe('3398: „Prüfer Runde 1: ändern“ mit Kopf 21e55 -> gesperrt', gesperrt('3398', '2026-11-10T19:40:41Z'))
pruefe('3398: CI-„ok“ für denselben Kopf 21e55 danach hebt auf', sperre('3398', '2026-11-10T19:44:11Z') === null)
pruefe('3398: ganzer Verlauf -> frei', sperre('3398', '2099-12-31T00:00:00Z') === null)
pruefe('3565: „Urteil: **ändern**“ des Prüfers -> gesperrt', gesperrt('3565', '2026-11-12T11:56:38Z'))
pruefe('3565: Nachtrag und Merge-Commit danach -> frei', sperre('3565', '2026-11-12T12:01:07Z') === null)
pruefe('3565: „ok“ für Kopf 4c7d9c2e4, jetziger Kopf 7a131f64f (veraltet) -> weiter gesperrt', prueferSperre(bis('3565', '2026-11-12T12:42:49Z').comments, bis('3565', '2026-11-12T11:56:38Z').commits) !== null)
pruefe('3565: ganzer Verlauf -> frei', sperre('3565', '2099-12-31T00:00:00Z') === null)
pruefe('3566: „ändern“ mit Klammerzusatz, nur der erste Commit -> gesperrt', gesperrt('3566', '2026-11-12T11:57:16Z'))
pruefe('3566: „ok“ für ecd45321e bei Kopf b578fde90 (veraltet) -> weiter gesperrt', prueferSperre(bis('3566', '2026-11-12T12:38:19Z').comments, bis('3566', '2026-11-12T11:57:16Z').commits) !== null)
pruefe('3566: ganzer Verlauf -> frei', sperre('3566', '2099-12-31T00:00:00Z') === null)

console.log('pr-nachrechnen-pruefer: Stufe 0, Reihenfolge, Grenzen')
const kopf = { oid: 'a'.repeat(40), committedDate: '2026-11-12T10:00:00Z' }
const urteil = (wort, zeit, extra = '') => ({ createdAt: zeit, body: `**Prüfer-Review** für aaaaaaaaa - Urteil: **${wort}**${extra}\n\nText` })
pruefe('Stufe 0: nur Prüfstufen-Kommentar -> frei', prueferSperre([{ createdAt: '2026-11-12T10:30:00Z', body: '<!-- pr-stufe -->\n**Prüfstufe 0**' }], [kopf]) === null)
pruefe('keine Kommentare -> frei', prueferSperre([], [kopf]) === null)
pruefe('Felder fehlen -> frei (Stufe 0)', prueferSperre(undefined, undefined) === null)
pruefe('ändern ohne jeden Commit -> gesperrt (fail-closed)', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z')], []) !== null)
pruefe('„aendern“ zählt wie „ändern“', prueferSperre([urteil('aendern', '2026-11-12T10:30:00Z')], [kopf]) !== null)
pruefe('ändern, danach ok für den Kopf -> frei', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), urteil('ok', '2026-11-12T10:40:00Z')], [kopf]) === null)
pruefe('ok, danach ändern -> gesperrt', prueferSperre([urteil('ok', '2026-11-12T10:30:00Z'), urteil('ändern', '2026-11-12T10:40:00Z')], [kopf]) !== null)
pruefe('Reihenfolge der Liste ist egal (Zeitstempel zählt)', prueferSperre([urteil('ändern', '2026-11-12T10:40:00Z'), urteil('ok', '2026-11-12T10:30:00Z')], [kopf]) !== null)
pruefe('„freigegeben“ hebt auf', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), urteil('freigegeben', '2026-11-12T10:40:00Z')], [kopf]) === null)
pruefe('„freigeben“ hebt auf', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), urteil('freigeben', '2026-11-12T10:40:00Z')], [kopf]) === null)
pruefe('unbekanntes Urteilswort („offen“) hebt nicht auf', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), urteil('offen', '2026-11-12T10:40:00Z')], [kopf]) !== null)
pruefe('Commit genau zur Urteilszeit -> gesperrt', prueferSperre([urteil('ändern', '2026-11-12T10:00:00Z')], [kopf]) !== null)
pruefe('Commit eine Sekunde nach dem Urteil -> frei', prueferSperre([urteil('ändern', '2026-11-12T09:59:59Z')], [kopf]) === null)
pruefe('neuester Commit zählt, nicht der letzte der Liste', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z')], [{ oid: 'b'.repeat(40), committedDate: '2026-11-12T11:00:00Z' }, kopf]) === null)
pruefe('Kommentar ohne „Prüfer“ in der ersten Zeile zählt nicht', prueferSperre([{ createdAt: '2026-11-12T10:30:00Z', body: 'Urteil: **ändern**' }], [kopf]) === null)
pruefe('Urteil nicht in der ersten Zeile zählt nicht', prueferSperre([{ createdAt: '2026-11-12T10:30:00Z', body: '**Prüfer-Review** für aaaaaaaaa\n\nUrteil: **ändern**' }], [kopf]) === null)
pruefe('ok ohne Kopfnennung hebt auf', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), { createdAt: '2026-11-12T10:40:00Z', body: 'Prüfer Runde 2: ok' }], [kopf]) === null)
pruefe('ändern für einen anderen Kopf als den jetzigen -> gesperrt (nur „ok“ wird nach Kopf gefiltert)', prueferSperre([{ createdAt: '2026-11-12T10:30:00Z', body: '**Prüfer-Review** für bbbbbbbbb - Urteil: **ändern**' }], [kopf]) !== null)
pruefe('ok für den jetzigen (letzten) Kopf bei zwei Commits hebt auf, ok für den ersten nicht', prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), urteil('ok', '2026-11-12T10:40:00Z')], [{ oid: 'b'.repeat(40), committedDate: '2026-11-12T09:00:00Z' }, kopf]) === null && prueferSperre([urteil('ändern', '2026-11-12T10:30:00Z'), { createdAt: '2026-11-12T10:40:00Z', body: '**Prüfer-Review** für bbbbbbbbb - Urteil: **ok**' }], [{ oid: 'b'.repeat(40), committedDate: '2026-11-12T09:00:00Z' }, kopf]) !== null)
pruefe('urteilAus: Prüfer Runde, Wort klein', JSON.stringify(urteilAus('Prüfer Runde 2: Ändern (klein)')) === '{"wort":"ändern","kopf":null}')
pruefe('urteilAus: Prüfer-Review mit Kopf', JSON.stringify(urteilAus('**Prüfer-Review** für 4c7d9c2e4 - Urteil: **ok**')) === '{"wort":"ok","kopf":"4c7d9c2e4"}')
pruefe('urteilAus: kein Prüfer / kein Urteil -> null', urteilAus('Urteil: ok') === null && urteilAus('## Nachtrag (Prüfer-Runde 1)') === null && urteilAus(undefined) === null)

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-pruefer: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-nachrechnen-pruefer: alle Fälle grün (Prüfer-Sperre, Fixture 3393/3398/3565/3566)')
