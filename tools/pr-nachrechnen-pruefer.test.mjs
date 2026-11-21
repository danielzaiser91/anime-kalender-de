/**
 * Tests für tools/pr-nachrechnen-pruefer.mjs (Merge-Sperre „Prüfer verlangt Änderung“, 12.11.2026).
 * Fixture: eingefrorene Kommentar- und Commit-Listen von PR 3393, 3398, 3565, 3566 (`gh pr view N --json comments,commits`, 12.11.2026,
 * Kommentare auf die erste Zeile gekürzt; das Werkzeug liest nur diese). `bis(pr, zeit)` schneidet den Stand zu einem Zeitpunkt.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { geltendeUrteile, prueferSperre, urteilAus } from './pr-nachrechnen-pruefer.mjs'
import { diffGleich } from './pr-eigener-diff.mjs'

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

// Freigabe übersteht reinen main-Nachzug (21.11.2026). Fixture 4417: Kommentare bis 13:44:05 (MCP get_comments, erste Zeile), Commits ab 0cc9a589e
// (get_commits, committedDate = author.date). 5b524fd12 entstand per update-branch nach dem „ok“ für d2365a8ef. Erfunden ist nur `CI_5B5`: das Urteil,
// das der CI-Prüfer laut Auftrag am neuen Kopf schreibt. Kennungen: K0 vor dem eigenen Commit 047729f1a, danach K1 (nur Merges von main).
console.log('pr-nachrechnen-pruefer: Freigabe bei gleichem eigenem Diff (PR 4417)')
const KENNUNG = {
  '0cc9a589e6d0994e235fd3cc385003047f7dadfb': 'K0',
  b36138a7f73d0fa78c6255c851123334fb80438b: 'K0',
  '047729f1ab45cc409a5d89254b60c88e8cccbd85': 'K1',
  '3eeeaacd9848234fd820fbd9c4ccb4ad5827d6c4': 'K1',
  '68b44e2d3f7babd5980458108962576ed9df6926': 'K1',
  d2365a8efb5295227d3114cecb7f1220496177fa: 'K1',
}
const KOPF_5B5 = '5b524fd12fd98a081860581bf792b6071d9ed953'
const CI_5B5 = { createdAt: '2026-11-21T14:10:00Z', body: '**Prüfer-Review** für 5b524fd12 - Urteil: **aendern, Auflagen offen: Dirigent entscheidet**' }
const INHALT_5B5 = { createdAt: '2026-11-21T14:10:00Z', body: '**Prüfer-Review** für 5b524fd12 - Urteil: **aendern**' }
const abgerufen = []
const gleichMit = (kennung5b5, kommits = PR['4417'].commits) => diffGleich((sha) => {
  abgerufen.push(sha)
  return sha === KOPF_5B5 ? kennung5b5 : (KENNUNG[sha] ?? null)
}, kommits, kommits[kommits.length - 1].oid)
const mit = (extra) => [...PR['4417'].comments, ...extra]
const s4417 = (extra, kennung5b5) => prueferSperre(mit(extra), PR['4417'].commits, gleichMit(kennung5b5))
pruefe('4417 Basis: ohne Diff-Vergleich sperrt das wiederholte „Dirigent entscheidet“ am neuen Kopf (alter Zustand)', prueferSperre(mit([CI_5B5]), PR['4417'].commits) !== null)
pruefe('(1)+(4) 4417: nur main nachgezogen, „ok“ für d2365a8ef gilt am Kopf 5b524fd12 trotz wiederholtem „Dirigent entscheidet“', s4417([CI_5B5], 'K1') === null, s4417([CI_5B5], 'K1'))
pruefe('(1) 4417: auch vor dem CI-Urteil am neuen Kopf frei', s4417([], 'K1') === null)
pruefe('(2) eigener Commit (Diff K2): „ok“ gilt nicht, „Dirigent entscheidet“ sperrt', s4417([CI_5B5], 'K2') !== null)
pruefe('(3) Kennung nicht lesbar (null, z. B. Patch fehlt): „ok“ gilt nicht', s4417([CI_5B5], null) !== null)
pruefe('(5) inhaltliches „aendern“ am diff-gleichen Kopf sperrt trotz „ok“ davor', s4417([INHALT_5B5], 'K1') !== null)
pruefe('(5) inhaltliches „aendern“ bleibt, auch wenn danach noch ein „Dirigent entscheidet“ kommt', s4417([INHALT_5B5, { ...CI_5B5, createdAt: '2026-11-21T14:20:00Z' }], 'K1') !== null)
pruefe('„Dirigent entscheidet“ ohne vorheriges „ok“ sperrt weiter (nichts entschieden)', prueferSperre([{ createdAt: '2026-11-21T14:10:00Z', body: CI_5B5.body }], PR['4417'].commits, gleichMit('K1')) !== null)
pruefe('„Dirigent entscheidet“ am Kopf mit anderem Diff sperrt trotz „ok“ (alter Kopf 0cc9a589e, K0)', s4417([{ ...CI_5B5, body: '**Prüfer-Review** für 0cc9a589e - Urteil: **aendern, Auflagen offen: Dirigent entscheidet**' }], 'K1') !== null)
pruefe('„Dirigent entscheidet“ am jetzigen Kopf nach „ok“ für denselben Kopf zählt nicht', prueferSperre([urteil('ok', '2026-11-12T10:30:00Z'), urteil('aendern, Auflagen offen: Dirigent entscheidet', '2026-11-12T10:40:00Z')], [kopf]) === null)
pruefe('Zusatz nur außerhalb der ersten Zeile zählt nicht als „Dirigent entscheidet“', prueferSperre([urteil('ok', '2026-11-12T10:30:00Z'), { createdAt: '2026-11-12T10:40:00Z', body: '**Prüfer-Review** für aaaaaaaaa - Urteil: **aendern**\n\nDirigent entscheidet' }], [kopf]) !== null)
pruefe('„ok“ für einen Kopf außerhalb der Commit-Liste gilt nicht (diffGleich findet ihn nicht)', prueferSperre([{ createdAt: '2026-11-21T14:00:00Z', body: '**Prüfer-Review** für 999999999 - Urteil: **ok**' }, CI_5B5], PR['4417'].commits, gleichMit('K1')) !== null)
abgerufen.length = 0
const g = gleichMit('K1')
pruefe('diffGleich: jede SHA höchstens einmal abgerufen', g('d2365a8ef') && g('047729f1a') && g('d2365a8ef') && abgerufen.length === 3 && new Set(abgerufen).size === 3, abgerufen)
pruefe('„Dirigent entscheidet“ ohne Kopfnennung nach „ok“ sperrt, auch wenn gleich() alles bejaht', prueferSperre([urteil('ok', '2026-11-12T10:30:00Z'), { createdAt: '2026-11-12T10:40:00Z', body: 'Prüfer Runde 2: aendern, Auflagen offen: Dirigent entscheidet' }], [kopf], () => true) !== null)
pruefe('diffGleich: Kopf nicht unter den Commits -> nie gleich, auch wenn die Kennung passt', diffGleich(() => 'K1', PR['4417'].commits, KOPF_5B5)('999999999') === false)
pruefe('diffGleich: beide Kennungen null gelten nicht als gleich', diffGleich(() => null, PR['4417'].commits, KOPF_5B5)('d2365a8ef') === false)
pruefe('diffGleich: ohne Kopf nie gleich', diffGleich(() => 'K1', PR['4417'].commits, '')('d2365a8ef') === false)
pruefe('geltendeUrteile: 4417 mit K1 endet beim „ok“ für d2365a8ef', geltendeUrteile(mit([CI_5B5]), KOPF_5B5, gleichMit('K1')).at(-1)?.kopf === 'd2365a8ef')

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-pruefer: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-nachrechnen-pruefer: alle Fälle grün (Prüfer-Sperre, Fixture 3393/3398/3565/3566)')
