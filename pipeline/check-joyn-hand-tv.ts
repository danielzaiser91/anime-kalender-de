/**
 * Wächter: Die Joyn-Pille eines Titels mit von Hand gepflegtem TV-Termin nennt die abrufbaren Folgen.
 *
 * Anlass (08.11.2026, Daniel): Yaiba: Samurai Legend (ProSieben MAXX, danach Joyn) zeigte an der Joyn-Pille keine Folgen, obwohl Folge 1 und 2
 * online waren. Der Handtermin (`data/curated/tv-2026.yaml`) ersetzt die tv.de-Sichtungen ab seinem Start, trug weder `observed` noch `folgenBelegt`,
 * und `setzeJoynFenster` rechnet Fenster nur aus beobachteten Folgen. Sichtungen, Folgentitel und Termin wörtlich aus `data/tv-programm.json`,
 * der TMDB-Liste (254017) und dem Handtermin (Stand 08.11.2026). Läuft gegen einen Wegwerf-Ordner (`AK_ROOT`). Aufruf: npx tsx pipeline/check-joyn-hand-tv.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
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

const wurzel = mkdtempSync(join(tmpdir(), 'joyn-hand-tv-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [] }))

const FOLGEN = [
  'Auftritt Yaiba',
  'Wiederauferstehung des Schwerts des Windgottes',
  'Das andere magische Schwert',
  'Angriff der acht Dämonen',
  'Fröhliches Onsen-Hotel',
  'Fledermausmann erscheint aus dem Nichts',
]
writeFileSync(
  join(wurzel, 'data', 'tmdb-folgen.json'),
  JSON.stringify({ 177476: { tmdbId: 254017, folgen: FOLGEN.map((titel, i) => ({ s: 1, e: i + 1, titel })) } }),
)
const sichtung = (kennung: string, folge: string, start: string, ende: string, titleId = 177476, sender = 'ProSieben MAXX') => [
  `tvde_prosiebenmaxx+${kennung}`,
  { titleId, titel: 'Yaiba: Samurai Legend', folge, sender, start, ende, gesehenAm: '2026-10-30' },
]
const SICHTUNGEN = [
  sichtung('1', FOLGEN[0]!, '2026-11-05T18:25:00+01:00', '2026-11-05T18:50:00+01:00'),
  sichtung('2', FOLGEN[1]!, '2026-11-06T18:20:00+01:00', '2026-11-06T18:50:00+01:00'),
  sichtung('3', FOLGEN[0]!, '2026-11-08T05:15:00+01:00', '2026-11-08T05:45:00+01:00'),
  sichtung('4', FOLGEN[2]!, '2026-11-09T18:25:00+01:00', '2026-11-09T18:50:00+01:00'),
  sichtung('5', FOLGEN[3]!, '2026-11-10T18:25:00+01:00', '2026-11-10T18:50:00+01:00'),
  sichtung('6', FOLGEN[4]!, '2026-11-11T18:25:00+01:00', '2026-11-11T18:50:00+01:00'),
  sichtung('7', FOLGEN[1]!, '2026-11-12T05:05:00+01:00', '2026-11-12T05:40:00+01:00'),
  sichtung('8', FOLGEN[5]!, '2026-11-12T18:25:00+01:00', '2026-11-12T18:50:00+01:00'),
]
writeFileSync(join(wurzel, 'data', 'tv-programm.json'), JSON.stringify({ sendungen: Object.fromEntries(SICHTUNGEN) }))

const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
const { setzeJoynFenster } = await import('./bau/13-1-joyn-fenster.ts')
const { joynAngabe } = await import('../web/src/lib/joyn.ts')
type Release = import('../shared/types.ts').Release

const titel = () => ({
  id: 177476,
  franchiseId: 177476,
  titleEn: 'Yaiba: Samurai Legend',
  format: 'TV',
  episodes: 24,
  streams: [{ platform: 'joyn', url: 'https://www.joyn.de/serien/yaiba-samurai-legend', dub: true, dubRanges: [{ from: 1, to: 24, dub: true }] }],
})
const handtermin = (aus: Partial<Release['schedule']> = {}) =>
  ({
    slug: 'yaiba-samurai-legend-prosieben-maxx',
    titleId: 177476,
    name: 'YAIBA: Samurai Legend',
    platform: 'tv',
    sender: 'ProSieben MAXX',
    releaseType: 'weekly',
    sources: ['https://www.anime2you.de/news/1059480/yaiba-samurai-legend-prosieben-maxx-termin/'],
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24, wochentage: [1, 2, 3, 4, 5], ...aus },
  }) as unknown as Release

function bau(releases: Release[], titles = new Map([[177476, titel()]])): Release[] {
  const alt = console.log
  console.log = () => undefined
  try {
    ergaenzeTermineAusNewsUndTv({ titles, releases } as unknown as Parameters<typeof ergaenzeTermineAusNewsUndTv>[0])
    setzeJoynFenster([...titles.values()] as never, releases)
  } finally {
    console.log = alt
  }
  return releases
}

/* Der Anlassfall durch Bau und Pille. */
const hand = handtermin()
bau([hand])
pruefe(
  'Handtermin: observed trägt Folge 1 bis 6 mit dem ersten Sendetag, die Nachtwiederholung von Folge 1 (08.11.) ändert nichts',
  JSON.stringify(hand.schedule.observed) === JSON.stringify({ 1: '2026-11-05', 2: '2026-11-06', 3: '2026-11-09', 4: '2026-11-10', 5: '2026-11-11', 6: '2026-11-12' }),
  hand.schedule.observed,
)
pruefe('Handtermin: folgenBelegt gesetzt', hand.folgenBelegt === true)
const pille = (jetzt: string) => {
  const t = titel()
  bau([handtermin()], new Map([[177476, t]]))
  return joynAngabe((t.streams[0] as { fenster?: Parameters<typeof joynAngabe>[0] }).fenster, jetzt)
}
pruefe('Pille am 08.11. 12:00: Folge 1–2 abrufbar, Folge 3 ab 09.11.', pille('2026-11-08T12:00') === '≈ Fg. 1–2 · Fg. 3 ab 09.11.', pille('2026-11-08T12:00'))
pruefe('Pille am 05.11. 18:40: noch nichts abrufbar (Sendeende 18:50), Folge 1 ab 18:50', pille('2026-11-05T18:40') === 'Fg. 1 ab 18:50', pille('2026-11-05T18:40'))
pruefe('Pille am 09.11. 19:00: Folge 1–3', pille('2026-11-09T19:00') === '≈ Fg. 1–3 · Fg. 4 ab 10.11.', pille('2026-11-09T19:00'))

/* Gegenproben: nichts wird geraten oder überschrieben. */
const eigene = handtermin({ observed: { 1: '2026-11-05' } })
bau([eigene])
pruefe('Handtermin mit eigener Beobachtung bleibt, wie er ist', JSON.stringify(eigene.schedule.observed) === JSON.stringify({ 1: '2026-11-05' }) && eigene.folgenBelegt === undefined, eigene.schedule)
const spaet = handtermin({ firstEpisodeDate: '2026-11-09' })
bau([spaet])
pruefe('Sichtungen vor dem Start des Handtermins zählen nicht', Object.keys(spaet.schedule.observed ?? {}).join() === '3,4,5,6', spaet.schedule.observed)
const anderer = handtermin()
anderer.sender = 'TOGGO plus'
bau([anderer])
pruefe('Anderer Sender: keine Beobachtung aus den MAXX-Sichtungen', anderer.schedule.observed === undefined && anderer.folgenBelegt === undefined, anderer.schedule)
const fremderTitel = handtermin()
fremderTitel.titleId = 21
bau([fremderTitel], new Map([[177476, titel()], [21, { ...titel(), id: 21, franchiseId: 21, titleEn: 'One Piece', streams: [] }]]))
pruefe('Termin eines anderen Titels beim selben Sender: nichts aus den Yaiba-Sichtungen', fremderTitel.schedule.observed === undefined && fremderTitel.folgenBelegt === undefined, fremderTitel.schedule)
const ohneListe = handtermin()
writeFileSync(join(wurzel, 'data', 'tmdb-folgen.json'), JSON.stringify({ 177476: { tmdbId: 254017, folgen: FOLGEN.slice(0, 2).map((t, i) => ({ s: 1, e: i + 1, titel: t })) } }))
bau([ohneListe])
pruefe('Eine Sichtung, die die Folgenliste nicht findet: keine halbe Zuordnung', ohneListe.schedule.observed === undefined && ohneListe.folgenBelegt === undefined, ohneListe.schedule)
const ersterNr = handtermin({ firstEpisodeNumber: 10, episodeCount: 5 })
writeFileSync(join(wurzel, 'data', 'tmdb-folgen.json'), JSON.stringify({ 177476: { tmdbId: 254017, folgen: FOLGEN.map((titel, i) => ({ s: 1, e: i + 1, titel })) } }))
bau([ersterNr])
pruefe('Nummern außerhalb der Folgen des Handtermins (ab 10): nichts übernommen', ersterNr.schedule.observed === undefined, ersterNr.schedule)

/* Die Bestandswache: dieselbe Lage als Befund (Fixture wie der Datensatz vom 08.11.: Termin mit Sichtungen ab gestern, Joyn-Weg ohne Fenster). */
const { joynLaeuftOhneFenster } = await import('./lib/joyn-ohne-fenster.ts')
const weg = (fenster?: unknown) => ({ platform: 'joyn', url: 'x', ...(fenster ? { fenster } : {}) })
const tvTermin = (titleId: number, sender = 'ProSieben MAXX', sendungen = [{ start: '2026-11-09T18:25', ende: '2026-11-09T18:50' }]) => ({ titleId, platform: 'tv', sender, sendungen })
const offen = (titel: unknown[], rel: unknown[]) => joynLaeuftOhneFenster(titel as never, rel as never).join()
const FENSTER = [{ nr: 1, ab: '2026-11-05T18:50', ende: '2026-12-04T23:59' }]
pruefe('Wache: läuft auf MAXX, Joyn-Weg ohne Fenster: gemeldet', offen([{ id: 177476, streams: [weg()] }], [tvTermin(177476)]) === '177476')
pruefe('Wache: mit Fenster nichts offen', offen([{ id: 177476, streams: [weg(FENSTER)] }], [tvTermin(177476)]) === '')
pruefe('Wache: Fenster leer zählt als ohne', offen([{ id: 177476, streams: [weg([])] }], [tvTermin(177476)]) === '177476')
pruefe('Wache: anderer Sender: nichts offen', offen([{ id: 177476, streams: [weg()] }], [tvTermin(177476, 'TOGGO plus')]) === '')
pruefe('Wache: keine Sendungen ab gestern (läuft nicht): nichts offen', offen([{ id: 177476, streams: [weg()] }], [tvTermin(177476, 'ProSieben MAXX', [])]) === '')
pruefe('Wache: Termin gehört einem anderen Titel: nichts offen', offen([{ id: 177476, streams: [weg()] }], [tvTermin(21)]) === '')
pruefe('Wache: Titel ohne Joyn-Weg: nichts offen', offen([{ id: 177476, streams: [{ platform: 'netflix', url: 'x' }] }], [tvTermin(177476)]) === '')
pruefe('Wache: zwei Titel, nur der ohne Fenster, sortiert', offen([{ id: 21, streams: [weg()] }, { id: 15, streams: [weg()] }, { id: 177476, streams: [weg(FENSTER)] }], [tvTermin(21), tvTermin(15), tvTermin(177476)]) === '15,21')

if (verletzt) {
  console.error(`check-joyn-hand-tv: ${verletzt} von ${faelle} Fällen verletzt`)
  process.exit(1)
}
console.log(`check-joyn-hand-tv: ok (${faelle} Fälle: Handtermin belegt über den Bau, Joyn-Pille am echten Anlass, Gegenproben)`)
