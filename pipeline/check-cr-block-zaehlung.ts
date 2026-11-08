/**
 * Wächter: Ein laufender Crunchyroll-Wochentermin bekommt die Tage seiner deutschen Folgen aus dem Katalog,
 * auch wenn der Block fortlaufend nummeriert ist oder die Serie unter zwei Adressen steht.
 *
 * Anlass (08.11.2026, Daniel): „≈ Fg. 1–3“ an der Pille der Apothekerin Staffel 3. Der Katalog führte die Folgen 1–3 einzeln
 * (Nummern 49–51, Stelle im Block 1–3), die Beobachtung nannte Folge 2 — die Paarung suchte nur über die Nummer und fand keinen Block.
 * Zweite Ursache an „As a Reincarnated Aristocrat“ Staffel 3: Die Serie steht mit und ohne `/de/` im Katalog, der ältere Abruf (1 Folge) verdeckte den frischen (3).
 * Stempel, Nummern und Adressen wörtlich aus `data/crunchyroll-dub.json` (Stand 08.11.2026). Aufruf: npx tsx pipeline/check-cr-block-zaehlung.ts
 */
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cr-block-zaehlung-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { beobachtungenAusBlock, reichsteSerieJeKennung } = await import('./lib/crunchyroll-termine.ts')
const { legeCrVerweiseUndTermineAn } = await import('./bau/09-4-4-termine.ts')
type Serie = import('./lib/crunchyroll-dub.ts').CrSerie
type Release = import('../shared/types.ts').Release

const folge = (nummer: number, laufend: number, verfuegbarAb: string) => ({ nummer, laufend, guid: `g${nummer}-${verfuegbarAb}`, verfuegbarAb })
const block = (name: string, ...folgen: ReturnType<typeof folge>[]) => ({ name, folgen: folgen.length, kacheln: folgen.length, deutsch: folgen.length, fremd: 0, deutscheFolgen: folgen })

const APO = 'https://www.crunchyroll.com/de/series/G3KHEVDJ7/the-apothecary-diaries'
const apothekerin = {
  url: APO,
  seriesId: 'G3KHEVDJ7',
  katalog: 'de',
  staffeln: [
    block('Die Tagebücher der Apothekerin', folge(1, 1, '2023-11-18T14:00:00Z'), folge(2, 2, '2023-11-18T14:00:00Z'), folge(3, 3, '2023-11-18T14:00:00Z')),
    block('Die Tagebücher der Apothekerin Staffel 2', folge(25, 1, '2025-01-31T14:00:00Z'), folge(26, 2, '2025-02-07T14:00:00Z'), folge(27, 3, '2025-02-14T14:00:00Z')),
    block('Die Tagebücher der Apothekerin Staffel 3', folge(49, 1, '2026-10-23T15:00:00Z'), folge(50, 2, '2026-10-30T15:00:00Z'), folge(51, 3, '2026-11-06T16:00:00Z')),
  ],
} as unknown as Serie

/* Der Anlassfall: Beobachtet ist nur Folge 2 (30.10.), die Nummern des Blocks lauten 49–51. */
const neu = beobachtungenAusBlock(apothekerin, { 2: '2026-10-30' })
pruefe('Apothekerin Staffel 3: Folge 1 und 3 kommen aus dem Block, in der Zählung des Blocks', neu[1] === '2026-10-23' && neu[3] === '2026-11-06' && Object.keys(neu).length === 2, neu)
pruefe('keine Nummer des Blocks (49–51) landet im Ergebnis', neu[49] === undefined && neu[51] === undefined, neu)
pruefe('eine Beobachtung schlägt den Katalog: Folge 2 bleibt unberührt', neu[2] === undefined, neu)

/* Gegenproben: Nummern gewinnen, wo sie zum Tag passen; Mehrdeutigkeit liefert nichts. */
const bisher = { url: 'x', seriesId: 'X', katalog: 'de', staffeln: [block('S1', folge(1, 1, '2026-04-04T10:00:00Z'), folge(2, 2, '2026-04-11T10:00:00Z'), folge(9, 9, '2026-05-30T10:00:00Z'))] } as unknown as Serie
pruefe('Nummer und Stelle fallen zusammen: wie bisher', beobachtungenAusBlock(bisher, { 9: '2026-05-30' })[1] === '2026-04-04')
const nummerVorStelle = { url: 'x', seriesId: 'X', katalog: 'de', staffeln: [block('S1', folge(2, 7, '2026-04-11T10:00:00Z'), folge(3, 8, '2026-04-18T10:00:00Z'), folge(7, 9, '2026-05-02T10:00:00Z'))] } as unknown as Serie
pruefe('Nummer passt zum Tag, die Stelle nicht: die Nummer zählt', beobachtungenAusBlock(nummerVorStelle, { 2: '2026-04-11' })[3] === '2026-04-18')
const zwei = { url: 'x', seriesId: 'X', katalog: 'de', staffeln: [block('S1', folge(5, 1, '2026-04-04T10:00:00Z'), folge(6, 2, '2026-04-11T10:00:00Z')), block('S2', folge(7, 1, '2026-04-04T10:00:00Z'), folge(8, 2, '2026-04-11T10:00:00Z'))] } as unknown as Serie
pruefe('zwei Blöcke tragen dieselbe Beobachtung (Stelle 2, gleicher Tag): nichts wird geraten', Object.keys(beobachtungenAusBlock(zwei, { 2: '2026-04-11' })).length === 0)
pruefe('Beobachtung mit anderem Tag als jeder Block: nichts', Object.keys(beobachtungenAusBlock(apothekerin, { 2: '2026-10-31' })).length === 0)
pruefe('Katalog nicht deutsch: nichts', Object.keys(beobachtungenAusBlock({ ...apothekerin, katalog: 'us' } as Serie, { 2: '2026-10-30' })).length === 0)

/* Dieselbe Serie unter zwei Adressen: der Eintrag mit den meisten datierten Folgen gilt, gleich in welcher Reihenfolge. */
const ARI = 'https://www.crunchyroll.com/de/series/GG5H5XQMD/as-a-reincarnated-aristocrat-ill-use-my-appraisal-skill-to-rise-in-the-world'
const ARI_ALT = 'https://www.crunchyroll.com/series/GG5H5XQMD/as-a-reincarnated-aristocrat-ill-use-my-appraisal-skill-to-rise-in-the-world'
const staffel3 = (...f: ReturnType<typeof folge>[]) => block('Staffel 3', ...f)
const ariFrisch = { url: ARI, seriesId: 'GG5H5XQMD', katalog: 'de', staffeln: [staffel3(folge(1, 1, '2026-10-18T15:00:00Z'), folge(2, 2, '2026-10-25T15:00:00Z'), folge(3, 3, '2026-11-01T16:00:00Z'))] } as unknown as Serie
const ariAlt = { url: ARI_ALT, seriesId: 'GG5H5XQMD', katalog: 'de', staffeln: [staffel3(folge(1, 1, '2026-10-18T15:00:00Z'))] } as unknown as Serie
pruefe('Doppelte Kennung, frischer Eintrag zuerst: er gilt', reichsteSerieJeKennung([ariFrisch, ariAlt]).get('GG5H5XQMD')?.url === ARI)
pruefe('Doppelte Kennung, frischer Eintrag zuletzt: er gilt', reichsteSerieJeKennung([ariAlt, ariFrisch]).get('GG5H5XQMD')?.url === ARI)
pruefe('Eintrag ohne deutschen Katalog oder ohne Kennung zählt nicht', reichsteSerieJeKennung([{ ...ariFrisch, katalog: 'us' } as Serie, { ...ariAlt, seriesId: undefined } as Serie]).size === 0)

function wochenRelease(slug: string, url: string, beobachtet: Record<number, string>, erster: string, mehr: Record<string, unknown> = {}): Release {
  return {
    slug,
    titleId: 195516,
    name: 'x',
    platform: 'crunchyroll',
    platformUrl: url,
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: erster, time: '17:00', episodeCount: 12, observed: beobachtet, ...mehr },
  } as unknown as Release
}

/* Die Bau-Phase: Release mit einer beobachteten Folge bekommt die übrigen Tage; die Kennung mit zwei Adressen wird mit dem frischen Eintrag gerechnet. */
function phase(serien: Serie[], url: string, beobachtet: Record<number, string>, erster: string) {
  const title = { id: 195516, titleEn: 'x', jpYear: 2026, format: 'TV', streams: [{ platform: 'crunchyroll', url, dub: true }] }
  const releases = [wochenRelease('x-crunchyroll', url, beobachtet, erster)]
  const log = console.log
  console.log = () => undefined
  try {
    legeCrVerweiseUndTermineAn({
      titles: new Map([[title.id, title as never]]),
      anisearch: {},
      belegt: 0,
      crDub: { serien } as never,
      verschwunden: 0,
      usNeinOffen: 0,
      nachUrl: new Map([[url, [title as never]]]),
      releases,
      jetzt: Date.parse('2026-11-08T05:00:00Z'),
    })
  } finally {
    console.log = log
  }
  return releases.find((r) => r.slug === 'x-crunchyroll')?.schedule.observed
}
const apo = phase([apothekerin], APO, { 2: '2026-10-30' }, '2026-10-23')
pruefe('Phase Apothekerin Staffel 3: observed trägt Folge 1, 2, 3 (kein „≈“)', JSON.stringify(apo) === JSON.stringify({ 1: '2026-10-23', 2: '2026-10-30', 3: '2026-11-06' }), apo)
const ariA = phase([ariFrisch, ariAlt], ARI, { 1: '2026-10-18' }, '2026-10-18')
pruefe('Phase Aristocrat Staffel 3 (frischer Eintrag zuerst): Folge 2 und 3 nachgetragen', ariA?.[2] === '2026-10-25' && ariA?.[3] === '2026-11-01', ariA)
const ariB = phase([ariAlt, ariFrisch], ARI, { 1: '2026-10-18' }, '2026-10-18')
pruefe('Phase Aristocrat Staffel 3 (älterer Eintrag zuerst): dasselbe Ergebnis', ariB?.[2] === '2026-10-25' && ariB?.[3] === '2026-11-01', ariB)

/* Die Bestandswache: dieselbe Lage als Befund, unabhängig von der Paarung über den Starttag des Blocks. */
const { schaetzungTrotzKatalog } = await import('./lib/cr-katalog-schaetzung.ts')
const JETZT = new Date('2026-11-08T12:00:00Z')
const apoRelease = (beobachtet: Record<number, string>, erster = '2026-10-23', mehr: Record<string, unknown> = {}) =>
  wochenRelease('apothecary-diaries-s3-cour1', APO, beobachtet, erster, mehr)
const offen = (r: Release, serien: Serie[] = [apothekerin], jetzt = JETZT) => schaetzungTrotzKatalog([r], serien, jetzt).map((o) => o.folge).sort()
pruefe('Wache: der Datensatz vom 08.11. (nur Folge 2 beobachtet) meldet Folge 1 und 3', offen(apoRelease({ 2: '2026-10-30' })).join() === '1,3', offen(apoRelease({ 2: '2026-10-30' })))
pruefe('Wache: mit allen drei Tagen ist nichts offen', offen(apoRelease({ 1: '2026-10-23', 2: '2026-10-30', 3: '2026-11-06' })).length === 0)
pruefe('Wache: ohne Beobachtung ist es eine Ankündigung, nichts offen', offen(apoRelease({})).length === 0)
pruefe('Wache: Starttag ohne Block in einem Tag Abstand: nichts offen', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-20')).length === 0)
pruefe('Wache: Starttag einen Tag neben dem Block gilt noch', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-24')).join() === '1,3')
pruefe('Wache: Folge 3 trägt am 06.11. 16:00 UTC einen Stempel in der Zukunft: erst ab 16:00 offen', offen(apoRelease({ 2: '2026-10-30' }), [apothekerin], new Date('2026-11-06T15:00:00Z')).join() === '1')
pruefe('Wache: zwei Blöcke am Starttag: nichts wird geraten', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-23'), [{ ...apothekerin, staffeln: [...apothekerin.staffeln!, block('Doppelgänger', folge(60, 1, '2026-10-23T15:00:00Z'))] } as Serie]).length === 0)
pruefe('Wache: Eintrag mit Wochentermin ohne Serie im Katalog: nichts offen', offen(apoRelease({ 2: '2026-10-30' }), []).length === 0)
pruefe('Wache: Starttag zwei Tage vor dem Block: nichts offen (Toleranz genau ein Tag)', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-21')).length === 0)
pruefe('Wache: Starttag zwei Tage nach dem Block: nichts offen', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-25')).length === 0)
/* Der Termin liegt vor dem Stempel (16:00 Berlin gegen 17:00): Folge 3 ist als Termin erschienen, der Katalog führt sie noch nicht. */
pruefe('Wache: Termin erschienen, Katalogstempel noch in der Zukunft: Folge 3 nicht gemeldet', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-23', { time: '16:00' }), [apothekerin], new Date('2026-11-06T15:30:00Z')).join() === '1')
pruefe('Wache: Stempel da, Termin noch nicht erschienen (23:00): Folge 3 nicht gemeldet', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-23', { time: '23:00' }), [apothekerin], new Date('2026-11-06T17:00:00Z')).join() === '1')
pruefe('Wache: ohne Beobachtung, Termin als geschätzt markiert: Ankündigung, nichts offen', offen(apoRelease({}, '2026-10-23', { estimated: true })).length === 0)
pruefe('Wache: abgeschlossener Termin (letzte Folge belegt): nichts offen', offen(apoRelease({ 2: '2026-10-30' }, '2026-10-23', { lastEpisodeDate: '2026-11-06', episodeCount: 3 })).length === 0)
const nummerNeuStelleAnders = { url: APO, seriesId: 'G3KHEVDJ7', katalog: 'de', staffeln: [block('S1', folge(2, 7, '2026-04-11T10:00:00Z'), folge(3, 8, '2026-04-18T10:00:00Z'), folge(4, 9, '2026-04-25T10:00:00Z'))] } as unknown as Serie
const nummerRelease = () => wochenRelease('nummer-vor-stelle', APO, { 2: '2026-04-11' }, '2026-04-11', { time: '12:00', episodeCount: 4 })
pruefe('Wache: der Block zählt nach Crunchyrolls Nummer (2–4), nicht nach der Stelle (7–9): Folge 3 und 4 gemeldet', offen(nummerRelease(), [nummerNeuStelleAnders], new Date('2026-05-01T12:00:00Z')).join() === '3,4', offen(nummerRelease(), [nummerNeuStelleAnders], new Date('2026-05-01T12:00:00Z')))

/* Paarung: Weichen, die ein einzelner Fall nicht zeigt. */
const tagGleich = '2026-04-11T10:00:00Z'
const beideZaehlungen = { url: 'x', seriesId: 'X', katalog: 'de', staffeln: [block('S1', folge(2, 2, tagGleich), folge(3, 5, '2026-04-18T10:00:00Z'), folge(4, 6, '2026-04-25T10:00:00Z'))] } as unknown as Serie
pruefe('Paarung: passen Nummer und Stelle zum selben Block, gilt die Nummer (Folge 3 und 4, nicht 5 und 6)', Object.keys(beobachtungenAusBlock(beideZaehlungen, { 2: '2026-04-11' })).join() === '3,4', beobachtungenAusBlock(beideZaehlungen, { 2: '2026-04-11' }))
pruefe('Paarung: eine abweichende zweite Beobachtung verwirft den Block', Object.keys(beobachtungenAusBlock(apothekerin, { 2: '2026-10-30', 3: '2026-11-07' })).length === 0)
const gleichviel = (url: string, folgen: ReturnType<typeof folge>[]) => ({ url, seriesId: 'G', katalog: 'de', staffeln: [block('S', ...folgen)] }) as unknown as Serie
const eins = gleichviel('https://a.example/erster', [folge(1, 1, '2026-10-18T15:00:00Z')])
const zweiter = gleichviel('https://a.example/zweiter', [folge(1, 1, '2026-10-18T15:00:00Z')])
pruefe('Doppelte Kennung, gleich viele Folgen: der erste Eintrag bleibt, in beiden Reihenfolgen', reichsteSerieJeKennung([eins, zweiter]).get('G')?.url === eins.url && reichsteSerieJeKennung([zweiter, eins]).get('G')?.url === zweiter.url)

if (verletzt) {
  console.error(`check-cr-block-zaehlung: ${verletzt} von ${faelle} Fällen verletzt`)
  process.exit(1)
}
console.log(`check-cr-block-zaehlung: ok (${faelle} Fälle: Zählung nach Nummer und nach Stelle im Block, doppelte Kennung, Bau-Phase)`)
