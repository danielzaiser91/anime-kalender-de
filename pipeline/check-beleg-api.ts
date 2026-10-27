/**
 * Zusicherungen zu „Ein Beleg führt nie auf eine API-Adresse und ist nie leer“ (Daniel, 19.10.2026, Madoka Magica:
 * „Originalseite bei ADN API“ → 400 Bad Request). Läuft hinter `check:logic`; die Bau-Zusicherung `apiBelegFehler`
 * sitzt in `belegFehler` und bricht den Bau bei einem Rückfall ab.
 */
import type { NewsEintrag, Release, Title } from '../shared/types.ts'
import { belegLink, istApiAdresse, istLink } from '../shared/quelle.ts'
import { baueNews } from './lib/news.ts'
import { adnApiBeleg, adnSerienseite, apiBelegFehler, apiBelegMitInhalt } from './lib/beleg-api.ts'
import { belegFehler, entdoppeleBelege, entdoppeleUndMelde } from './lib/beleg-anbieter.ts'
import { belegeFuerAlle } from './lib/beleg-lesung.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const API = 'https://gw.api.animationdigitalnetwork.com/video/calendar'
const ARTIKEL = 'https://news.animationdigitalnetwork.com/de/2026/09/28/line-up-zur-herbst-season-2026-neue-anime-bei-adn/'
const SERIE = 'https://animationdigitalnetwork.com/de/video/1318-puella-magi-madoka-magica'

console.log('\nAPI-Adressen sind kein Klickziel')
for (const u of [API, 'https://api.themoviedb.org/3/tv/1', 'https://graphql.anilist.co', 'https://x.de/api/v2/show', 'https://x.de/daten/serie.json'])
  pruefe(`API: ${u}`, istApiAdresse(u) && !istLink(u))
for (const u of [ARTIKEL, SERIE, 'https://www.anime2you.de/news/1059642/api-und-mehr/', 'https://www.crunchyroll.com/de/series/G6VQ0GQ8R/x'])
  pruefe(`Seite: ${u}`, !istApiAdresse(u) && istLink(u))
pruefe('Originalseite: die Seite des Belegs schlägt die API-Adresse', belegLink({ url: API, seite: SERIE }) === SERIE)
pruefe('Originalseite: eine API-Adresse ohne Seite ergibt keinen Link', belegLink({ url: API }) === undefined)
pruefe('Originalseite: eine API-Adresse als Seite ergibt keinen Link', belegLink({ url: ARTIKEL, seite: API }) === undefined)
pruefe('Pfad graphql und kaputte Adresse', istApiAdresse('https://x.de/graphql') && !istApiAdresse('keine Adresse') && !istLink('keine Adresse') && !istLink(undefined) && !istLink('ftp://x.de/a'))
pruefe('Originalseite: eine gewöhnliche Seite bleibt ihr eigener Link', belegLink({ url: ARTIKEL }) === ARTIKEL)

console.log('\nADN-Termin: Beleg aus dem Bau (baueNews)')
const titel = { id: 1, franchiseId: 1, slug: 't-1', titleEn: 'T1', keywords: [], genres: [], streams: [] } as unknown as Title
const release = (extra: Record<string, unknown> = {}): Release =>
  ({
    slug: 'adn-1318',
    titleId: 1,
    name: 'Puella Magi Madoka Magica',
    platform: 'adn',
    platformUrl: `${SERIE}/29565-folge-1`,
    releaseType: 'batch',
    schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 12 },
    sources: [ARTIKEL, API],
    quellen: [
      { url: ARTIKEL, name: 'news.animationdigitalnetwork.com', gesehenAm: '2026-10-17', stand: 'aktuell', bild: 'artikel.webp' },
      /* Erste Sichtung am 01.10., gelesen am 17.10.: die Messung nennt den Lesetag (Prüfer 1598 A1). */
      { url: API, name: 'ADN API', gesehenAm: '2026-10-01', gelesenAm: '2026-10-17', stand: 'aktuell' },
    ],
    ...extra,
  }) as unknown as Release
const belegeVon = (r: Release) => baueNews([titel], [r], [], [], { zuerst: {} })[0]?.meldungen.find((m) => m.art === 'angekuendigt')?.belege ?? []

{
  const belege = belegeVon(release())
  const api = belege.find((b) => b.url === API)
  pruefe('der API-Beleg bleibt, mit Messung', Boolean(api?.messung?.zeilen.length), belege)
  pruefe('Serie, gezählte Folgen, Datum und Sprache stehen drin, keine erfundene Startnummer', JSON.stringify(api?.messung?.zeilen) === JSON.stringify(['Serie: Puella Magi Madoka Magica', '12 Folgen', 'Datum: 29.10.2026, 09:00 Uhr', 'Sprache: Deutsch']), api?.messung)
  pruefe('Abrufzeit: der Lesetag (gelesenAm), nicht die Erstsichtung (gesehenAm)', api?.messung?.am === '2026-10-17', api)
  pruefe('Originalseite ist die Serienseite des Titels', api?.seite === SERIE && belegLink(api!) === SERIE, api)
  pruefe('kein Beleg des Termins hat eine API-Adresse als Link', belege.every((b) => !istApiAdresse(belegLink(b) ?? '')), belege)
  pruefe('der Artikel-Beleg bleibt unverändert', belege.some((b) => b.url === ARTIKEL && !b.messung && b.bild === 'artikel.webp'), belege)
  pruefe('der API-Beleg heißt ADN-Kalender, nicht ADN API', api?.name === 'ADN-Kalender', api)
  pruefe('Bau-Zusicherung: ohne Befund', apiBelegFehler([eintragMit(belege)]).length === 0)
}
{
  const ohneSeite = belegeVon(release({ platformUrl: undefined })).find((b) => b.url === API)
  pruefe('ohne Serienseite: Messung ja, Knopf nein', Boolean(ohneSeite?.messung) && belegLink(ohneSeite!) === undefined, ohneSeite)
  pruefe('Serienseite: keine Folge-Adresse, nicht von anderen Anbietern', adnSerienseite(release({ platform: 'netflix' })) === undefined && adnSerienseite(release({ platformUrl: 'https://www.netflix.com/title/1' })) === undefined)
  const ohneTag = belegeVon(release({ quellen: [{ url: API, name: 'ADN API', gesehenAm: '2026-10-01', stand: 'aktuell' }] }))
  pruefe('ohne Lesetag (nur Erstsichtung) entsteht kein leerer API-Beleg', !ohneTag.some((b) => istApiAdresse(b.url)), ohneTag)
  const KATALOG = 'https://gw.api.animationdigitalnetwork.com/video/show/1318'
  const katalog = belegeVon(release({ sources: [KATALOG], quellen: [{ url: KATALOG, name: 'ADN API', gesehenAm: '2026-10-01', gelesenAm: '2026-10-12', stand: 'aktuell' }] }))
  const kat = katalog.find((b) => b.url === KATALOG)
  pruefe('Katalog-Termin ohne Kalendereintrag: weder Name noch Messquelle „ADN-Kalender“ (Prüfer 1598 A2)', kat?.name === 'ADN-Katalog' && kat.messung?.quelle === 'ADN-Katalog' && kat.messung.am === '2026-10-12', katalog)
  const kalenderZusatz = belegeVon(release({ quellen: [{ url: `${KATALOG}/extra`, name: 'ADN API', gesehenAm: '2026-10-01', gelesenAm: '2026-10-12', stand: 'aktuell' }] }))
  pruefe('andere ADN-API-Adresse: kein Beleg (nur Kalender und Folgenliste der Serie sind bekannt)', !kalenderZusatz.some((b) => istApiAdresse(b.url)), kalenderZusatz)
  const nurQuelle = belegeVon(release({ quellen: [] }))
  pruefe('eine API-Adresse nur in `sources` wird kein Beleg', !nurQuelle.some((b) => istApiAdresse(b.url)), nurQuelle)
  const einzel = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 1 } })).find((b) => b.url === API)
  pruefe('eine gezählte Folge: „1 Folge“', einzel?.messung?.zeilen[1] === '1 Folge', einzel?.messung)
  const geschaetzt = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 12, episodeCountAssumed: true, estimated: true } })).find((b) => b.url === API)
  pruefe('angenommene Folgenzahl und geschätzte Uhrzeit stehen nicht drin', geschaetzt?.messung?.zeilen.join('|') === 'Serie: Puella Magi Madoka Magica|Datum: 29.10.2026|Sprache: Deutsch', geschaetzt?.messung)
  const mitten = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 12, firstEpisodeNumber: 13 } })).find((b) => b.url === API)
  pruefe('Block mitten in der Serie mit belegter Startnummer: „Folge 13 bis 24“', mitten?.messung?.zeilen[1] === 'Folge 13 bis 24', mitten?.messung)
  const mittenEine = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', episodeCount: 1, firstEpisodeNumber: 5 } })).find((b) => b.url === API)
  pruefe('eine Folge mit belegter Nummer: „Folge 5“', mittenEine?.messung?.zeilen[1] === 'Folge 5', mittenEine?.messung)
  const nurNummer = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', firstEpisodeNumber: 5 } })).find((b) => b.url === API)
  pruefe('belegte Startnummer ohne Zahl: „Folge 5“', nurNummer?.messung?.zeilen[1] === 'Folge 5', nurNummer?.messung)
  const ohneZeit = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', episodeCount: 12 } })).find((b) => b.url === API)
  pruefe('ohne Uhrzeit steht nur das Datum da', ohneZeit?.messung?.zeilen[2] === 'Datum: 29.10.2026', ohneZeit?.messung)
  const adnFremdeApi = belegeVon(release({ sources: ['https://api.example.com/x'], quellen: [{ url: 'https://api.example.com/x', name: 'x', gesehenAm: '2026-10-17', stand: 'aktuell' }] }))
  pruefe('ein ADN-Termin macht aus fremder API-Adresse keinen ADN-Beleg', !adnFremdeApi.some((b) => istApiAdresse(b.url)), adnFremdeApi)
  const netflixAdn = belegeVon(release({ platform: 'netflix' }))
  pruefe('ein Netflix-Termin macht aus der ADN-Adresse keinen ADN-Beleg', !netflixAdn.some((b) => istApiAdresse(b.url)), netflixAdn)
  const fremd = belegeVon(release({ platform: 'netflix', sources: ['https://api.example.com/x'], quellen: [{ url: 'https://api.example.com/x', name: 'x', gesehenAm: '2026-10-17', stand: 'aktuell' }] }))
  pruefe('eine fremde API-Adresse wird nie ein Beleg', !fremd.some((b) => istApiAdresse(b.url)), fremd)
}

console.log('\nADN-Endpunkt: nur die ganze Adresse zählt (Prüfer 1598 B27)')
{
  const beleg = (url: string) => adnApiBeleg(release(), url, '2026-10-17')
  pruefe('Kalender und Katalog-Serie werden erkannt', beleg(API)?.name === 'ADN-Kalender' && beleg('https://gw.api.animationdigitalnetwork.com/video/show/1318')?.name === 'ADN-Katalog')
  for (const url of [`https://x.de/?u=${API}`, `x${API}`, `${API}/x`, `${API}?date=1`, API.replace('https', 'http'), API.replace('gw.api', 'api'), API.replace('/calendar', '/show/abc'), API.replace('/calendar', '/show/'), API.toUpperCase(), ` ${API}`, `${API} `])
    pruefe(`fremde oder angehängte Adresse ergibt keinen Beleg: ${url}`, beleg(url) === undefined)
}

console.log('\nBau-Zusicherung: Rückfall wird rot')
function eintragMit(belege: NonNullable<NewsEintrag['meldungen'][number]['belege']>): NewsEintrag {
  return { am: '2026-10-17', titelId: 1, titel: 'Madoka', slug: 't-1', meldungen: [{ art: 'angekuendigt', belege }] } as NewsEintrag
}
{
  const leer = eintragMit([{ url: API, name: 'ADN API' }])
  pruefe('API-Beleg ohne Inhalt: Befund', apiBelegFehler([leer]).length === 1, apiBelegFehler([leer]))
  const leereZeilen = eintragMit([{ url: API, name: 'ADN-Kalender', messung: { am: '2026-10-17', quelle: 'ADN-Kalender', zeilen: [] } }])
  pruefe('API-Beleg mit Messung, aber ohne Zeilen: Befund (Prüfer 1598 A3)', apiBelegFehler([leereZeilen]).length === 1, apiBelegFehler([leereZeilen]))
  pruefe('API-Adresse als Originalseite: Befund', apiBelegFehler([eintragMit([{ url: ARTIKEL, name: 'x', seite: API }])]).length === 1)
  pruefe('gewöhnlicher Beleg ohne Inhalt: kein Befund (Händlerseite trägt ihren Link)', apiBelegFehler([eintragMit([{ url: 'https://www.amazon.de/dp/1', name: 'x' }])]).length === 0)
  pruefe('belegFehler (der Bau) meldet den leeren API-Beleg', belegFehler([leer], entdoppeleBelege([leer])).some((f) => f.includes('API-Adresse')))
  const sauber = eintragMit([{ url: ARTIKEL, name: 'x' }])
  pruefe('belegFehler prüft das Ergebnis, nicht die Eingabe', belegFehler([sauber], { eintraege: [leer], entfallen: [], vorher: 1 }).some((f) => f.includes('API-Adresse')))
  pruefe('belegFehler: eine API-Eingabe, die entfällt, ist kein Befund', !belegFehler([leer], { eintraege: [sauber], entfallen: [{ titel: 'x', am: 'x', behalten: 'x', entfallen: 'x' }], vorher: 1 }).some((f) => f.includes('API-Adresse')))
}

console.log('\nDie Kette des Baus (baueNews → belegeFuerAlle → entdoppeleUndMelde), wie in 13-5-kerndateien.ts')
{
  const kette = (r: Release) => entdoppeleUndMelde(belegeFuerAlle(baueNews([titel], [r], [], [], { zuerst: {} }), {}))
  const belegeDer = (es: NewsEintrag[]) => es.flatMap((e) => e.meldungen).flatMap((m) => m.belege ?? [])
  const nurApi = (extra: Record<string, unknown> = {}) => release({ sources: [API], quellen: undefined, ...extra })
  /* `quelleVonRelease` fällt auf die API-Adresse zurück, wenn nur sie da ist; daraus darf kein Beleg ohne Inhalt entstehen. */
  const ohneQuellen = baueNews([titel], [nurApi()], [], [], { zuerst: {} })[0]?.meldungen[0]
  pruefe('Ausgangslage: `sources` nur API ergibt eine Meldung mit API-Adresse als Quelle', ohneQuellen?.quelle === API, ohneQuellen)
  let wurf = ''
  const probe = (name: string, r: Release, erwartet: (b: ReturnType<typeof belegeDer>) => boolean) => {
    try {
      const belege = belegeDer(kette(r))
      pruefe(name, erwartet(belege), belege)
    } catch (e) {
      wurf = (e as Error).message
      pruefe(name, false, wurf)
    }
  }
  probe('nur API in `sources`, kein `quellen`: Bau läuft, kein API-Beleg', nurApi(), (b) => !b.some((x) => istApiAdresse(x.url)))
  probe('nur API in `quellen` ohne Lesetag: Bau läuft, kein API-Beleg', nurApi({ quellen: [{ url: API, name: 'ADN API', gesehenAm: '2026-10-01', stand: 'aktuell' }] }), (b) => !b.some((x) => istApiAdresse(x.url)))
  probe('Nicht-ADN-Termin mit API-Quelle: Bau läuft, kein API-Beleg', nurApi({ platform: 'netflix', sources: ['https://api.example.com/x'], quellen: [{ url: 'https://api.example.com/x', name: 'x', gesehenAm: '2026-10-17', stand: 'aktuell' }] }), (b) => !b.some((x) => istApiAdresse(x.url)))
  probe('ADN-Termin mit Abrufdatum: der API-Beleg überlebt die Kette mit Messung', release(), (b) => b.some((x) => x.url === API && Boolean(x.messung?.zeilen.length) && x.seite === SERIE))
  const vorhanden = eintragMit([{ url: API, name: 'ADN API' }])
  const danach = belegeFuerAlle([vorhanden], {})
  pruefe('Meldung mit nur einem leeren API-Beleg: die Belege entfallen, der Bau läuft', !danach[0]?.meldungen[0]?.belege?.length && entdoppeleUndMelde(danach).length === 1, danach)
  const gemischt = belegeFuerAlle([eintragMit([{ url: API, name: 'ADN API' }, { url: ARTIKEL, name: 'x' }])], {})
  pruefe('Meldung mit leerem API-Beleg und Artikel: nur der Artikel bleibt', gemischt[0]?.meldungen[0]?.belege?.map((b) => b.url).join() === ARTIKEL, gemischt)
  pruefe('apiBelegMitInhalt: Seite ja, API ohne Messung nein, API mit Messung ja', apiBelegMitInhalt({ url: ARTIKEL, name: 'x' }) && !apiBelegMitInhalt({ url: API, name: 'x' }) && apiBelegMitInhalt({ url: API, name: 'x', messung: { am: 'a', quelle: 'q', zeilen: ['z'] } }))
  pruefe('apiBelegMitInhalt: API mit Messung ohne Zeilen nein', !apiBelegMitInhalt({ url: API, name: 'x', messung: { am: 'a', quelle: 'q', zeilen: [] } }))
  let geworfen = false
  try {
    entdoppeleUndMelde([eintragMit([{ url: API, name: 'ADN API' }])])
  } catch {
    geworfen = true
  }
  pruefe('Gegenprobe: ein von Hand eingeschleuster leerer API-Beleg bricht den Bau ab', geworfen)
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nbeleg-api: alle Zusicherungen halten')
