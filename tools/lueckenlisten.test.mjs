/**
 * Prüft den Rahmen der Lückenlisten (`pipeline/lib/luecken-rahmen.ts`) mit erfundenen Titeln: A/B-Regel, Sortierung nach Stimmen,
 * A + B = Hauptbestand, Geltungsbereich eines Feldes, Termine in Tagen (`sammleTage`).
 */
import assert from 'node:assert/strict'
import { werteFeldAus, feldMarkdown, uebersichtMarkdown, istListeA, A_MIN_STIMMEN } from '../pipeline/lib/luecken-rahmen.ts'
import { sammleTage } from '../pipeline/lib/luecken-kontext.ts'
import { grundOhneBanner } from '../pipeline/lib/banner-luecken.ts'

const titel = (id, extra = {}) => ({ id, titleRomaji: `T${id}`, ...extra })
const alle = [titel(1), titel(2), titel(3), titel(4, { coverImage: 'x' }), titel(5), titel(6)]
const kontext = {
  heute: '2026-10-14',
  stimmen: new Map([[1, 10], [2, A_MIN_STIMMEN], [3, A_MIN_STIMMEN + 500], [4, 5], [5, 20]]),
  tage: new Map([[1, [-91]], [5, [-90]], [6, [181, 180]]]),
  synopsen: {},
  belege: new Map(),
  hqGrund: new Map(),
  banner: {},
  zuordnung: {},
  staffel0: {},
  ak: new Map([[3, 77]]),
  alle,
}
const feld = { datei: 'cover-sd.md', name: 'Cover SD', pflicht: true, fehlt: (t) => (t.coverImage ? undefined : 'kein Cover') }

assert.deepEqual(alle.map((t) => istListeA(t, kontext)), [false, true, true, false, true, true], 'Fenster -90..+180 oder Stimmen >= Schwelle')

const e = werteFeldAus(feld, kontext)
assert.deepEqual(e.a.map((z) => z.t.id), [3, 2, 5, 6], 'A nach Stimmen absteigend')
assert.deepEqual(e.b.map((z) => z.t.id), [1], 'B: nur Titel 1 (4 hat ein Cover)')
assert.equal(e.a.length + e.b.length + 1, alle.length, 'fehlend + vorhanden = Hauptbestand')
assert.equal(e.aGesamt + e.bGesamt, alle.length, 'A + B = Hauptbestand')

const nurTermin = werteFeldAus({ ...feld, gilt: (t, k) => k.tage.has(t.id) }, kontext)
assert.equal(nurTermin.gilt, 3, 'gilt zählt nur Titel mit Termin')
assert.equal(nurTermin.a.length + nurTermin.b.length, 3)

const md = feldMarkdown(e, kontext)
assert.ok(md.indexOf('## Liste A') < md.indexOf('## Liste B'), 'A steht vor B')
assert.ok(md.includes('https://anime-kalender.de/#/woche?t=3)'), 'Link ins Detail-Panel')
assert.ok(uebersichtMarkdown([e], kontext).includes('Stand 2026-10-14'), 'Übersicht trägt das Datum')

const tage = sammleTage(
  [{ titleId: 9, date: '2026-10-15' }],
  [{ titleId: 9, schedule: { firstEpisodeDate: '2026-10-04' } }, { titleId: 8, schedule: {} }],
  '2026-10-14',
)
assert.deepEqual(tage.get(9), [1, -10])
assert.equal(tage.has(8), false)
assert.equal(grundOhneBanner(1, {}, {}, {}), 'keine TMDB-Zuordnung')
assert.equal(grundOhneBanner(1, {}, {}, { 1: {} }), 'Staffel 0 führt kein Standbild ab 1280 px', 'Titel mit Staffel-0-Zuordnung hat eine Zuordnung')
assert.equal(grundOhneBanner(1, {}, { 1: { tmdbId: 5 } }, {}), 'noch nicht abgefragt')
console.log('lueckenlisten.test: ok')
