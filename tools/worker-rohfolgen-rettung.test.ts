/**
 * Test für tools/worker-rohfolgen-rettung.ts: Wiederöffnen je berührter Adresse (alle drei Quellen, Grenzen eingeschlossen,
 * je Folge nur die jüngste Zeile, auch vor dem Fenster), `rette` mit dem echten Zuordner gegen eine kleine Kopie und ein
 * kleines Repo (trocken, zu alte Kopie), `main` als Prozess, das dreiseitige Mischen mit Schrumpf- und Schlüsselform-Schutz,
 * beide Sammlungen und die Bilanz gegen die Log-Zahlen.
 *
 * Aufruf: `npx tsx tools/worker-rohfolgen-rettung.test.ts`
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  abgehaktIn, bilanz, FENSTER, type Fenster, KULISSE, kulisseAusStand, mische, oeffneFenster, optionen, rette, uebernimm, workerAusKopie,
  zugeordnetAusLog, zuordnerLauf,
} from './worker-rohfolgen-rettung.ts'
import { neueDatenbank } from './worker-titelzeile-hilfe.ts'

const ANIME = 'https://www.netflix.com/title/777'
const FREMD = 'https://www.netflix.com/title/999'
const ALT = 'https://www.netflix.com/title/555'
const ROHADR = 'https://www.netflix.com/title/444'
const SEITE = 'https://www.netflix.com/title/333'
const TITEL = 'https://www.netflix.com/title/888'
const TITEL2 = 'https://www.netflix.com/title/889'
const LOG = { geholt: 10, abgehakt: 5, adressen: 2, folgen: 3 }
const F: Fenster = { lauf: 1, von: '2026-10-16T19:28:00Z', bis: '2026-10-16T20:05:20Z', stand: 'x', log: LOG }
const NACH = '2026-10-16T20:05:21Z'
const TITEL_BASIS = 2_000_000_000 + 10_000_000_000 + 100_000
/** Unverwechselbare Folgentitel: Sie treffen die aniSearch-Liste der Kulisse.  */
const NAMEN = ['', 'Morgenrot', 'Sturmflut', 'Nebelwald', 'Glutherz', 'Eisfeuer', 'Sternstaub', 'Mondsee', 'Felsgrat']
const WURZEL = join(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'rohfolgen-rettung-'))

// Die Fenster der roten Läufe stehen fest: Lesebeginn des letzten gelungenen Abhakens bis nach dem letzten Lesen.
assert.deepEqual(FENSTER, [{
  lauf: 38959396065,
  von: '2026-10-16T00:06:06Z',
  bis: '2026-10-16T20:05:20Z',
  stand: '3919eda6455edd6413576f71f59180dfe6e8314f',
  log: { geholt: 23345, abgehakt: 13350, adressen: 1029, folgen: 2771 },
}])

const db = neueDatenbank()
const prime = db.prepare(
  "INSERT INTO prime_folge (id, url, nummer, titel, sprachen, gemeldet_am, uebernommen, plattform) VALUES (?, ?, ?, ?, '[\"Deutsch\"]', ?, ?, 'netflix')",
)
prime.run(1, ANIME, 1, NAMEN[1]!, '2026-10-16T19:00:00Z', 1) // vor dem Fenster, Adresse berührt: wieder offen
prime.run(2, ALT, 1, 'Alt 1', '2026-10-16T19:00:00Z', 1) // vor dem Fenster, Adresse unberührt: bleibt zu
prime.run(3, ANIME, 2, NAMEN[2]!, '2026-10-16T19:40:00Z', 1)
prime.run(4, FREMD, 1, 'Fremd 1', '2026-10-16T20:00:00Z', 1)
prime.run(5, ANIME, 3, NAMEN[3]!, '2026-10-16T21:00:00Z', 0)
prime.run(6, ANIME, 5, NAMEN[5]!, F.bis, 1)
prime.run(7, ANIME, 6, NAMEN[6]!, F.von, 1)
prime.run(8, ALT, 2, 'Alt 2', NACH, 1) // nach dem Fenster: berührt nichts
prime.run(9, FREMD, 2, 'Fremd 2', NACH, 0)
prime.run(10, ANIME, 7, NAMEN[7]!, '2026-10-16T19:10:00Z', 0)
prime.run(11, ROHADR, 1, 'Roh 1', '2026-10-16T19:00:00Z', 1) // berührt über die Adresse der Rohfolge in `pruefung`
prime.run(12, 'https://www.netflix.com/title/555', 1, 'Offen 1', '2026-10-16T19:30:00Z', 0) // im Fenster, aber offen: berührt nichts
// Ältere Fassungen derselben Folge (der Worker löscht abgehakte Zeilen nie): bleiben zu, sonst teilte sich ANIME in url#0/#1.
prime.run(13, ANIME, 2, 'Sturmflut (alte Fassung)', '2026-10-01T10:00:00Z', 1)
prime.run(14, ANIME, 7, 'Mondsee (alte Fassung)', '2026-10-02T10:00:00Z', 1) // jüngste Fassung (10) ist offen
prime.run(15, ANIME, 5, NAMEN[5]!, F.bis, 1) // zeitgleich mit 6: die höhere Kennung ist die jüngste
// Eine Folge ist `asin|gti|nummer`: Andere Kennung oder Nummer ist eine eigene Folge (neben FREMD 4: asin null, gti null, 1).
const primeKennung = db.prepare(
  "INSERT INTO prime_folge (id, url, nummer, titel, sprachen, gemeldet_am, uebernommen, plattform, asin, gti) VALUES (?1, ?2, ?3, 'K' || ?1, '[]', ?4, 1, 'netflix', ?5, ?6)",
)
primeKennung.run(16, FREMD, 1, '2026-10-10T10:00:00Z', 'B2', null)
primeKennung.run(17, FREMD, 1, '2026-10-11T10:00:00Z', null, 'G2')
primeKennung.run(18, FREMD, 3, '2026-10-12T10:00:00Z', null, null)
const meldung = db.prepare(
  "INSERT INTO pruefung (id, plattform, url, befund, gemeldet_am, roh_uebernommen, rohfolge) VALUES (?, 'netflix', ?, 'dub', ?, ?, ?)",
)
const roh = (url: string, nummer = 4) => JSON.stringify({ url, nummer, titel: NAMEN[nummer], sprachen: '["Deutsch"]', plattform: 'netflix' })
meldung.run(1, ANIME, '2026-10-16T19:10:00Z', 1, roh(ANIME, 8))
meldung.run(2, ANIME, '2026-10-16T19:50:00Z', 1, roh(ANIME))
meldung.run(3, ANIME, '2026-10-16T19:51:00Z', null, null)
meldung.run(4, ANIME, '2026-10-16T21:10:00Z', 0, roh(ANIME))
meldung.run(5, ALT, '2026-10-16T19:20:00Z', 1, roh(ALT))
meldung.run(6, SEITE, '2026-10-16T19:55:00Z', 1, roh(ROHADR))
meldung.run(7, ANIME, '2026-10-16T21:20:00Z', null, null)
meldung.run(8, ROHADR, '2026-10-16T19:05:00Z', 1, roh(SEITE))
meldung.run(9, ANIME, '2026-10-01T10:00:00Z', 1, roh(ANIME, 8)) // ältere Fassung von Meldung 1: bleibt zu
// Dasselbe in den Rohfolgen der Meldungen: 10 bis 12 unterscheiden sich von 13 je in einem Teil des Schlüssels.
const rohKennung = (nummer: number, kennung: object) => JSON.stringify({ url: FREMD, nummer, titel: `K${JSON.stringify(kennung)}${nummer}`, plattform: 'netflix', ...kennung })
meldung.run(10, FREMD, '2026-10-10T10:00:00Z', 1, rohKennung(4, { asin: 'B3' }))
meldung.run(11, FREMD, '2026-10-11T10:00:00Z', 1, rohKennung(4, { gti: 'G3' }))
meldung.run(12, FREMD, '2026-10-12T10:00:00Z', 1, rohKennung(5, {}))
meldung.run(13, FREMD, '2026-10-13T10:00:00Z', 1, rohKennung(4, {}))
const eintrag = (n: number, am: string, rohUeb: 0 | 1) => [1, n, `F${n}`, `gti-${n}`, ['de'], 'ja', 'ja', 'serie', null, am, 1, rohUeb, null, 0]
const zeile = db.prepare("INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_rohfolge) VALUES (?, 'netflix', ?, ?, '2026-10-16T21:00:00Z', 1)")
const titelDaten = (f: unknown[]) => JSON.stringify({ s: null, t: 'Titelzeile', st: null, f })
// TITEL2: im Fenster nur ein offener Eintrag, die Adresse gilt nicht als berührt.
zeile.run(TITEL2, 2, titelDaten([eintrag(1, '2026-10-16T19:00:00Z', 1), eintrag(3, '2026-10-16T19:30:00Z', 0), eintrag(2, '2026-10-16T21:00:00Z', 0)]))
zeile.run(TITEL, 1, titelDaten([
  eintrag(1, '2026-10-16T19:00:00Z', 1),
  eintrag(2, '2026-10-16T19:45:00Z', 1),
  eintrag(4, F.bis, 1),
  eintrag(5, F.von, 1),
  eintrag(3, '2026-10-16T21:00:00Z', 0),
]))

// Kopien für `rette`, bevor das Fenster hier geöffnet wird: eine frische und eine, die vor dem Fensterende endet.
const KOPIE = join(ordner, 'kopie.sqlite')
const KOPIE_ALT = join(ordner, 'kopie-alt.sqlite')
db.exec("CREATE TABLE kopie_stand (stand TEXT NOT NULL); INSERT INTO kopie_stand VALUES ('2026-10-17T10:00:00Z')")
db.exec(`VACUUM INTO '${KOPIE}'`)
db.exec("UPDATE kopie_stand SET stand = '2026-10-16T20:05:19Z'")
db.exec(`VACUUM INTO '${KOPIE_ALT}'`)

// Wiederöffnen: je berührter Adresse die jüngste Zeile je Folge bis Fensterende auf (auch davor), danach zu, Unberührtes
// bleibt; null bleibt null.
assert.deepEqual(oeffneFenster(db, F), { adressen: 4, prime: 9, meldung: 7, titel: 4, vorFenster: 11, zu: 5 })
const offenPrime = db.prepare('SELECT id FROM prime_folge WHERE uebernommen = 0 ORDER BY id').all().map((z) => z.id)
assert.deepEqual(offenPrime, [1, 3, 4, 7, 10, 11, 12, 15, 16, 17, 18])
const meldungen = db.prepare('SELECT id, roh_uebernommen AS r FROM pruefung ORDER BY id').all().map((z) => [z.id, z.r])
assert.deepEqual(meldungen, [[1, 0], [2, 0], [3, null], [4, 1], [5, 1], [6, 0], [7, null], [8, 1], [9, 1], [10, 0], [11, 0], [12, 0], [13, 0]])
const tz = (url: string) => JSON.parse(String(db.prepare('SELECT daten FROM titel_zeile WHERE url = ?').get(url)!.daten)) as { f: unknown[][] }
assert.deepEqual(tz(TITEL).f.map((e) => e[11]), [0, 0, 0, 0, 1])
assert.deepEqual(tz(TITEL2).f.map((e) => e[11]), [1, 0, 1])
const offenTitel = db.prepare('SELECT url, offen_rohfolge AS n FROM titel_zeile ORDER BY url').all().map((z) => [z.url, z.n])
assert.deepEqual(offenTitel, [[TITEL, 4], [TITEL2, 1]])

// Die Attrappe beantwortet nur Rohfolgen-Seiten mit dem eigenen Token und zählt Gelesenes und Abgehaktes.
const probe = workerAusKopie(db, 'x')
const ok = { headers: { Authorization: 'Bearer x' } }
await assert.rejects(probe.fetch('https://w.test/pruefung?rohfolgen=1', { headers: { Authorization: 'Bearer falsch' } }))
await assert.rejects(probe.fetch('https://w.test/anderes?rohfolgen=1', ok))
await assert.rejects(probe.fetch('https://w.test/pruefung?rohfolgen=0', ok))
type Seite = { folgen: { id: number; serientitel: string | null }[] }
const holeSeite = async (nach: number) => (await (await probe.fetch(`https://w.test/pruefung?rohfolgen=1&nach=${nach}`, ok)).json()) as Seite
const seite = await holeSeite(0)
const ERWARTET = [
  1, 3, 4, 7, 10, 11, 12, 15, 16, 17, 18,
  1_000_000_001, 1_000_000_002, 1_000_000_006, 1_000_000_010, 1_000_000_011, 1_000_000_012, 1_000_000_013,
  TITEL_BASIS + 1, TITEL_BASIS + 2, TITEL_BASIS + 4, TITEL_BASIS + 5, TITEL_BASIS + 10_000_000_000 + 3,
]
assert.deepEqual(seite.folgen.map((g) => g.id).sort((a, b) => a - b), ERWARTET)
assert.equal(seite.folgen.find((g) => g.id === TITEL_BASIS + 2)?.serientitel, 'Titelzeile')
assert.ok(!(await holeSeite(4)).folgen.some((g) => g.id <= 4))
assert.equal(probe.stand.geholt, ERWARTET.length + ERWARTET.filter((id) => id > 4).length)
// Abhaken (POST) gibt es seit #1407 nicht mehr: Die Attrappe wirft, statt zu schreiben.
await assert.rejects(probe.fetch('https://w.test/pruefung?rohfolgen=1', { ...ok, method: 'POST', body: '{}' }), /unerwarteter Aufruf/)

// Dreiseitig: neu (b, d, x, k) kommt; später geändert (c) oder entfernt (w) bleibt; unverändert Entferntes (h) kommt nicht
// zurück; ein Eintrag mit weniger Folgen (g) wird gemeldet statt übernommen, gleich viele (k) zählen als neu.
const drei = (folgen: number[]) => ({ folgen })
const m = mische(
  { a: 1, b: 2, c: 3, g: drei([1, 2, 3]), h: 9, k: drei([1, 2]), w: 5 },
  { a: 1, b: 20, c: 30, d: 4, g: drei([1]), h: 9, k: drei([3, 4]), w: 50, x: drei([1, 2]) },
  { a: 1, b: 2, c: 33, e: 5, g: drei([1, 2, 3]), k: drei([1, 2]) },
)
assert.deepEqual(m.ergebnis, { a: 1, b: 20, c: 33, e: 5, g: drei([1, 2, 3]), k: drei([3, 4]), d: 4, x: drei([1, 2]) })
assert.deepEqual(m.neu, ['b', 'd', 'k', 'x'])
assert.deepEqual(m.spaeterGeaendert, ['c', 'w'])
assert.deepEqual(m.geschrumpft, ['g'])
assert.deepEqual(m.andereForm, [])
// Schlüsselform: Steht die Adresse heute unter einer anderen Form (`u` gegen `u#0`, `w#0` gegen `w`), bleibt der gerettete
// Schlüssel draußen; derselbe Schlüssel (x#0) und eine heute fehlende Adresse (y#0) kommen.
const formen = mische({ 'x#0': 0 }, { 'x#0': 5, 'u#0': 2, 'y#0': 6, 'v#1': 3, w: 4 }, { u: 0, 'x#0': 0, v: 0, 'w#0': 0 })
assert.deepEqual(formen.andereForm, ['u#0', 'v#1', 'w'])
assert.deepEqual(formen.neu, ['x#0', 'y#0'])
assert.deepEqual(formen.ergebnis, { u: 0, 'x#0': 5, v: 0, 'w#0': 0, 'y#0': 6 })

// Bilanz: jede Log-Zahl neben der der Rettung, mit Vorzeichen.
assert.deepEqual(bilanz(F, { geholt: 12, abgehakt: 5, adressen: 1, folgen: 3 }), [
  { feld: 'geholt', log: 10, rettung: 12, abweichung: 2 },
  { feld: 'abgehakt', log: 5, rettung: 5, abweichung: 0 },
  { feld: 'adressen', log: 2, rettung: 1, abweichung: -1 },
  { feld: 'folgen', log: 3, rettung: 3, abweichung: 0 },
])
const zeilen = ['x', '[pipeline] 954 Cartoon-Adressen zugeordnet, 286 offen', '[pipeline] 1029 Adressen zugeordnet (2771 Folgen), 319 offen', 'y']
assert.deepEqual(zugeordnetAusLog(zeilen), { adressen: 1029, folgen: 2771 })
assert.throws(() => zugeordnetAusLog(['954 Cartoon-Adressen zugeordnet, 286 offen']), /keine Zuordnung/)

// Optionen: ohne Angaben die Standardkopie, alle Fenster, trocken.
assert.deepEqual(optionen([]), { quelle: resolve(WURZEL, 'data/cache/meldungskopie/meldungen.sqlite'), fenster: null, schreiben: false })
assert.deepEqual(optionen(['--fenster', '5', '--kopie', 'a.sqlite', '--schreiben']), { quelle: resolve('a.sqlite'), fenster: 5, schreiben: true })

const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(ordner, pfad)), { recursive: true })
  writeFileSync(join(ordner, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
const lies = (pfad: string) => readFileSync(join(ordner, pfad), 'utf8')
const EINTRAG_ALT = { titleId: 1, plattform: 'netflix', folgen: [{ sprachen: ['de'] }] }
const SPAETER = { titleId: 2, plattform: 'netflix', folgen: [{ sprachen: ['de'] }] }
try {
  // Beide Sammlungen werden gemischt, jede im Format des Zuordners.
  schreibe('beide/data/prime-zugeordnet.json', { p: drei([1]) })
  schreibe('beide/data/prime-kanal-aussortiert.json', { k1: { a: 1 } })
  const beide = uebernimm(join(ordner, 'beide'), {
    vorher: [{ p: drei([1]) }, { k1: { a: 1 } }],
    nachher: [{ p: drei([1, 2]) }, { k1: { a: 1 }, k2: { a: 2 } }],
  }, true)
  assert.deepEqual(beide.map((b) => [b.datei, b.neu]), [['data/prime-zugeordnet.json', ['p']], ['data/prime-kanal-aussortiert.json', ['k2']]])
  assert.equal(lies('beide/data/prime-zugeordnet.json'), JSON.stringify({ p: drei([1, 2]) }))
  assert.equal(lies('beide/data/prime-kanal-aussortiert.json'), JSON.stringify({ k1: { a: 1 }, k2: { a: 2 } }, null, 2))
  // Einträge ohne `folgen` zählen keine Folge.
  assert.deepEqual(beide[1]!.nachher, { adressen: 2, folgen: 0 })
  // Ohne Neues bleibt eine Datei Byte für Byte, wie sie ist.
  const eigen = JSON.stringify({ p: drei([1]) }, null, 4)
  schreibe('ruhig/data/prime-zugeordnet.json', eigen)
  uebernimm(join(ordner, 'ruhig'), { vorher: [{ p: drei([1]) }, {}], nachher: [{ p: drei([1]) }, {}] }, true)
  assert.equal(lies('ruhig/data/prime-zugeordnet.json'), eigen)

  // Die Kulisse eines Stands trägt genau die genannten Pfade dieses Stands (im Werkzeug data/ und public/data/).
  assert.deepEqual(KULISSE, ['data', 'public/data'])
  mkdirSync(join(ordner, 'stand'))
  kulisseAusStand(WURZEL, 'HEAD', join(ordner, 'stand'), ['ZIELE.md', 'data/prime-kanal-aussortiert.json'])
  const ausHead = (pfad: string) => execFileSync('git', ['show', `HEAD:${pfad}`], { cwd: WURZEL }).toString()
  assert.equal(lies('stand/ZIELE.md'), ausHead('ZIELE.md'))
  assert.equal(lies('stand/data/prime-kanal-aussortiert.json'), ausHead('data/prime-kanal-aussortiert.json'))
  assert.throws(() => lies('stand/package.json'))
  assert.throws(() => kulisseAusStand(WURZEL, '0000000000000000000000000000000000000000', join(ordner, 'stand')), /git archive/)
  assert.throws(() => kulisseAusStand(WURZEL, 'HEAD', join(ordner, 'fehlt'), ['ZIELE.md']), /tar/)

  // `rette` gegen ein kleines Repo: die Kulisse im Stand des Laufs committet, heute ein späterer Eintrag dazu. Basis und
  // Ziel tragen ANIME schon (Pflichtfall des Prüfers, Runde 3): die alten Fassungen dürfen ihn nicht in url#0/#1 teilen.
  const BASIS_ANIME = { titleId: 7, plattform: 'netflix', folgen: [{ unsere: 1 }] }
  schreibe('repo/public/data/titles.json', [{ id: 7, titleDe: 'Kulissen-Anime', streams: [{ platform: 'netflix', url: ANIME }] }])
  schreibe('repo/public/data/cartoons.json', [])
  schreibe('repo/public/data/ohne-synchro.json', [])
  schreibe('repo/data/dub-confirmed.yaml', '[]\n')
  // Eine aniSearch-Liste als Anker, deren Folgen die gemeldeten treffen.
  schreibe('repo/data/anisearch.json', { 7: { anisearchId: 1 } })
  schreibe('repo/data/anisearch-folgen.json', { 1: { folgen: [1, 2, 3, 4, 5, 6, 7, 8].map((nr) => ({ nr, de: NAMEN[nr] })) } })
  schreibe('repo/data/prime-zugeordnet.json', { 'alt#1': EINTRAG_ALT, [ANIME]: BASIS_ANIME })
  const repo = join(ordner, 'repo')
  const git = (...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...a], { cwd: repo }).toString().trim()
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'stand')
  const stand = git('rev-parse', 'HEAD')
  // Ein späterer Commit ohne die aniSearch-Folgen: Im Stand von HEAD träfe der Zuordner keine Folge mehr.
  git('rm', '-q', 'data/anisearch-folgen.json')
  git('commit', '-q', '-m', 'heute')
  schreibe('repo/data/prime-zugeordnet.json', { 'alt#1': EINTRAG_ALT, [ANIME]: BASIS_ANIME, 'spaeter#1': SPAETER })
  const unberuehrt = () => [lies('repo/data/prime-zugeordnet.json'), git('status', '--porcelain')]
  const vorher = unberuehrt()

  // Trocken (Standard): zählt und berichtet, schreibt nichts.
  const lauf = await rette({ ...F, stand }, KOPIE, repo, false)
  assert.deepEqual(unberuehrt(), vorher)
  const gerettet = lauf.nachher[0] as Record<string, { titleId: number; folgen: unknown[] }>
  assert.equal(gerettet[ANIME]?.titleId, 7)
  assert.deepEqual(Object.keys(gerettet).filter((k) => k.startsWith(ANIME)), [ANIME])
  // Folge 1 (prime 1) und 8 (Meldung 1) stammen von vor dem Fenster; ohne sie schrumpfte der Eintrag.
  const unsere = gerettet[ANIME]!.folgen.map((f) => (f as { unsere: number }).unsere).sort((a, b) => a - b)
  assert.deepEqual(unsere, [1, 2, 4, 5, 6, 7, 8])
  // Abgehakt werden die sieben Zeilen von ANIME: prime 1, 3, 7, 10, 15 und die Meldungen 1 und 2 (Quittier-Datei).
  assert.deepEqual(lauf.stand, { seiten: 1, geholt: ERWARTET.length, abgehakt: 7, adressen: 1, folgen: 7 })
  const [bericht] = lauf.berichte
  assert.deepEqual([bericht!.neu, bericht!.andereForm, bericht!.geschrumpft], [[ANIME], [], []])
  assert.deepEqual(bericht!.vorher, { adressen: 3, folgen: 3 })
  assert.deepEqual(bericht!.nachher, { adressen: 3, folgen: 2 + gerettet[ANIME]!.folgen.length })

  // Geschrieben wird erst mit `schreiben`.
  uebernimm(repo, lauf, true)
  const ziel = JSON.parse(lies('repo/data/prime-zugeordnet.json'))
  assert.deepEqual(Object.keys(ziel), ['alt#1', ANIME, 'spaeter#1'])
  assert.deepEqual(ziel[ANIME], gerettet[ANIME])

  // Abgehakt zählt die Quittier-Datei; ohne sie (nichts abzuhaken) ist es 0. Erst nach dem Lauf: das Modul legt ROOT fest.
  schreibe('abhaken/data/cache/quittung-offen/rohfolgen-abhaken.json', [5, 6, 8])
  assert.equal(await abgehaktIn(join(ordner, 'abhaken')), 3)
  assert.equal(await abgehaktIn(join(ordner, 'leer')), 0)

  // Eine Kopie, die vor dem Fensterende endet, kennt nicht alles, was der Lauf sah: Abbruch.
  await assert.rejects(rette({ ...F, stand }, KOPIE_ALT, repo, false), /älter als das Fenster/)
  // Ein zweiter Lauf im selben Prozess schriebe in die erste Kulisse: abgelehnt.
  await assert.rejects(zuordnerLauf(join(ordner, 'beide'), db), /nicht in die Kulisse/)

  // `main` als Prozess: fehlende Kopie, unbekanntes Fenster, und je Fenster ein Kind, das `--schreiben` erbt.
  const starte = (...a: string[]) =>
    spawnSync(process.execPath, [...process.execArgv, join(import.meta.dirname, 'worker-rohfolgen-rettung.ts'), ...a], { cwd: WURZEL, encoding: 'utf8' })
  const fehlt = starte('--kopie', join(ordner, 'fehlt.sqlite'))
  assert.equal(fehlt.status, 1)
  assert.match(fehlt.stderr, /Keine Meldungskopie/)
  assert.match(starte('--kopie', KOPIE, '--fenster', '5').stderr, /kein Fenster 5/)
  const schreibend = starte('--kopie', KOPIE_ALT, '--schreiben')
  assert.equal(schreibend.status, 1)
  assert.match(schreibend.stdout, /Lauf 38959396065 \(schreibt\)/)
  assert.doesNotMatch(schreibend.stdout, /Trocken/)
  assert.match(schreibend.stderr, /älter als das Fenster[\s\S]*Fenster 38959396065 endete mit 1/)
  const trocken = starte('--kopie', KOPIE_ALT)
  assert.match(trocken.stdout, /Trocken: nichts[\s\S]*Lauf 38959396065 \(trocken\)/)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('rohfolgen-rettung.test: ok')
