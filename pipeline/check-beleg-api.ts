/**
 * Zusicherungen zu „Ein Beleg führt nie auf eine API-Adresse und ist nie leer“ (Daniel, 19.10.2026, Madoka Magica:
 * „Originalseite bei ADN API“ → 400 Bad Request). Läuft hinter `check:logic`; die Bau-Zusicherung `apiBelegFehler`
 * sitzt in `belegFehler` und bricht den Bau bei einem Rückfall ab.
 */
import type { NewsEintrag, Release, Title } from '../shared/types.ts'
import { belegLink, istApiAdresse, istLink } from '../shared/quelle.ts'
import { baueNews } from './lib/news.ts'
import { adnSerienseite, apiBelegFehler } from './lib/beleg-api.ts'
import { belegFehler, entdoppeleBelege } from './lib/beleg-anbieter.ts'

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
      { url: API, name: 'ADN API', gesehenAm: '2026-10-17', stand: 'aktuell' },
    ],
    ...extra,
  }) as unknown as Release
const belegeVon = (r: Release) => baueNews([titel], [r], [], [], { zuerst: {} })[0]?.meldungen.find((m) => m.art === 'angekuendigt')?.belege ?? []

{
  const belege = belegeVon(release())
  const api = belege.find((b) => b.url === API)
  pruefe('der API-Beleg bleibt, mit Messung', Boolean(api?.messung?.zeilen.length), belege)
  pruefe('Titel, Folge, Datum und Sprache stehen drin', JSON.stringify(api?.messung?.zeilen) === JSON.stringify(['Titel: Puella Magi Madoka Magica', 'Folge 1 bis 12', 'Datum: 29.10.2026, 09:00 Uhr', 'Sprache: Deutsch']), api?.messung)
  pruefe('Abrufzeit: der Tag, an dem wir den Kalender sahen', api?.messung?.am === '2026-10-17', api)
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
  const ohneTag = belegeVon(release({ quellen: [{ url: API, name: 'ADN API', gesehenAm: '', stand: 'aktuell' }] }))
  pruefe('ohne Abrufdatum entsteht kein leerer API-Beleg', !ohneTag.some((b) => istApiAdresse(b.url)), ohneTag)
  const nurQuelle = belegeVon(release({ quellen: [] }))
  pruefe('eine API-Adresse nur in `sources` wird kein Beleg', !nurQuelle.some((b) => istApiAdresse(b.url)), nurQuelle)
  const einzel = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 1 } })).find((b) => b.url === API)
  pruefe('eine Folge: „Folge 1“ ohne „bis“', einzel?.messung?.zeilen[1] === 'Folge 1', einzel?.messung)
  const geschaetzt = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', time: '09:00', episodeCount: 12, episodeCountAssumed: true, estimated: true } })).find((b) => b.url === API)
  pruefe('angenommene Folgenzahl und geschätzte Uhrzeit stehen nicht drin', geschaetzt?.messung?.zeilen[1] === 'Folge 1' && geschaetzt.messung.zeilen[2] === 'Datum: 29.10.2026', geschaetzt?.messung)
  const ohneZeit = belegeVon(release({ schedule: { firstEpisodeDate: '2026-10-29', episodeCount: 12 } })).find((b) => b.url === API)
  pruefe('ohne Uhrzeit steht nur das Datum da', ohneZeit?.messung?.zeilen[2] === 'Datum: 29.10.2026', ohneZeit?.messung)
  const adnFremdeApi =belegeVon(release({ sources: ['https://api.example.com/x'], quellen: [{ url: 'https://api.example.com/x', name: 'x', gesehenAm: '2026-10-17', stand: 'aktuell' }] }))
  pruefe('ein ADN-Termin macht aus fremder API-Adresse keinen ADN-Beleg', !adnFremdeApi.some((b) => istApiAdresse(b.url)), adnFremdeApi)
  const netflixAdn = belegeVon(release({ platform: 'netflix' }))
  pruefe('ein Netflix-Termin macht aus der ADN-Adresse keinen ADN-Beleg', !netflixAdn.some((b) => istApiAdresse(b.url)), netflixAdn)
  const fremd = belegeVon(release({ platform: 'netflix', sources: ['https://api.example.com/x'], quellen: [{ url: 'https://api.example.com/x', name: 'x', gesehenAm: '2026-10-17', stand: 'aktuell' }] }))
  pruefe('eine fremde API-Adresse wird nie ein Beleg', !fremd.some((b) => istApiAdresse(b.url)), fremd)
}

console.log('\nBau-Zusicherung: Rückfall wird rot')
function eintragMit(belege: NonNullable<NewsEintrag['meldungen'][number]['belege']>): NewsEintrag {
  return { am: '2026-10-17', titelId: 1, titel: 'Madoka', slug: 't-1', meldungen: [{ art: 'angekuendigt', belege }] } as NewsEintrag
}
{
  const leer = eintragMit([{ url: API, name: 'ADN API' }])
  pruefe('API-Beleg ohne Inhalt: Befund', apiBelegFehler([leer]).length === 1, apiBelegFehler([leer]))
  pruefe('API-Adresse als Originalseite: Befund', apiBelegFehler([eintragMit([{ url: ARTIKEL, name: 'x', seite: API }])]).length === 1)
  pruefe('gewöhnlicher Beleg ohne Inhalt: kein Befund (Händlerseite trägt ihren Link)', apiBelegFehler([eintragMit([{ url: 'https://www.amazon.de/dp/1', name: 'x' }])]).length === 0)
  pruefe('belegFehler (der Bau) meldet den leeren API-Beleg', belegFehler([leer], entdoppeleBelege([leer])).some((f) => f.includes('API-Adresse')))
  const sauber = eintragMit([{ url: ARTIKEL, name: 'x' }])
  pruefe('belegFehler prüft das Ergebnis, nicht die Eingabe', belegFehler([sauber], { eintraege: [leer], entfallen: [], vorher: 1 }).some((f) => f.includes('API-Adresse')))
  pruefe('belegFehler: eine API-Eingabe, die entfällt, ist kein Befund', !belegFehler([leer], { eintraege: [sauber], entfallen: [{ titel: 'x', am: 'x', behalten: 'x', entfallen: 'x' }], vorher: 1 }).some((f) => f.includes('API-Adresse')))
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nbeleg-api: alle Zusicherungen halten')
