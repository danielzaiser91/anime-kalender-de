/**
 * Test für tools/worker-rohfolgen-rettung.ts: Wiederöffnen genau des Fensters (alle drei Quellen, Grenzen eingeschlossen),
 * der echte Zuordner gegen Kopie und Kulisse, und das dreiseitige Mischen.
 *
 * Aufruf: `npx tsx tools/worker-rohfolgen-rettung.test.ts`
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { mische, oeffneFenster, uebernimm, workerAusKopie, zuordnerLauf } from './worker-rohfolgen-rettung.ts'
import { neueDatenbank } from './worker-titelzeile-hilfe.ts'

const ANIME = 'https://www.netflix.com/title/777'
const FREMD = 'https://www.netflix.com/title/999'
const TITEL = 'https://www.netflix.com/title/888'
const FENSTER = { von: '2026-10-16T19:28:00Z', bis: '2026-10-16T20:05:02Z' }
const TITEL_ID = 2_000_000_000 + 10_000_000_000 + 100_000 + 2

const db = neueDatenbank()
const prime = db.prepare(
  "INSERT INTO prime_folge (id, url, nummer, titel, sprachen, gemeldet_am, uebernommen, plattform) VALUES (?, ?, ?, ?, '[\"Deutsch\"]', ?, ?, 'netflix')",
)
prime.run(1, ANIME, 1, 'Folge 1', '2026-10-16T19:00:00Z', 1)
prime.run(2, ANIME, 2, 'Folge 2', '2026-10-16T19:40:00Z', 1)
prime.run(3, ANIME, 3, 'Folge 3', '2026-10-16T21:00:00Z', 0)
prime.run(4, FREMD, 1, 'Fremd 1', '2026-10-16T20:00:00Z', 1)
prime.run(5, ANIME, 5, 'Folge 5', FENSTER.bis, 1)
prime.run(6, ANIME, 6, 'Folge 6', FENSTER.von, 1)
const meldung = db.prepare(
  "INSERT INTO pruefung (id, plattform, url, befund, gemeldet_am, roh_uebernommen, rohfolge) VALUES (?, 'netflix', ?, 'dub', ?, ?, ?)",
)
const roh = JSON.stringify({ url: ANIME, nummer: 4, titel: 'Folge 4', sprachen: '["Deutsch"]', plattform: 'netflix' })
meldung.run(1, ANIME, '2026-10-16T19:10:00Z', 1, roh)
meldung.run(2, ANIME, '2026-10-16T19:50:00Z', 1, roh)
meldung.run(3, ANIME, '2026-10-16T19:51:00Z', null, null)
meldung.run(4, ANIME, '2026-10-16T21:10:00Z', 0, roh)
meldung.run(5, ANIME, '2026-10-16T21:20:00Z', null, null)
const eintrag = (n: number, am: string, rohUeb: 0 | 1) => [1, n, `F${n}`, `gti-${n}`, ['de'], 'ja', 'ja', 'serie', null, am, 1, rohUeb, null, 0]
const f = [
  eintrag(1, '2026-10-16T19:00:00Z', 1),
  eintrag(2, '2026-10-16T19:45:00Z', 1),
  eintrag(4, FENSTER.bis, 1),
  eintrag(3, '2026-10-16T21:00:00Z', 0),
  eintrag(5, FENSTER.von, 1),
]
const daten = { s: null, t: 'Titelzeile', st: null, f }
db.prepare("INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_rohfolge) VALUES (?, 'netflix', 1, ?, '2026-10-16T21:00:00Z', 1)").run(TITEL, JSON.stringify(daten))

// Wiederöffnen: im Fenster samt beiden Grenzen auf, danach zu, davor unverändert; null bleibt null.
assert.deepEqual(oeffneFenster(db, FENSTER), { prime: 4, meldung: 1, titel: 3, zu: 3 })
const offenPrime = db.prepare('SELECT id FROM prime_folge WHERE uebernommen = 0 ORDER BY id').all().map((z) => z.id)
assert.deepEqual(offenPrime, [2, 4, 5, 6])
const meldungen = db.prepare('SELECT id, roh_uebernommen AS r FROM pruefung ORDER BY id').all().map((z) => [z.id, z.r])
assert.deepEqual(meldungen, [[1, 1], [2, 0], [3, null], [4, 1], [5, null]])
const tz = JSON.parse(String(db.prepare('SELECT daten FROM titel_zeile').get()!.daten)) as { f: unknown[][] }
assert.deepEqual(tz.f.map((e) => e[11]), [1, 0, 0, 1, 0])
assert.equal(db.prepare('SELECT offen_rohfolge AS n FROM titel_zeile').get()!.n, 3)

// Die Attrappe beantwortet nur Rohfolgen-Seiten mit dem eigenen Token.
const probe = workerAusKopie(db, 'x')
await assert.rejects(probe.fetch('https://w.test/pruefung?rohfolgen=1&token=falsch'))
await assert.rejects(probe.fetch('https://w.test/anderes?rohfolgen=1&token=x'))
await assert.rejects(probe.fetch('https://w.test/pruefung?rohfolgen=0&token=x'))
type Seite = { folgen: { id: number; serientitel: string | null }[] }
const holeSeite = async (nach: number) => (await (await probe.fetch(`https://w.test/pruefung?rohfolgen=1&nach=${nach}&token=x`)).json()) as Seite
const seite = await holeSeite(0)
assert.deepEqual(seite.folgen.map((g) => g.id).sort((a, b) => a - b), [2, 4, 5, 6, 1_000_000_002, TITEL_ID, TITEL_ID + 2, TITEL_ID + 3])
assert.equal(seite.folgen.find((g) => g.id === TITEL_ID)?.serientitel, 'Titelzeile')
assert.ok(!(await holeSeite(4)).folgen.some((g) => g.id <= 4))

// Dreiseitig: neu (b, d) kommt, ein später geänderter Schlüssel (c) bleibt, Unverändertes (a) zählt nicht.
const m = mische({ a: 1, b: 2, c: 3 }, { a: 1, b: 20, c: 30, d: 4 }, { a: 1, b: 2, c: 33, e: 5 })
assert.deepEqual(m.ergebnis, { a: 1, b: 20, c: 33, e: 5, d: 4 })
assert.deepEqual(m.neu, ['b', 'd'])
assert.deepEqual(m.spaeterGeaendert, ['c'])

// Der echte Zuordner gegen Kopie und Kulisse; danach in ein Ziel mit späterem Stand mischen.
const ordner = mkdtempSync(join(tmpdir(), 'rohfolgen-rettung-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(ordner, pfad)), { recursive: true })
  writeFileSync(join(ordner, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
const ALT = { titleId: 1, plattform: 'netflix', folgen: [{ sprachen: ['de'] }] }
const SPAETER = { titleId: 2, plattform: 'netflix', folgen: [{ sprachen: ['de'] }] }
try {
  schreibe('kulisse/public/data/titles.json', [{ id: 7, titleDe: 'Kulissen-Anime', streams: [{ platform: 'netflix', url: ANIME }] }])
  schreibe('kulisse/public/data/cartoons.json', [])
  schreibe('kulisse/data/dub-confirmed.yaml', '[]\n')
  // Eine aniSearch-Liste als Anker: Die Folgen treffen sie nicht, die Adresse trägt den Titel trotzdem (gleiche Tonspuren).
  schreibe('kulisse/data/anisearch.json', { 7: { anisearchId: 1 } })
  schreibe('kulisse/data/anisearch-folgen.json', { 1: { folgen: [{ nr: 1, de: 'Ein Anfang' }, { nr: 2, de: 'Ein Ende' }] } })
  schreibe('kulisse/data/prime-zugeordnet.json', { 'alt#1': ALT })
  schreibe('ziel/data/prime-zugeordnet.json', { 'alt#1': ALT, 'spaeter#1': SPAETER })
  const lauf = await zuordnerLauf(join(ordner, 'kulisse'), db)
  assert.equal(lauf.stand.seiten, 1)
  const gerettet = lauf.nachher[0] as Record<string, { titleId: number; folgen: unknown[] }>
  assert.equal(gerettet[ANIME]?.titleId, 7)
  const [bericht] = uebernimm(join(ordner, 'ziel'), lauf)
  assert.deepEqual(bericht!.neu, [ANIME])
  assert.deepEqual(bericht!.vorher, { adressen: 2, folgen: 2 })
  assert.deepEqual(bericht!.nachher, { adressen: 3, folgen: 2 + gerettet[ANIME]!.folgen.length })
  const ziel = JSON.parse(readFileSync(join(ordner, 'ziel/data/prime-zugeordnet.json'), 'utf8'))
  assert.deepEqual(Object.keys(ziel), ['alt#1', 'spaeter#1', ANIME])
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('rohfolgen-rettung.test: ok')
