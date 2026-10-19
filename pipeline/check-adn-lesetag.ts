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
/** Jede erfundene Serie führt eine Folge am Datum der Termine unten (29.10., 09:00) und eine Woche davor. */
const show = (showId: number): AdnShow => ({ showId, title: `Erfunden ${showId}`, url: '', episodes: [{ date: '2026-10-22', time: '09:00', url: '' }, { date: '2026-10-29', time: '09:00', url: '' }], batch: true })
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
  const { adnLesetage, behalteLesetag, mitLesetag, ohneFehlzuordnung } = await import('./bau/adn-lesetag.ts')

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

  console.log('\nLesetag nur, wenn das Datum des Termins im Abruf steht (Prüfer 1598 R3)')
  const plan = (r: Release, s: Partial<Release['schedule']>) => ({ ...r, schedule: { ...r.schedule, ...s } }) as Release
  const anderer = (id: number) => plan(release(id, []), { firstEpisodeDate: '2026-11-05' })
  pruefe('Kalender-Serie, Termin mit anderem Datum (etwa aus einem Artikel): kein Tag', tag(anderer(902), KALENDER) === undefined, tag(anderer(902), KALENDER))
  pruefe('Katalog-Serie, Termin mit anderem Datum: kein Tag', tag(anderer(912), adnKatalogUrl(912)) === undefined, tag(anderer(912), adnKatalogUrl(912)))
  const ohneDatum = plan(release(902, []), { firstEpisodeDate: undefined })
  pruefe('Termin ohne Datum: kein Tag', tag(ohneDatum, KALENDER) === undefined && tag(ohneDatum, adnKatalogUrl(912)) === undefined)
  pruefe('gezeigte Uhrzeit wie im Abruf: Tag', tag(plan(release(902, []), { time: '09:00' }), KALENDER) === '2026-10-19')
  pruefe('gezeigte Uhrzeit anders als im Abruf: kein Tag', tag(plan(release(902, []), { time: '18:00' }), KALENDER) === undefined && tag(plan(release(912, []), { time: '18:00' }), adnKatalogUrl(912)) === undefined)
  pruefe('geschätzte Uhrzeit steht nicht im Beleg und zählt nicht', tag(plan(release(902, []), { time: '18:00', estimated: true }), KALENDER) === '2026-10-19')

  const quellen: Quelle[] = [
    { url: 'https://www.anime2you.de/news/1/x/', name: 'anime2you.de', gesehenAm: '2026-10-01' },
    { url: KALENDER, name: 'ADN API', gesehenAm: '2026-10-01' },
  ]
  const mit = mitLesetag(release(902, []), quellen, tag)
  pruefe('mitLesetag: nur die API-Quelle bekommt den Lesetag, die Erstsichtung bleibt', mit[0]!.gelesenAm === undefined && mit[1]!.gelesenAm === '2026-10-19' && mit[1]!.gesehenAm === '2026-10-01', mit)
  pruefe('mitLesetag: die API-Quelle trägt das bestätigte Datum, die andere nicht; kein sagt', mit[1]!.bestaetigt === '2026-10-29' && mit[0]!.bestaetigt === undefined && mit[1]!.sagt === undefined, mit)

  console.log('\nLesetag aus der Historie, wenn der heutige Abruf das Datum nicht mehr zeigt (Prüfer 1598 R4)')
  const ohneTag: Quelle[] = [{ url: KALENDER, name: 'ADN API', gesehenAm: '2026-10-01' }]
  const hist = (bestaetigt: string | undefined, gelesenAm: string | undefined, url = KALENDER): Quelle[] => [{ url, name: 'ADN API', gesehenAm: '2026-10-01', bestaetigt, gelesenAm }]
  const behalten = (h: Quelle[], termin: string | undefined, neu = ohneTag) => behalteLesetag(neu, h, termin)[0]!.gelesenAm
  pruefe('dasselbe Datum bestätigt: der alte Lesetag bleibt', behalten(hist('2026-10-29', '2026-10-19'), '2026-10-29') === '2026-10-19')
  pruefe('anderes Datum bestätigt: kein Lesetag', behalten(hist('2026-10-22', '2026-10-19'), '2026-10-29') === undefined)
  pruefe('Historie ohne Lesetag oder ohne bestätigtes Datum: keiner', behalten(hist('2026-10-29', undefined), '2026-10-29') === undefined && behalten(hist(undefined, '2026-10-19'), '2026-10-29') === undefined)
  pruefe('Termin ohne Datum: keiner', behalten(hist(undefined, '2026-10-19'), undefined) === undefined)
  pruefe('andere Adresse in der Historie: keiner', behalten(hist('2026-10-29', '2026-10-19', adnKatalogUrl(902)), '2026-10-29') === undefined)
  const heutig: Quelle[] = [{ ...ohneTag[0]!, gelesenAm: '2026-10-20' }]
  pruefe('der heutige Lesetag schlägt die Historie', behalten(hist('2026-10-29', '2026-10-19'), '2026-10-29', heutig) === '2026-10-20')
  const zwei = behalteLesetag([quellen[0]!, ohneTag[0]!], [...hist('2026-10-29', '2026-10-19'), { ...quellen[0]!, gelesenAm: '2026-10-18', bestaetigt: '2026-10-29' }], '2026-10-29')
  pruefe('jede Quelle findet ihren eigenen Eintrag', zwei[0]!.gelesenAm === '2026-10-18' && zwei[1]!.gelesenAm === '2026-10-19', zwei)
  /* So stehen 125 ADN-Quellen im Bestand (19.10.2026): `sagt` aus der Zeit, als quellenPflegen unseren Termin eintrug. */
  const zirkel: Quelle[] = [{ ...hist('2026-10-22', '2026-10-19')[0]!, sagt: '2026-10-29' }]
  pruefe('altes `sagt` gleich dem Termin, bestätigt war ein anderes Datum: kein Lesetag', behalten(zirkel, '2026-10-29') === undefined, zirkel)
  pruefe('behaltener Lesetag trägt sein Datum weiter', behalteLesetag(ohneTag, hist('2026-10-29', '2026-10-19'), '2026-10-29')[0]!.bestaetigt === '2026-10-29')

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
  ergaenzeAdnTitel({ titles, releases: gebaut, titleByName, seenSlugs: new Set([kal, kat, nachbar].map((r) => r.slug)) })
  /* Wie die kuratierten Bleach-Filme: Kalender-Adresse in `sources`, Datum aber aus der Handdatei. */
  const kuratiert = { ...plan(release(903, [KALENDER]), { firstEpisodeDate: '2026-11-05' }), slug: 'erfunden-903-adn' } as Release
  quellenPflegen([kal, kuratiert, kat, nachbar, ...gebaut])
  const api = (r: Release | undefined) => r?.quellen?.find((q) => q.stand === 'aktuell')
  pruefe('kuratierter Termin, dessen Datum nicht im Kalender steht: kein Lesetag, kein `sagt`', Boolean(api(kuratiert)) && api(kuratiert)?.gelesenAm === undefined && api(kuratiert)?.sagt === undefined, kuratiert.quellen)
  pruefe('bestätigtes Datum: die API-Quelle trägt es, ohne `sagt`', api(kal)?.bestaetigt === '2026-10-29' && api(kat)?.bestaetigt === '2026-10-29' && api(kal)?.sagt === undefined, [kal.quellen, kat.quellen])
  pruefe('Kalender-Termin: Erstsichtung 01.10. bleibt, Lesetag 19.10.', api(kal)?.gesehenAm === '2026-10-01' && api(kal)?.gelesenAm === '2026-10-19', kal.quellen)
  pruefe('Katalog-Termin: Lesetag aus dem Serienabruf', api(kat)?.gelesenAm === '2026-10-15', kat.quellen)
  pruefe('Katalog-Termin ohne jüngeren Serienabruf: Lesetag aus dem Katalogabruf', api(nachbar)?.gelesenAm === '2026-10-12', nachbar.quellen)

  console.log('\nBau: 07-adn wählt die Adresse, quellenPflegen den Lesetag')
  const ausKalender = gebaut.find((r) => r.titleId === 904)
  const ausKatalog = gebaut.find((r) => r.titleId === 914)
  pruefe('Serie aus dem Kalender: Kalender-Adresse, Lesetag des Kalenderabrufs', ausKalender?.sources.join() === KALENDER && api(ausKalender)?.gelesenAm === '2026-10-19', ausKalender?.quellen)
  pruefe('Serie nur im Katalog: Adresse ihrer Folgenliste, Lesetag des Katalogabrufs (Prüfer 1598 A2)', ausKatalog?.sources.join() === adnKatalogUrl(914) && api(ausKatalog)?.gelesenAm === '2026-10-12', ausKatalog?.quellen)

  console.log('\nFolgelauf: am nächsten Tag ist der 29.10. aus dem Kalender gefallen, Serie 913 aus dem Katalog (Prüfer 1598 R4)')
  const morgen = daten('2026-10-20T04:09:00Z', 901, 903)
  morgen.shows.push({ ...show(902), episodes: [{ date: '2026-11-05', time: '09:00', url: '' }] })
  writeFileSync(join(wurzel, 'data', 'adn.json'), JSON.stringify(morgen))
  writeFileSync(join(wurzel, 'data', 'adn-catalog.json'), JSON.stringify(daten('2026-10-20T08:00:00Z', 911, 912)))
  const kal2 = release(902, [KALENDER])
  const nachbar2 = release(913, [adnKatalogUrl(913)])
  const verschoben = plan(release(912, [adnKatalogUrl(912)]), { firstEpisodeDate: '2026-11-05' })
  const neuBestaetigt = release(911, [adnKatalogUrl(911)])
  quellenPflegen([kal2, nachbar2, verschoben, neuBestaetigt])
  pruefe('Kalender-Termin: Lesetag vom 19.10. bleibt (Datum nicht mehr im Fenster)', api(kal2)?.gelesenAm === '2026-10-19', kal2.quellen)
  pruefe('Katalog-Termin, Serie nicht mehr im Abruf: Lesetag vom 12.10. bleibt', api(nachbar2)?.gelesenAm === '2026-10-12', nachbar2.quellen)
  pruefe('Termin auf ein Datum verschoben, das kein Abruf bestätigt: kein Lesetag', Boolean(api(verschoben)) && api(verschoben)?.gelesenAm === undefined, verschoben.quellen)
  pruefe('Datum heute bestätigt: der heutige Lesetag', api(neuBestaetigt)?.gelesenAm === '2026-10-20', neuBestaetigt.quellen)
  rmSync(join(wurzel, 'data', 'adn.json'))
  const kal3 = release(902, [KALENDER])
  quellenPflegen([kal3])
  pruefe('gescheiterter Abruf (adn.json fehlt): Lesetag vom 19.10. bleibt', api(kal3)?.gelesenAm === '2026-10-19', kal3.quellen)

  console.log('\nAdresswechsel: der Lesetag gibt der alten API-Quelle keine Aussage (`sagt`), sie gilt nicht als widerlegt (Prüfer 1598 R5)')
  const kalAlt = (r: Release) => r.quellen?.find((q) => q.url === KALENDER)
  const gewechselt = plan(release(902, [adnKatalogUrl(902)]), { firstEpisodeDate: '2026-11-05' })
  quellenPflegen([gewechselt])
  pruefe('neue Adresse, anderes Datum: alte Quelle vermutlich überholt, ohne Grund', kalAlt(gewechselt)?.stand === 'vermutlich-ueberholt' && kalAlt(gewechselt)?.grund === undefined && kalAlt(gewechselt)?.gelesenAm === '2026-10-19', gewechselt.quellen)

  console.log('\nFehlzuordnung: die frühere Kalender-Adresse einer Katalog-Serie zählt nicht als überholter Beleg (Prüfer 1598 R2, A10)')
  const artikel = 'https://www.anime2you.de/news/1/x/'
  const vorher = (slug: string, quellen: Quelle[]) => writeFileSync(join(wurzel, 'data', 'quellen-historie.json'), JSON.stringify({ [slug]: quellen }))
  const ungelesen: Quelle = { url: KALENDER, name: 'ADN API', gesehenAm: '2026-10-01', stand: 'aktuell' }
  const gelesen: Quelle = { ...ungelesen, gelesenAm: '2026-10-05', bestaetigt: '2026-10-29' }
  const presse: Quelle = { url: artikel, name: 'anime2you.de', gesehenAm: '2026-10-01', stand: 'aktuell' }
  const katalogNeu: Quelle[] = [{ url: adnKatalogUrl(905), name: 'ADN API', gesehenAm: '2026-10-19' }]
  pruefe('Einheit: ungelesene Kalender-Adresse fällt bei einer Katalog-Serie weg, andere Quellen bleiben', JSON.stringify(ohneFehlzuordnung([ungelesen, presse], katalogNeu)) === JSON.stringify([presse]))
  pruefe('Einheit: eine vom Kalender gelesene Adresse bleibt (echter überholter Beleg)', ohneFehlzuordnung([gelesen], katalogNeu).length === 1)
  pruefe('Einheit: bei einer Kalender-Serie bleibt die Kalender-Adresse', ohneFehlzuordnung([ungelesen], [{ url: KALENDER, name: 'ADN API', gesehenAm: '2026-10-19' }]).length === 1)
  /* Wie der Bestand: Termin auf die Adresse der Folgenliste umgestellt, in der Historie steht noch die Kalender-Adresse. */
  vorher('adn-905', [ungelesen, presse])
  const umgestellt = release(905, [artikel, adnKatalogUrl(905)])
  quellenPflegen([umgestellt])
  const adressen = (r: Release) => r.quellen?.map((q) => `${q.url} ${q.stand}`) ?? []
  pruefe('Bau: Kalender-Adresse ist weder aktuell noch vermutlich überholt', !adressen(umgestellt).some((a) => a.startsWith(KALENDER)), adressen(umgestellt))
  pruefe('Bau: eine andere alte Quelle der Serie bleibt erhalten', umgestellt.quellen?.some((q) => q.url === artikel) === true, adressen(umgestellt))
  vorher('adn-906', [gelesen])
  const echt = release(906, [adnKatalogUrl(906)])
  quellenPflegen([echt])
  pruefe('Bau: eine vom Kalender gelesene Adresse bleibt als vermutlich überholt', echt.quellen?.some((q) => q.url === KALENDER && q.stand === 'vermutlich-ueberholt') === true, adressen(echt))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nadn-lesetag: alle Zusicherungen halten')
