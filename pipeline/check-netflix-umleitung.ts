/**
 * Netflix-Umleitung (Ranma ½, 24.10.2026): `netflixTitelAdresse` führt die alte Kennung auf die neue, und der Wächter
 * findet eine Umleitung als eigene Reihe oder zwei Kennungen für dieselben Staffeln.
 */
import { netflixTitelAdresse } from './lib/netflix-adresse.ts'
import { berichtigeNetflixOverlay } from './bau/13-3-0-netflix-overlay.ts'
import { ergaenzeWegeAusTmdbUndMotn } from './bau/13-3-1-tmdb-wege.ts'
import { findeDoppelteNetflixKennungen, type StaffelListen } from './lib/netflix-doppelte-kennung.ts'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (!ok) fehler.push(`${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const netflix = (id: string) => `https://www.netflix.com/title/${id}`
const liste = (...folgen: number[]): StaffelListen[string] => ({ staffeln: folgen.map((f, i) => ({ seq: i + 1, folgen: f })) })
const titel = (id: number, franchiseId: number | null, kennung: string) => ({
  id,
  franchiseId,
  streams: [{ platform: 'netflix', url: netflix(kennung) }],
})

pruefe('alte Kennung wird zur neuen', netflixTitelAdresse(netflix('81301833')) === netflix('81171925'))
pruefe('Abspieladresse der alten Kennung ebenso', netflixTitelAdresse('https://www.netflix.com/watch/81301833?x=1') === netflix('81171925'))
pruefe('neue Kennung bleibt', netflixTitelAdresse(netflix('81171925')) === netflix('81171925'))
pruefe('fremde Kennung bleibt', netflixTitelAdresse(netflix('81301834')) === netflix('81301834'))

const ranma = [titel(1, 210, '81171925'), titel(2, 210, '81171925'), titel(3, 210, '81171925')]
const gut = { '81171925': liste(12, 12, 4) }
pruefe('Ranma nach dem Fix: kein Fund', findeDoppelteNetflixKennungen(ranma, gut).length === 0)
pruefe('Umleitung im Verweis', findeDoppelteNetflixKennungen([titel(1, 210, '81301833')], gut).length === 1)
pruefe('Umleitung als eigene Reihe', findeDoppelteNetflixKennungen(ranma, { ...gut, '81301833': liste(12, 12) }).length === 1)

const zwei = [titel(1, 7, '900001'), titel(2, 7, '900002')]
const anfang = findeDoppelteNetflixKennungen(zwei, { '900001': liste(12, 12), '900002': liste(12, 12, 4) })
pruefe('zwei Kennungen, eine Liste Anfang der anderen', anfang.length === 1, anfang)
pruefe('Anfang gilt in beide Richtungen', findeDoppelteNetflixKennungen(zwei, { '900001': liste(12, 12, 4), '900002': liste(12, 12) }).length === 1)
const durcheinander: StaffelListen = { '900001': { staffeln: [{ seq: 2, folgen: 12 }, { seq: 1, folgen: 10 }] }, '900002': liste(10, 12, 4) }
pruefe('Staffeln werden nach seq geordnet', findeDoppelteNetflixKennungen(zwei, durcheinander).length === 1)
pruefe('gleiche Listen mit zwei Staffeln', findeDoppelteNetflixKennungen(zwei, { '900001': liste(12, 12), '900002': liste(12, 12) }).length === 1)
pruefe('Folgenzahl trennt', findeDoppelteNetflixKennungen(zwei, { '900001': liste(12, 12), '900002': liste(13, 12, 4) }).length === 0)
pruefe('eine Staffel je Seite ist keine Doppelung (Sailor Moon)', findeDoppelteNetflixKennungen(zwei, { '900001': liste(2), '900002': liste(2) }).length === 0)
pruefe('ohne Liste kein Urteil', findeDoppelteNetflixKennungen(zwei, {}).length === 0)
pruefe('andere Franchise', findeDoppelteNetflixKennungen([titel(1, 7, '900001'), titel(2, 8, '900002')], { '900001': liste(12, 12), '900002': liste(12, 12, 4) }).length === 0)
pruefe('ohne Franchise', findeDoppelteNetflixKennungen([titel(1, null, '900001'), titel(2, null, '900002')], { '900001': liste(12, 12), '900002': liste(12, 12, 4) }).length === 0)
pruefe('Nicht-Netflix-Weg zählt nicht', findeDoppelteNetflixKennungen([{ id: 1, franchiseId: 7, streams: [{ platform: 'primevideo', url: netflix('81301833') }] }], {}).length === 0)

/* A2: die beiden Bau-Stellen, die Netflix-Adressen setzen, gehen durch die Umleitungstabelle. */
const overlay = [{ streams: [{ platform: 'netflix', url: 'https://www.netflix.com/browse?jbv=81301833' }] }, { streams: [{ platform: 'netflix', url: 'https://www.netflix.com/browse?jbv=81301834' }] }]
pruefe('Overlay-Adresse: zwei umgeschrieben', berichtigeNetflixOverlay(overlay) === 2)
pruefe('Overlay mit alter Kennung → neue', overlay[0]!.streams[0]!.url === netflix('81171925'), overlay[0]!.streams[0]!.url)
pruefe('Overlay mit fremder Kennung bleibt', overlay[1]!.streams[0]!.url === netflix('81301834'), overlay[1]!.streams[0]!.url)

const motnEintrag = (links: Record<string, string>) => {
  const slim = [{ id: 900001, streams: [] as { platform: string; url: string }[] }] as unknown as Parameters<typeof ergaenzeWegeAusTmdbUndMotn>[0]['slim']
  ergaenzeWegeAusTmdbUndMotn({
    slim,
    tmdbTitles: {},
    tmdbZuTitel: { '900001': { tmdbId: 7, kind: 'tv', providers: ['netflix', 'primevideo'] } } as never,
    motnTmdb: { 'tv/7': { imdbId: 'tt900001' } } as never,
    motnLinks: { tt900001: links },
  })
  return slim[0]!.streams ?? []
}
const motn = motnEintrag({ netflix: netflix('81301833'), primevideo: 'https://www.amazon.de/gp/video/detail/B0TEST' })
pruefe('MotN-Weg: Netflix-Umleitung → neue Kennung', motn.find((s) => s.platform === 'netflix')?.url === netflix('81171925'), motn)
pruefe('MotN-Weg: Prime-Adresse unverändert', motn.find((s) => s.platform === 'primevideo')?.url === 'https://www.amazon.de/gp/video/detail/B0TEST', motn)

if (fehler.length) {
  console.error(`FEHL check-netflix-umleitung: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-netflix-umleitung: Umleitung führt auf die neue Kennung, doppelte Kennungen ohne Folgenzahl-Trennung fallen auf.')
