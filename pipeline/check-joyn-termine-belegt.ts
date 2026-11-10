/**
 * Wächter: Ein Joyn-Handtermin verliert das „≈“ genau für die Folgen, deren Abruffenster seinen Tag und seine Uhrzeit trägt.
 *
 * Anlass (10.11.2026, Daniel: „wieso steht bei yaiba immer noch ~“): `yaiba-samurai-legend-joyn` (data/curated/streaming-nachtrag-2026.yaml, Mo–Fr 18:50)
 * trug ab Folge 2 `estimated`, obwohl `setzeJoynFenster` für Folge 1–6 Fenster 18:50 aus den MAXX-Sichtungen hatte. Sichtungen und Folgentitel wie in
 * `check-joyn-hand-tv.ts` (tv-programm.json, TMDB 254017, Stand 08.11.2026). Läuft über den echten Bauschritt (`schreibeSynopsenUndReichereAn`)
 * gegen einen Wegwerf-Ordner (`AK_ROOT`). Aufruf: npx tsx pipeline/check-joyn-termine-belegt.ts
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
const { expandEvents } = await import('../shared/logic.ts')
type Release = import('../shared/types.ts').Release

const titel = (mitJoyn = true) => ({
  id: 177476,
  franchiseId: 177476,
  titleEn: 'Yaiba: Samurai Legend',
  format: 'TV',
  episodes: 24,
  streams: mitJoyn ? [{ platform: 'joyn', url: 'https://www.joyn.de/serien/yaiba-samurai-legend', dub: true, dubRanges: [{ from: 1, to: 24, dub: true }] }] : [],
})
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

function bau(releases: Release[], titles = new Map([[177476, titel()]])): void {
  const alt = console.log
  console.log = () => undefined
  try {
    ergaenzeTermineAusNewsUndTv({ titles, releases } as unknown as Parameters<typeof ergaenzeTermineAusNewsUndTv>[0])
    schreibeSynopsenUndReichereAn({ allTitles: [...titles.values()] as never, releases, kanalJeAdresse: new Map() })
  } finally {
    console.log = alt
  }
}
const geschaetzt = (r: Release) => expandEvents(r).map((e) => `${e.episode}${e.estimated ? '≈' : ''}`).join(' ')

const hand = joynTermin()
bau([tvTermin(), hand])
pruefe('Anlassfall: Folge 1–4 mit Fenster sind belegt, Folge 5 ohne Fenster bleibt ≈', geschaetzt(hand).startsWith('1 2 3 4 5≈ 6≈'), geschaetzt(hand).slice(0, 40))
pruefe('observed trägt genau die vier Fenstertage', JSON.stringify(hand.schedule.observed) === JSON.stringify({ 1: TAGE[0], 2: TAGE[1], 3: TAGE[2], 4: TAGE[3] }), hand.schedule.observed)
pruefe('Die Tage ändern sich nicht (Folge 5 am 11.11.)', expandEvents(hand).find((e) => e.episode === 5)?.date === '2026-11-11')

const ohneFenster = joynTermin()
bau([ohneFenster], new Map([[177476, titel(false)]]))
pruefe('Ohne Joyn-Weg am Titel: nichts belegt, ab Folge 2 ≈', geschaetzt(ohneFenster).startsWith('1 2≈ 3≈') && ohneFenster.schedule.observed === undefined, geschaetzt(ohneFenster).slice(0, 20))

const andereZeit = joynTermin('19:10')
bau([tvTermin(), andereZeit])
pruefe('Plan-Uhrzeit weicht vom Fenster ab (19:10 gegen 18:50): bleibt geschätzt', geschaetzt(andereZeit).startsWith('1 2≈') && andereZeit.schedule.observed === undefined, geschaetzt(andereZeit).slice(0, 20))

const eigene = joynTermin()
eigene.schedule.observed = { 2: '2026-11-06' }
bau([tvTermin(), eigene])
pruefe('Vorhandene Beobachtung bleibt, der Rest wird ergänzt', eigene.schedule.observed?.[2] === '2026-11-06' && Object.keys(eigene.schedule.observed ?? {}).length === 4, eigene.schedule.observed)

const tv = tvTermin()
bau([tv])
pruefe('Ein TV-Termin wird nicht berührt (observed stammt aus den Sichtungen)', Object.keys(tv.schedule.observed ?? {}).join() === '1,2,3,4', tv.schedule.observed)

/* Bauprüfung (`pruefeErgebnis`): dieselbe Lage ohne den Bauschritt ist rot, mit ihm grün. */
const { pruefeErgebnis } = await import('./lib/pruefung.ts')
const mitFenster = () => {
  const t = titel()
  const ungebaut = joynTermin()
  const releases = [tvTermin(), ungebaut]
  bau([tvTermin()], new Map([[177476, t]]))
  return { titles: new Map([[177476, t]]), releases, ungebaut }
}
const lage = mitFenster()
const fehlerVon = (releases: Release[]) =>
  pruefeErgebnis(releases, releases.flatMap((r) => expandEvents(r)), lage.titles as never, '2026-11-10').fehler.filter((f) => f.startsWith('Joyn-Termin'))
const rot = fehlerVon([lage.ungebaut])
pruefe('Prüfung: Joyn-Termin mit ≈ trotz belegendem Fenster ist rot (Folge 2 bis 4)', rot.length === 3 && rot[0]!.includes('Folge 2 (2026-11-06)'), rot)
const gruen = joynTermin()
gruen.schedule.observed = { 1: TAGE[0]!, 2: TAGE[1]!, 3: TAGE[2]!, 4: TAGE[3]! }
pruefe('Prüfung: derselbe Termin mit belegten Tagen ist nicht rot', fehlerVon([gruen]).length === 0)
const fremdeZeit = joynTermin('19:10')
pruefe('Prüfung: Plan 19:10 gegen Fenster 18:50 ist nicht rot (Fenster belegt diesen Termin nicht)', fehlerVon([fremdeZeit]).length === 0)

if (verletzt) {
  console.error(`FEHL check-joyn-termine-belegt: ${verletzt} von ${faelle} Prüfungen verletzt.`)
  process.exit(1)
}
console.log(`check-joyn-termine-belegt: ${faelle} Prüfungen ok.`)
