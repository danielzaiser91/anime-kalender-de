/**
 * Wächter: Ein Joyn-Handtermin verliert das „≈“ genau für die Folgen, deren Abruffenster seinen Tag und seine Uhrzeit trägt.
 *
 * Anlass (10.11.2026, Daniel: „wieso steht bei yaiba immer noch ~“): `yaiba-samurai-legend-joyn` (data/curated/streaming-nachtrag-2026.yaml, Mo–Fr 18:50)
 * trug ab Folge 2 `estimated`, obwohl `setzeJoynFenster` für Folge 1–6 Fenster 18:50 aus den MAXX-Sichtungen hatte. Sichtungen und Folgentitel wie in
 * `check-joyn-hand-tv.ts` (tv-programm.json, TMDB 254017, Stand 08.11.2026). Läuft über den echten Bauschritt (`schreibeSynopsenUndReichereAn`, dann
 * `belegeJoynTermine` mit Ereignissen aus der Zeit vor den Fenstern) gegen einen Wegwerf-Ordner (`AK_ROOT`). Aufruf: npx tsx pipeline/check-joyn-termine-belegt.ts
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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

const wurzel = mkdtempSync(join(tmpdir(), 'joyn-termine-belegt-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [] }))
const FOLGEN = ['Auftritt Yaiba', 'Wiederauferstehung des Schwerts des Windgottes', 'Das andere magische Schwert', 'Angriff der acht Dämonen']
writeFileSync(
  join(wurzel, 'data', 'tmdb-folgen.json'),
  JSON.stringify({ 177476: { tmdbId: 254017, folgen: FOLGEN.map((titel, i) => ({ s: 1, e: i + 1, titel })) } }),
)
const TAGE = ['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10']
const sichtungen = TAGE.map((tag, i) => [
  `tvde_prosiebenmaxx+${i + 1}`,
  { titleId: 177476, titel: 'Yaiba: Samurai Legend', folge: FOLGEN[i], sender: 'ProSieben MAXX', start: `${tag}T18:25:00+01:00`, ende: `${tag}T18:50:00+01:00`, gesehenAm: '2026-10-30' },
])
writeFileSync(join(wurzel, 'data', 'tv-programm.json'), JSON.stringify({ sendungen: Object.fromEntries(sichtungen) }))

const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
const { schreibeSynopsenUndReichereAn } = await import('./bau/13-1-anreichern.ts')
const { belegeJoynTermine } = await import('./bau/13-1-joyn-termine-belegt.ts')
const { joynTerminGeschaetztTrotzFenster } = await import('./lib/joyn-schaetzung-pruefung.ts')
const { unbedingteAufrufe } = await import('./lib/unbedingte-aufrufe.ts')
const { expandEvents } = await import('../shared/logic.ts')
type Release = import('../shared/types.ts').Release
type Title = import('../shared/types.ts').Title

const titel = (mitJoyn = true) =>
  ({
    id: 177476,
    franchiseId: 177476,
    titleEn: 'Yaiba: Samurai Legend',
    format: 'TV',
    episodes: 24,
    streams: mitJoyn ? [{ platform: 'joyn', url: 'https://www.joyn.de/serien/yaiba-samurai-legend', dub: true, dubRanges: [{ from: 1, to: 24, dub: true }] }] : [],
  }) as unknown as Title
const tvTermin = () =>
  ({
    slug: 'yaiba-samurai-legend-prosieben-maxx',
    titleId: 177476,
    name: 'YAIBA: Samurai Legend',
    platform: 'tv',
    sender: 'ProSieben MAXX',
    releaseType: 'weekly',
    sources: ['https://www.anime2you.de/news/1059480/yaiba-samurai-legend-prosieben-maxx-termin/'],
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24, wochentage: [1, 2, 3, 4, 5] },
  }) as unknown as Release
const joynTermin = (zeit = '18:50') =>
  ({
    slug: 'yaiba-samurai-legend-joyn',
    titleId: 177476,
    name: 'YAIBA: Samurai Legend',
    platform: 'joyn',
    releaseType: 'weekly',
    sources: ['https://www.joyn.de/serien/yaiba-samurai-legend'],
    schedule: { firstEpisodeDate: '2026-11-05', time: zeit, episodeCount: 24, wochentage: [1, 2, 3, 4, 5] },
  }) as unknown as Release

/** Wie der Bau: Termine und Ereignisse (Phase 10), dann Anreichern mit den Fenstern (13-1), dann die Belegung (13-schreiben). */
function bau(releases: Release[], titles = new Map([[177476, titel()]])) {
  const alt = console.log
  console.log = () => undefined
  try {
    ergaenzeTermineAusNewsUndTv({ titles, releases } as unknown as Parameters<typeof ergaenzeTermineAusNewsUndTv>[0])
    const events = releases.flatMap((r) => expandEvents(r))
    schreibeSynopsenUndReichereAn({ allTitles: [...titles.values()] as never, releases, kanalJeAdresse: new Map() })
    const belegt = belegeJoynTermine([...titles.values()], releases, events)
    return { events, belegt, titles }
  } finally {
    console.log = alt
  }
}
const marken = (events: { releaseSlug: string; episode?: number; estimated?: boolean }[], slug: string) =>
  events.filter((e) => e.releaseSlug === slug).map((e) => `${e.episode}${e.estimated ? '≈' : ''}`).join(' ')
const planMarken = (r: Release) => marken(expandEvents(r), r.slug)

/* Anlassfall in Ereignissen: erschienene Folgen (bis 10.11.) und künftige (ab 11.11.) getrennt. */
const hand = joynTermin()
const lauf = bau([tvTermin(), hand])
pruefe('Anlassfall: Folge 1–4 (erschienen, belegtes Fenster) ohne ≈, Folge 5–6 (künftig, ohne Fenster) ≈', marken(lauf.events, hand.slug).startsWith('1 2 3 4 5≈ 6≈'), marken(lauf.events, hand.slug).slice(0, 40))
pruefe('Rückgabe: vier belegte Folgen', lauf.belegt === 4, lauf.belegt)
pruefe('observed trägt genau die vier Fenstertage', JSON.stringify(hand.schedule.observed) === JSON.stringify({ 1: TAGE[0], 2: TAGE[1], 3: TAGE[2], 4: TAGE[3] }), hand.schedule.observed)
pruefe('Die Ereignisse behalten ihre Tage (Folge 5 am 11.11.)', lauf.events.find((e) => e.releaseSlug === hand.slug && e.episode === 5)?.date === '2026-11-11')
pruefe('Der TV-Termin wird nicht berührt', marken(lauf.events, tvTermin().slug).startsWith('1 2 3 4 5≈'), marken(lauf.events, tvTermin().slug).slice(0, 30))

/* Künftige Folge MIT belegendem Fenster verliert ≈, eine ohne Fenster nicht: Fenster für Folge 5 am 11.11. 18:50. */
const mitZukunft = new Map([[177476, titel()]])
const zukunft = joynTermin()
const evZ = [tvTermin(), zukunft].flatMap((r) => expandEvents(r))
const t5 = mitZukunft.get(177476) as unknown as { streams: { fenster?: unknown }[] }
t5.streams[0]!.fenster = [{ nr: 5, ab: '2026-11-11T18:50', ende: '2026-12-10T23:59' }]
const zaehlerZ = belegeJoynTermine([...mitZukunft.values()], [zukunft], evZ)
pruefe('Künftige Folge 5 mit Fenster 18:50 verliert ≈, Folge 6 ohne Fenster nicht', zaehlerZ === 1 && marken(evZ, zukunft.slug).includes('5 6≈') && marken(evZ, zukunft.slug).includes('2≈'), marken(evZ, zukunft.slug).slice(0, 30))

const ohneFenster = joynTermin()
const ohne = bau([ohneFenster], new Map([[177476, titel(false)]]))
pruefe('Ohne Joyn-Weg am Titel: nichts belegt, ab Folge 2 ≈', marken(ohne.events, ohneFenster.slug).startsWith('1 2≈ 3≈') && ohneFenster.schedule.observed === undefined, ohne.belegt)

const andereZeit = joynTermin('19:10')
const az = bau([tvTermin(), andereZeit])
pruefe('Plan-Uhrzeit weicht vom Fenster ab (19:10 gegen 18:50): bleibt geschätzt', marken(az.events, andereZeit.slug).startsWith('1 2≈') && andereZeit.schedule.observed === undefined, az.belegt)

const eigene = joynTermin()
eigene.schedule.observed = { 2: '2026-11-06' }
bau([tvTermin(), eigene])
pruefe('Vorhandene Beobachtung bleibt, der Rest wird ergänzt', eigene.schedule.observed?.[2] === '2026-11-06' && Object.keys(eigene.schedule.observed ?? {}).length === 4, eigene.schedule.observed)

/* Gegenfälle: je Bedingung ein Fall, in dem nur sie den Ausschlag gibt. */
const anderePlattform = { ...joynTermin(), platform: 'netflix' } as Release
const ohneTage = joynTermin()
delete ohneTage.schedule.wochentage
const einTagSpaeter = joynTermin()
einTagSpaeter.schedule.firstEpisodeDate = '2026-11-06'
const gegen = bau([tvTermin(), joynTermin()])
const nachbau = [anderePlattform, ohneTage, einTagSpaeter]
const evG = nachbau.flatMap((r) => expandEvents(r))
const zaehlerG = belegeJoynTermine([...gegen.titles.values()], nachbau, evG)
pruefe('Andere Plattform mit gleicher Uhrzeit: nichts belegt', anderePlattform.schedule.observed === undefined, anderePlattform.schedule.observed)
pruefe('Ohne Sendetage: nichts belegt', ohneTage.schedule.observed === undefined, ohneTage.schedule.observed)
pruefe('Plan einen Tag nach dem Fenster (gleiche Uhrzeit): nichts belegt', einTagSpaeter.schedule.observed === undefined && zaehlerG === 0, einTagSpaeter.schedule.observed)

/* Wächter über den Bestand (events + titles): dieselbe Lage ohne Belegung ist ein Befund. */
const evWach = [tvTermin(), joynTermin()].flatMap((r) => expandEvents(r))
const titelMitFenster = new Map([[177476, gegen.titles.get(177476)!]])
const befunde = joynTerminGeschaetztTrotzFenster(evWach, titelMitFenster)
pruefe('Wächter: Joyn-Termin mit ≈ trotz belegendem Fenster ist ein Befund (Folge 2 bis 4)', befunde.length === 3 && befunde[0]!.includes('Folge 2 (2026-11-06)'), befunde)
pruefe('Wächter: nach der Belegung kein Befund', joynTerminGeschaetztTrotzFenster(lauf.events, lauf.titles).length === 0)
const netflixEv = evWach.map((e) => ({ ...e, platform: 'netflix' }))
pruefe('Wächter: andere Plattform ist kein Befund', joynTerminGeschaetztTrotzFenster(netflixEv as never, titelMitFenster).length === 0)
const nachTag = [{ ...joynTermin(), schedule: { ...joynTermin().schedule, firstEpisodeDate: '2026-11-06' } } as Release].flatMap((r) => expandEvents(r))
pruefe('Wächter: Termin einen Tag nach dem Fenster (gleiche Uhrzeit) ist kein Befund', joynTerminGeschaetztTrotzFenster(nachTag, titelMitFenster).length === 0)
const fremdeNr = new Map([[177476, { ...titel(), streams: [{ platform: 'joyn', fenster: [{ nr: 9, ab: '2026-11-06T18:50', ende: '2026-12-05T23:59' }] }] } as unknown as Title]])
pruefe('Wächter: Termin 19:10 gegen Fenster 18:50 am selben Tag ist kein Befund', joynTerminGeschaetztTrotzFenster(expandEvents(joynTermin('19:10')), titelMitFenster).length === 0)
pruefe('Wächter: Fenster mit anderer Folgennummer belegt den Termin nicht', joynTerminGeschaetztTrotzFenster(evWach, fremdeNr).length === 0)
const ohneEstimated = evWach.map((e) => ({ ...e, estimated: undefined }))
pruefe('Wächter: Termin ohne ≈ ist kein Befund', joynTerminGeschaetztTrotzFenster(ohneEstimated, titelMitFenster).length === 0)
pruefe('Planmarken ohne Bau: Folge 2–4 ≈ (Ausgangslage des Anlassfalls)', planMarken(joynTermin()).startsWith('1 2≈ 3≈ 4≈'))

/* Verdrahtung: 13-schreiben ruft die Belegung unbedingt, mit den Ereignissen, nach dem Anreichern (das die Fenster setzt). */
const schreiben = readFileSync(new URL('./bau/13-schreiben.ts', import.meta.url), 'utf8')
const aufrufe = unbedingteAufrufe(schreiben, 'schreibeDatensatz')
const stelle = (name: string): number => aufrufe.find((x) => x.name === name)?.stelle ?? -1
pruefe(
  '13-schreiben: belegeJoynTermine(allTitles, releases, events) nach dem Anreichern, vor der Auslieferung',
  aufrufe.find((x) => x.name === 'belegeJoynTermine')?.args.join('|') === 'allTitles|releases|events' &&
    stelle('belegeJoynTermine') > stelle('schreibeSynopsenUndReichereAn') &&
    stelle('schreibeSynopsenUndReichereAn') >= 0 &&
    stelle('belegeJoynTermine') < stelle('baueAuslieferung'),
  aufrufe.map((x) => `${x.stelle}:${x.name}(${x.args.join(',')})`),
)

if (verletzt) {
  console.error(`FEHL check-joyn-termine-belegt: ${verletzt} von ${faelle} Prüfungen verletzt.`)
  process.exit(1)
}
console.log(`check-joyn-termine-belegt: ${faelle} Prüfungen ok.`)
