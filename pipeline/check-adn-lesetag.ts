/**
 * Zusicherungen zu `pipeline/bau/adn-lesetag.ts` (Prüfer 1598 A1/A2): Ein ADN-Beleg nennt den Tag des Abrufs, aus dem seine
 * Messung stammt, nicht die Erstsichtung, und eine Katalog-Serie trägt die Adresse ihrer Folgenliste, nicht die des Kalenders.
 * Der Verdrahtungsteil lässt `quellenPflegen` (`bau/nebendateien.ts`, aufgerufen in `08-news-tv.ts`) auf einer Kulisse im
 * Temp-Ordner (`AK_ROOT`) laufen; erfundene Serien.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Quelle, Release, Title } from '../shared/types.ts'
import { normalizeTitle } from './lib/crunchyroll.ts'
import type { AdnShow } from './lib/adn.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'adn-lesetag-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data'), { recursive: true })
/* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const KALENDER = 'https://gw.api.animationdigitalnetwork.com/video/calendar'
const show = (showId: number): AdnShow => ({ showId, title: `Erfunden ${showId}`, url: '', episodes: [], batch: true })
const daten = (scrapedAt: string, ...ids: number[]) => ({ scrapedAt, window: { from: '', to: '' }, shows: ids.map(show) })
const mitFolge = (showId: number, title: string, date: string): AdnShow => ({
  ...show(showId),
  title,
  episodes: [{ date, time: '09:00', episode: 1, url: `https://animationdigitalnetwork.com/de/video/${showId}-erfunden/9${showId}-folge-1` }],
})
/** Je Serie ein Titel gleichen Namens (Kennung = Serienkennung), damit 07-adn die Serie zuordnet. */
function titelZu(paare: [number, string][]): { titles: Map<number, Title>; titleByName: Map<string, Title> } {
  const liste = paare.map(([id, name]) => ({ id, franchiseId: id, titleRomaji: name, titleEn: name, episodes: 1, keywords: [], genres: [], streams: [] }) as unknown as Title)
  return { titles: new Map(liste.map((t) => [t.id, t])), titleByName: new Map(liste.map((t) => [normalizeTitle(t.titleRomaji!), t])) }
}
const release = (showId: number, sources: string[]): Release =>
  ({
    slug: `adn-${showId}`,
    titleId: showId,
    name: `Erfunden ${showId}`,
    platform: 'adn',
    platformUrl: `https://animationdigitalnetwork.com/de/video/${showId}-erfunden/9${showId}-folge-1`,
    releaseType: 'batch',
    schedule: { firstEpisodeDate: '2026-10-29', episodeCount: 12 },
    sources,
  }) as unknown as Release

try {
  const { adnKatalogUrl, adnKatalogShow } = await import('./bau/grundlagen.ts')
  const { adnLesetage, mitLesetag } = await import('./bau/adn-lesetag.ts')

  console.log('\nADN-Adresse: Kalender oder Folgenliste der Serie')
  pruefe('Katalog-Adresse und Serienkennung', adnKatalogShow(adnKatalogUrl(1318)) === 1318, adnKatalogUrl(1318))
  pruefe('Kalender und Zusatzpfad sind keine Katalog-Adresse', adnKatalogShow(KALENDER) === undefined && adnKatalogShow(`${adnKatalogUrl(1318)}/x`) === undefined)
  pruefe('Katalog-Adresse hinter fremdem Anfang ist keine', adnKatalogShow(`https://x.de/?u=${adnKatalogUrl(1318)}`) === undefined)

  console.log('\nLesetag je Endpunkt')
  /* 23:30 UTC ist in Berlin schon der nächste Tag. */
  const tag = adnLesetage(daten('2026-10-18T23:30:00Z', 901, 902, 903), daten('2026-10-12T08:00:00Z', 911, 912, 913), { '912': '2026-10-15T09:00:00Z', '913': '2026-10-01T09:00:00Z' })
  pruefe('Kalender-Serie: Tag des Kalenderabrufs (Berlin)', tag(release(902, []), KALENDER) === '2026-10-19', tag(release(902, []), KALENDER))
  pruefe('Kalender-Adresse an einer Serie, die nicht im Kalender steht: kein Tag', tag(release(912, []), KALENDER) === undefined, tag(release(912, []), KALENDER))
  pruefe('Katalog-Serie mit jüngerem Serienabruf: der Serienabruf', tag(release(912, []), adnKatalogUrl(912)) === '2026-10-15', tag(release(912, []), adnKatalogUrl(912)))
  pruefe('Katalog-Serie mit älterem Serienabruf: der Katalogabruf', tag(release(913, []), adnKatalogUrl(913)) === '2026-10-12', tag(release(913, []), adnKatalogUrl(913)))
  pruefe('Katalog-Serie ohne Serienstand: der Katalogabruf', tag(release(911, []), adnKatalogUrl(911)) === '2026-10-12', tag(release(911, []), adnKatalogUrl(911)))
  pruefe('Katalog-Adresse einer Serie, die nicht im Katalog steht: kein Tag', tag(release(902, []), adnKatalogUrl(902)) === undefined)
  pruefe('fremde Adresse: kein Tag', tag(release(902, []), 'https://www.anime2you.de/news/1/x/') === undefined)
  const leer = adnLesetage(daten('', 902), daten('kaputt', 912), {})
  pruefe('leerer oder unlesbarer Abrufzeitpunkt: kein Tag', leer(release(902, []), KALENDER) === undefined && leer(release(912, []), adnKatalogUrl(912)) === undefined)
  const ohneFolge = { ...release(902, []), platformUrl: undefined } as Release
  pruefe('Termin ohne Folgen-Adresse: kein Tag', tag(ohneFolge, KALENDER) === undefined)

  const quellen: Quelle[] = [
    { url: 'https://www.anime2you.de/news/1/x/', name: 'anime2you.de', gesehenAm: '2026-10-01' },
    { url: KALENDER, name: 'ADN API', gesehenAm: '2026-10-01' },
  ]
  const mit = mitLesetag(release(902, []), quellen, tag)
  pruefe('mitLesetag: nur die API-Quelle bekommt den Lesetag, die Erstsichtung bleibt', mit[0]!.gelesenAm === undefined && mit[1]!.gelesenAm === '2026-10-19' && mit[1]!.gesehenAm === '2026-10-01', mit)

  console.log('\nVerdrahtung: quellenPflegen auf einer Kulisse')
  /* 904 und 914 tragen Folgen: aus ihnen baut `ergaenzeAdnTitel` (07-adn) die Termine, deren Adresse unten geprüft wird. */
  const kalender = daten('2026-10-19T04:09:00Z', 901, 902, 903)
  const katalog = daten('2026-10-12T08:00:00Z', 911, 912, 913)
  kalender.shows.push(mitFolge(904, 'Erfunden Kalender', '2026-10-29'))
  katalog.shows.push({ ...mitFolge(914, 'Erfunden Katalog', '2026-09-01'), fromCatalog: true })
  writeFileSync(join(wurzel, 'data', 'adn.json'), JSON.stringify(kalender))
  writeFileSync(join(wurzel, 'data', 'adn-catalog.json'), JSON.stringify(katalog))
  writeFileSync(join(wurzel, 'data', 'adn-katalog-stand.json'), JSON.stringify({ '912': '2026-10-15T09:00:00Z' }))
  /* Erste Sichtung am 01.10.: so steht es für 104 Kalender-Termine im Bestand (Messung 19.10.2026). */
  const alt = { url: KALENDER, name: 'ADN API', gesehenAm: '2026-10-01', stand: 'aktuell' }
  writeFileSync(join(wurzel, 'data', 'quellen-historie.json'), JSON.stringify({ 'adn-902': [alt] }))
  const { quellenPflegen } = await import('./bau/nebendateien.ts')
  const kal = release(902, [KALENDER])
  const kat = release(912, [adnKatalogUrl(912)])
  const nachbar = release(913, [adnKatalogUrl(913)])
  const { ergaenzeAdnTitel } = await import('./bau/07-adn.ts')
  const { titles, titleByName } = titelZu([[904, 'Erfunden Kalender'], [914, 'Erfunden Katalog']])
  const gebaut: Release[] = []
  ergaenzeAdnTitel({ titles, releases: gebaut, titleByName, seenSlugs: new Set() })
  quellenPflegen([kal, kat, nachbar, ...gebaut])
  const api = (r: Release | undefined) => r?.quellen?.find((q) => q.stand === 'aktuell')
  pruefe('Kalender-Termin: Erstsichtung 01.10. bleibt, Lesetag 19.10.', api(kal)?.gesehenAm === '2026-10-01' && api(kal)?.gelesenAm === '2026-10-19', kal.quellen)
  pruefe('Katalog-Termin: Lesetag aus dem Serienabruf', api(kat)?.gelesenAm === '2026-10-15', kat.quellen)
  pruefe('Katalog-Termin ohne jüngeren Serienabruf: Lesetag aus dem Katalogabruf', api(nachbar)?.gelesenAm === '2026-10-12', nachbar.quellen)

  console.log('\nBau: 07-adn wählt die Adresse, quellenPflegen den Lesetag')
  const ausKalender = gebaut.find((r) => r.titleId === 904)
  const ausKatalog = gebaut.find((r) => r.titleId === 914)
  pruefe('Serie aus dem Kalender: Kalender-Adresse, Lesetag des Kalenderabrufs', ausKalender?.sources.join() === KALENDER && api(ausKalender)?.gelesenAm === '2026-10-19', ausKalender?.quellen)
  pruefe('Serie nur im Katalog: Adresse ihrer Folgenliste, Lesetag des Katalogabrufs (Prüfer 1598 A2)', ausKatalog?.sources.join() === adnKatalogUrl(914) && api(ausKatalog)?.gelesenAm === '2026-10-12', ausKatalog?.quellen)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nadn-lesetag: alle Zusicherungen halten')
