// Test für tools/heute-neu.mjs: reine Funktionen mit kleinen Fixtures, dazu ein Prozesslauf gegen ein Wegwerf-Repo mit echtem git.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  baueBericht, berlinMitternacht, erzeuge, findeBasis, heuteBerlin, holeQueue, katalogNeu, meldungenNeu, newsDesTages, queueMitDaten, synchroAnbieter,
  textZeilen, vergleicheTermine, vergleicheTitel, vorschlaegeDesTages,
} from './heute-neu.mjs'

// Mitternacht Berlin: Winter +01:00, Sommer +02:00, Umstelltage (Nacht-Umstellung erst 02:00/03:00)
assert.equal(berlinMitternacht('2026-11-08'), '2026-11-08T00:00:00+01:00')
assert.equal(berlinMitternacht('2026-07-01'), '2026-07-01T00:00:00+02:00')
assert.equal(berlinMitternacht('2026-10-25'), '2026-10-25T00:00:00+02:00')
assert.equal(berlinMitternacht('2026-10-26'), '2026-10-26T00:00:00+01:00')
assert.equal(berlinMitternacht('2026-03-29'), '2026-03-29T00:00:00+01:00')
// 23:30 UTC am 7.11. ist in Berlin schon der 8.11.
assert.equal(heuteBerlin(new Date('2026-11-07T23:30:00Z')), '2026-11-08')
assert.equal(heuteBerlin(new Date('2026-11-08T22:59:00Z')), '2026-11-08')

const t = (id, extra = {}) => ({ id, titleDe: `T${id}`, format: 'TV', jpYear: 2026, dubConfidence: 'unknown', streams: [], ...extra })
const prime = (dub) => ({ platform: 'prime', ...(dub === undefined ? {} : { dub }) })

assert.deepEqual([...synchroAnbieter(t(1, { streams: [prime(undefined), { platform: 'netflix', dub: false }] }))], [])
assert.deepEqual([...synchroAnbieter(t(1, { streams: [prime(true)], deErstausgabe: { synchro: true } }))].sort(), ['disc', 'prime'])

const alt = [
  t(1, { streams: [prime(true)] }),
  t(2),
  t(3, { dubConfidence: 'unknown' }),
  t(4, { streams: [prime(true)] }),
  t(6, { streams: [{ platform: 'netflix', dub: true }] }),
]
const neu = [
  t(1, { streams: [prime(undefined)] }), // Synchro verloren
  t(2, { streams: [prime(undefined)] }), // neuer Weg ohne Sprache: keine Synchro
  t(3, { dubConfidence: 'confirmed', streams: [{ platform: 'crunchyroll', dub: true }] }), // neue Synchro
  t(4, { streams: [prime(true)] }), // unverändert
  t(5, { streams: [prime(undefined)] }), // neuer Titel nur mit Prime ohne Sprache
  t(7, { streams: [{ platform: 'netflix', dub: true }] }), // neuer Titel mit Synchro
  t(6, { streams: [{ platform: 'netflix', dub: true }, { platform: 'disneyplus', dub: false }] }), // neuer Weg mit Sprache
]
const v = vergleicheTitel(alt, neu)
assert.deepEqual(v.neu.map((x) => x.id), [5, 7])
assert.deepEqual(v.neuMitSynchro.map((x) => x.id), [7])
assert.deepEqual(v.synchroNeu.map((x) => [x.id, x.bei]), [[3, ['crunchyroll']]])
assert.deepEqual(v.synchroVerloren.map((x) => [x.id, x.bei]), [[1, ['prime']]])
assert.deepEqual(v.wegeOhneSprache.map((x) => [x.id, x.weg]), [[2, 'prime']])
assert.deepEqual(v.wegeNeu.map((x) => [x.id, x.weg, x.dub]), [[3, 'crunchyroll', true], [6, 'disneyplus', false]])
assert.deepEqual(v.entfernt, [])
assert.deepEqual(vergleicheTitel(neu, alt).entfernt.map((x) => x.id), [5, 7])
// nur dubConfidence geändert, keine neue Anbieter-Synchro: zählt als Änderung
assert.equal(vergleicheTitel([t(1, { dubConfidence: 'unknown' })], [t(1, { dubConfidence: 'likely' })]).synchroNeu.length, 1)
assert.equal(vergleicheTitel([t(1)], [t(1)]).synchroNeu.length, 0)

const r = (slug, schedule) => ({ slug, name: slug, platform: 'prime', releaseType: 'weekly', schedule, sources: ['https://x.example/a'] })
const tv = vergleicheTermine([r('a', { episodeCount: 2 }), r('b', { episodeCount: 3 }), r('c', {})], [r('a', { episodeCount: 2 }), r('b', { episodeCount: 4 }), r('c', {}), r('d', { firstEpisodeDate: '2026-11-08', episodeCount: 12 })])
assert.deepEqual(tv.termineNeu.map((x) => [x.slug, x.ab, x.folgen]), [['d', '2026-11-08', 12]])
assert.deepEqual(tv.termineGeaendert.map((x) => x.slug), ['b'])

const news = [{ am: '2026-11-08', titelId: 1, titel: 'A', meldungen: [{ art: 'folgen', platform: 'crunchyroll', von: 3, bis: 3 }] }, { am: '2026-11-07', titelId: 2, titel: 'B', meldungen: [] }]
assert.deepEqual(newsDesTages(news, '2026-11-08').map((n) => n.titel), ['A'])
assert.equal(newsDesTages(news, '2026-11-08')[0].meldungen[0].von, 3)
assert.deepEqual(newsDesTages(news, '2026-11-09'), [])

const mk = (url) => ({ titleId: 1, titel: url, quelle: { url } })
assert.deepEqual(meldungenNeu([mk('u1')], [mk('u1'), mk('u2')]).map((m) => m.url), ['u2'])
assert.deepEqual(meldungenNeu(undefined, []), [])

const prop = { vorschlaege: [{ titel: 'Akira', gelesenAm: '2026-11-08', plattform: 'joyn' }, { titel: 'Alt', gelesenAm: '2026-11-07' }] }
assert.deepEqual(vorschlaegeDesTages(prop, '2026-11-08').map((x) => x.titel), ['Akira'])
assert.deepEqual(vorschlaegeDesTages(undefined, '2026-11-08'), [])

const q = queueMitDaten([
  { number: 1, title: 'Werkzeug', files: [{ path: 'tools/x.mjs' }] },
  { number: 2, title: 'Beleg', files: [{ path: 'data/dub-confirmed.yaml' }, { path: 'tools/y.mjs' }] },
  { number: 3, title: 'Bau', files: [{ path: 'public/data/titles.json' }] },
])
assert.deepEqual(q.map((p) => [p.nummer, p.dateien.length]), [[2, 1], [3, 1]])

// Zusammenbau mit eingespeister lies-Funktion
const VORSCHLAG = ['anime2you', 'extraktion.json'].join('-')
const D = ['public', 'data'].join('/')
const dateien = {
  basis: { 'titles.json': alt, 'releases.json': [], 'meldungen.json': [], 'ohne-synchro.json': [{ id: 50 }] },
  kopf: { 'titles.json': neu, 'releases.json': [r('d', { episodeCount: 1 })], 'news.json': news, 'meldungen.json': [mk('u9')], 'ohne-synchro.json': [{ id: 50 }, { id: 51, titleRomaji: 'Katalog 51' }], [VORSCHLAG]: prop },
}
const lies = (ref, pfad) => JSON.stringify(dateien[ref][pfad.split('/').pop()])
const bericht = baueBericht({ tag: '2026-11-08', basis: 'basis', ref: 'kopf', lies, queue: undefined })
assert.equal(bericht.titel.neu.length, 2)
assert.equal(bericht.termine.termineNeu.length, 1)
assert.equal(bericht.news.length, 1)
assert.equal(bericht.meldungen.length, 1)
assert.equal(bericht.vorschlaege.length, 1)
assert.deepEqual(bericht.katalogNeu.map((x) => x.id), [51])
const zeilen = textZeilen({ ...bericht, basis: 'abcdef1234567' })
assert.match(zeilen[1], /^- 2 neue Titel, 1 davon mit Synchro$/)
assert.match(zeilen[4], /^- 2 neue Wege mit Sprachangabe, 1 neue Wege ohne Sprachangabe/)
assert.match(zeilen.at(-1), /Akira \(joyn\)/)
assert.match(zeilen.join('\n'), /1 neue Katalogeinträge ohne Synchro: Katalog 51/)

// A1: Katalog ohne Synchro
assert.deepEqual(katalogNeu([{ id: 1 }], [{ id: 1 }, { id: 2, titleEn: 'Zwei' }]), [{ id: 2, name: 'Zwei' }])
assert.deepEqual(katalogNeu(undefined, []), [])

// A4: neuer watchLink ist ein Weg ohne Sprachangabe; neuer Trailer wird gemeldet, gleicher nicht
const wl = vergleicheTitel([t(1, { watchLinks: [] })], [t(1, { watchLinks: [{ kind: 'joyn' }] })])
assert.deepEqual(wl.wegeOhneSprache.map((x) => x.weg), ['wl:joyn'])
assert.deepEqual(wl.wegeNeu, [])
const tr = { video: 'abc', sprache: 'de' }
const trv = vergleicheTitel([t(1), t(2, { trailer: tr }), t(3, { trailer: tr })], [t(1, { trailer: tr }), t(2, { trailer: tr }), t(3, { trailer: { video: 'xyz', sprache: 'en' } })])
assert.deepEqual(trv.trailerNeu.map((x) => [x.id, x.sprache]), [[1, 'de'], [3, 'en']])

// A3: Queue — gh-Aufruf mit Limit, Art je PR, Weg bis in die Ausgabe
const ghAufrufe = []
const ghAttrappe = (args) => {
  ghAufrufe.push(args)
  return JSON.stringify([
    { number: 7, title: 'Handbeleg', files: [{ path: 'data/dub-confirmed.yaml' }] },
    { number: 8, title: 'Bau', files: [{ path: 'public/data/titles.json' }, { path: 'data/x.yaml' }] },
    { number: 9, title: 'Werkzeug', files: [{ path: 'tools/a.mjs' }] },
  ])
}
const hq = holeQueue(ghAttrappe)
assert.deepEqual(hq.map((p) => [p.nummer, p.art]), [[7, 'Handdaten'], [8, 'Bau']])
assert.equal(ghAufrufe[0][ghAufrufe[0].indexOf('--limit') + 1], '100')
assert.ok(ghAufrufe[0].includes('open'))
const mitQueue = textZeilen({ ...bericht, basis: 'abcdef1234567', queue: hq })
assert.ok(mitQueue.includes('- Queue: 2 offene PRs mit Datendateien'))
assert.ok(mitQueue.includes('  #7 Handdaten: Handbeleg'))
assert.ok(!textZeilen({ ...bericht, basis: 'abcdef1234567' }).some((z) => z.startsWith('- Queue')))

// Abnahmefall: die Zahlen des Berichts vom 08.11.2026 (8 Prime-Wege ohne Sprache, 2 Lupin, 3 Folgen-Meldungen, 4 Zeitpläne, 1 Verweis, 1 Katalog, 2 Trailer, 5 Vorschläge)
const ids = [1, 2, 3, 4, 5, 6, 7, 8]
const abAlt = [...ids.map((i) => t(i)), t(20, { streams: [prime(true)] }), t(21, { streams: [prime(true)] }), t(30), t(31)]
const abNeu = [
  ...ids.map((i) => t(i, { streams: [prime(undefined)] })),
  t(20, { streams: [prime(undefined)] }),
  t(21, { streams: [prime(undefined)] }),
  t(30, { trailer: tr }),
  t(31, { trailer: tr }),
]
const abTermine = [r('a', { n: 1 }), r('b', { n: 1 }), r('c', { n: 1 }), r('d', { n: 1 }), r('e', { n: 1 })]
const abTermineNeu = [r('a', { n: 2 }), r('b', { n: 2 }), r('c', { n: 2 }), r('d', { n: 2 }), r('e', { n: 1 })]
const abNews = ['A', 'B', 'C'].map((n, i) => ({ am: '2026-11-08', titelId: i, titel: n, meldungen: [{ art: 'folgen' }] }))
const abProp = { vorschlaege: ['Akira', 'Yaiba', 'Yaiba', 'Sakamoto', 'Bride'].map((n) => ({ titel: n, gelesenAm: '2026-11-08' })) }
const ab = {
  basis: { 'titles.json': abAlt, 'releases.json': abTermine, 'meldungen.json': [], 'ohne-synchro.json': [] },
  kopf: { 'titles.json': abNeu, 'releases.json': abTermineNeu, 'news.json': abNews, 'meldungen.json': [mk('minami')], 'ohne-synchro.json': [{ id: 60, titleRomaji: 'Yuusha Party, 2nd Season' }], [VORSCHLAG]: abProp },
}
const abBericht = baueBericht({ tag: '2026-11-08', basis: 'basis', ref: 'kopf', lies: (rf, pfad) => JSON.stringify(ab[rf][pfad.split('/').pop()]), queue: undefined })
assert.equal(abBericht.titel.neu.length, 0)
assert.equal(abBericht.titel.synchroNeu.length, 0)
assert.equal(abBericht.news.length, 3)
assert.equal(abBericht.titel.wegeOhneSprache.length, 8)
assert.equal(abBericht.titel.synchroVerloren.length, 2)
assert.equal(abBericht.termine.termineNeu.length, 0)
assert.equal(abBericht.termine.termineGeaendert.length, 4)
assert.equal(abBericht.meldungen.length, 1)
assert.equal(abBericht.katalogNeu.length, 1)
assert.equal(abBericht.titel.trailerNeu.length, 2)
assert.equal(abBericht.vorschlaege.length, 5)

// Prozess: Wegwerf-Repo, drei Commits an Berliner Tagesgrenzen, Aufruf ohne --basis
const wurzel = mkdtempSync(join(tmpdir(), 'heute-neu-'))
try {
  const g = (args, env = {}) => execFileSync('git', args, { cwd: wurzel, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  g(['init', '-q', '-b', 'main'])
  g(['config', 'user.email', 't@example.com'])
  g(['config', 'user.name', 't'])
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
  const schreibe = (titel, termine) => {
    writeFileSync(join(wurzel, D, 'titles.json'), JSON.stringify(titel))
    writeFileSync(join(wurzel, D, 'releases.json'), JSON.stringify(termine))
    writeFileSync(join(wurzel, D, 'news.json'), JSON.stringify(news))
    writeFileSync(join(wurzel, D, 'meldungen.json'), JSON.stringify([mk('u9')]))
    writeFileSync(join(wurzel, D, 'ohne-synchro.json'), JSON.stringify([]))
    writeFileSync(join(wurzel, 'data', 'proposals', VORSCHLAG), JSON.stringify(prop))
  }
  const commit = (zeit) => {
    g(['add', '-A'])
    g(['commit', '-q', '-m', zeit], { GIT_AUTHOR_DATE: zeit, GIT_COMMITTER_DATE: zeit })
  }
  schreibe(alt, [])
  commit('2026-11-07T23:30:00+01:00') // vor Mitternacht Berlin = Basis
  schreibe(neu, [r('d', { episodeCount: 1 })])
  commit('2026-11-08T00:30:00+01:00')
  const basisHash = g(['rev-parse', 'HEAD~1']).trim()
  assert.equal(findeBasis('2026-11-08', 'HEAD', (a) => g(a)), basisHash)
  // A4: ohne --ref gilt origin/main; A3: --queue läuft bis in die Ausgabe (gh eingespeist)
  g(['update-ref', 'refs/remotes/origin/main', 'HEAD'])
  const ohneRef = erzeuge(['--tag', '2026-11-08', '--queue'], undefined, { git: (a) => g(a), gh: ghAttrappe })
  assert.match(ohneRef, /gegen origin\/main:/)
  assert.match(ohneRef, /- Queue: 2 offene PRs mit Datendateien/)
  const ohneRefJson = JSON.parse(erzeuge(['--tag', '2026-11-08', '--queue', '--json'], undefined, { git: (a) => g(a), gh: ghAttrappe }))
  assert.equal(ohneRefJson.ref, 'origin/main')
  assert.equal(ohneRefJson.queue.length, 2)
  assert.equal(erzeuge(['--tag', '2026-11-08', '--json'], undefined, { git: (a) => g(a) }).includes('"queue"'), false)
  // 22:30 UTC am 7.11. = 23:30 Berlin: der Basis-Commit liegt in UTC noch vor dem 8.11., in Berlin vor dem Tagesbeginn
  const lauf = spawnSync(process.execPath, [join(process.cwd(), 'tools', 'heute-neu.mjs'), '--tag', '2026-11-08', '--ref', 'HEAD', '--json'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  assert.equal(lauf.status, 0, lauf.stderr)
  const aus = JSON.parse(lauf.stdout)
  assert.equal(aus.basis, basisHash)
  assert.deepEqual(aus.titel.neu.map((x) => x.id), [5, 7])
  assert.equal(aus.termine.termineNeu.length, 1)
  const text = spawnSync(process.execPath, [join(process.cwd(), 'tools', 'heute-neu.mjs'), '--tag', '2026-11-08', '--ref', 'HEAD'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  assert.equal(text.status, 0, text.stderr)
  assert.match(text.stdout, /^Heute neu \(2026-11-08\)/)
  assert.match(text.stdout, /- 2 neue Titel, 1 davon mit Synchro/)
  // ohne Commit vor dem Tag: klare Fehlermeldung, Exit ≠ 0
  const leer = spawnSync(process.execPath, [join(process.cwd(), 'tools', 'heute-neu.mjs'), '--tag', '2020-01-01', '--ref', 'HEAD'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  assert.notEqual(leer.status, 0)
  assert.match(leer.stderr, /Kein Commit vor 2020-01-01/)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('heute-neu.test: ok (Mitternacht Berlin, Titel-/Termin-/Meldungsvergleich, Prime ohne dub, Prozess gegen Wegwerf-Repo)')
