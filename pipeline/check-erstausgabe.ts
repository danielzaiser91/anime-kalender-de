/**
 * Zusicherung (F9, Daniel 14.10.2026): Ein Katalogdatum, das zugleich der erste Tag der deutschen Fassung ist (aniSearch-Erstausgabe, belegte Synchro,
 * kein Anbieter früher), heißt „Erstveröffentlichung“ und nicht „Neu bei X“. Ein später dazugekommener Anbieter bleibt „Neu bei“.
 * Aufruf: `npm run check:logic`.
 */
import { NEIN_ID } from './lib/kulisse-erstausgabe.ts'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { ERSTAUSGABE_HINWEIS, eventDescription, eventSummary } from '../shared/ics.ts'
import { digestMail } from '../worker/src/templates.ts'
import { ART_STIL, istBreit, kartenArt } from '../web/src/lib/kachel-folgen.ts'
import { TEXTE_KALENDER } from '../web/src/lib/i18n-kalender.ts'
import { terminZeilen } from './lib/og-termin.ts'
import { erstausgabeTrotzNein, istErstausgabe, markiereErstausgabe } from './bau/erstausgabe-markieren.ts'
import { ergaenzeAngebotTermine, terminiereNeueReleases } from './bau/13-7-angebot-termine.ts'
import { rolleTermineAusMitKomplettabwurf } from './bau/10-komplettabwurf.ts'
import type { rolleTermineAus } from './bau/10-termine.ts'
import { loadDubChecks, neinHandbelege } from './lib/dub-confirmed.ts'
import { istNahAmJapanStart } from './lib/nah-am-japan-start.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TAG = '2026-01-06'
const KEIN_NEIN: ReadonlySet<string> = new Set()
/** Japanischer Start 66 Tage vor dem deutschen Tag: weit genug weg, die Synchro an diesem Tag ist belegt. */
const JP_FRUEH = '2025-11-01'
const titel = (o: Partial<Title['deErstausgabe']> | null = {}, id = 1, jpStartTag: string | null = JP_FRUEH, format = 'TV'): Title =>
  ({ id, format, jpStartTag: jpStartTag ?? undefined, ...(o ? { deErstausgabe: { von: TAG, publisher: 'Amazon.com, Inc.', synchro: true, ...o } } : {}) }) as unknown as Title
const katalog = (o: Partial<Release> = {}): Release =>
  ({
    slug: 'anisearch-1-primevideo',
    titleId: 1,
    name: 'Darwin',
    platform: 'primevideo',
    platformUrl: 'https://www.amazon.de/dp/B0TEST',
    releaseType: 'batch',
    dateMeaning: 'available-from',
    schedule: { firstEpisodeDate: TAG, episodeCount: 13, lastEpisodeDate: TAG },
    sources: ['https://www.anisearch.de/anime/1'],
    ...o,
  }) as Release
const anderer = (o: Partial<Release> = {}): Release =>
  katalog({ slug: 'crunchyroll-1', platform: 'crunchyroll', releaseType: 'weekly', dateMeaning: undefined, schedule: { firstEpisodeDate: '2026-01-02', episodeCount: 12 }, ...o })
/** Ein Handbeleg „nur Untertitel“ zu Titel 1 bei Prime, wie ihn `neinHandbelege` aus der Datei liest. */
const NEIN_PRIME = neinHandbelege([{ anilistId: 1, platform: 'primevideo', dub: false }])

console.log('\nistNahAmJapanStart (Simulcast-Schwelle, geteilt mit dem Bau der aniSearch-Erstausgabe):')
{
  const tag = (iso: string) => Date.parse(iso)
  pruefe('am selben Tag: nah', istNahAmJapanStart(tag('2026-01-07'), tag('2026-01-07'), 'TV'))
  pruefe('einen Tag vor Japan: nah', istNahAmJapanStart(tag('2026-01-06'), tag('2026-01-07'), 'TV'))
  pruefe('30 Tage nach Japan: noch nah', istNahAmJapanStart(tag('2026-01-06'), tag('2025-12-07'), 'TV'))
  pruefe('31 Tage nach Japan: nicht mehr nah', !istNahAmJapanStart(tag('2026-01-06'), tag('2025-12-06'), 'TV'))
  pruefe('ein Film ist nie nah', !istNahAmJapanStart(tag('2026-01-07'), tag('2026-01-07'), 'MOVIE'))
  pruefe('vor 2012 ist nichts nah (echte Ausstrahlung mit Synchro)', !istNahAmJapanStart(tag('2005-01-07'), tag('2005-01-07'), 'TV'))
  pruefe('ohne japanischen Starttag: nicht nah', !istNahAmJapanStart(tag('2026-01-07'), undefined, 'TV'))
  pruefe('ohne deutschen Tag: nicht nah', !istNahAmJapanStart(undefined, tag('2026-01-07'), 'TV'))
}

console.log('\nistErstausgabe (die Regel):')
{
  const r = katalog()
  const ist = (t: Title | undefined, andere: Release[] = [], nein = KEIN_NEIN, rel = r) => istErstausgabe(rel, t, [rel, ...andere], nein)
  pruefe('Katalogtag = aniSearch-Erstausgabe, Synchro belegt, 66 Tage nach Japan, sonst kein Anbieter: Erstveröffentlichung', ist(titel()))
  pruefe('anderer Tag: „Neu bei“', !ist(titel({ von: '2026-01-05' })))
  pruefe('Erstausgabe ohne belegte Synchro (kann OmU sein): „Neu bei“', !ist(titel({ synchro: false })))
  pruefe('Titel ohne Erstausgabe: „Neu bei“', !ist(titel(null)))
  pruefe('Erstausgabe ohne Tagesdatum: „Neu bei“', !ist(titel({ von: undefined })))
  pruefe('ohne Titel: „Neu bei“', !ist(undefined))
  pruefe('ein anderer Anbieter war früher da: „Neu bei“ (Snowball Earth)', !ist(titel(), [anderer()]))
  pruefe('ein anderer Anbieter erst später: die Erstveröffentlichung bleibt', ist(titel(), [anderer({ schedule: { firstEpisodeDate: '2026-02-01', episodeCount: 12 } })]))
  pruefe('ein anderer Anbieter am selben Tag war nicht „vorher“: die Erstveröffentlichung bleibt', ist(titel(), [anderer({ schedule: { firstEpisodeDate: TAG, episodeCount: 12 } })]))
  pruefe('ein Fernsehtermin davor zählt als früherer Anbieter', !ist(titel(), [anderer({ platform: 'tv', slug: 'tv-1' })]))
  pruefe('eine frühere Disc zählt als früherer Anbieter (kein Anbieter vorher deutsch)', !ist(titel(), [anderer({ platform: 'disc', releaseType: 'disc', slug: 'disc-1' })]))
  pruefe('eine Disc am selben Tag oder später zählt nicht', ist(titel(), [anderer({ platform: 'disc', releaseType: 'disc', slug: 'disc-2', schedule: { firstEpisodeDate: '2026-03-01', episodeCount: 1 } })]))
  pruefe('ein widerlegter früherer Termin zählt nicht', ist(titel(), [anderer({ widerlegt: { grund: 'x', am: '2026-01-03', gemeldet: false } })]))
  pruefe('ein Termin mit Erscheinungsdatum (Premiere) ist nie „Neu bei“, also auch keine Erstveröffentlichung der Marke', !ist(titel(), [], KEIN_NEIN, katalog({ dateMeaning: undefined })))
  pruefe('Fernsehen und Disc tragen die Marke nicht', !ist(titel(), [], KEIN_NEIN, katalog({ platform: 'tv' })) && !ist(titel(), [], KEIN_NEIN, katalog({ platform: 'disc' })))
}

console.log('\nistErstausgabe: Synchro an diesem Tag belegt? (Prüfer-Befund Bleach „The Calamity“, 14.10.2026)')
{
  const r = katalog()
  const ist = (t: Title, rel = r, nein = KEIN_NEIN) => istErstausgabe(rel, t, [rel], nein)
  pruefe('Simulcast-Tag (Japan am selben Tag) ohne Handbeleg: „Neu bei“', !ist(titel({}, 1, TAG)))
  pruefe('Simulcast-Tag (Japan einen Tag danach) ohne Handbeleg: „Neu bei“', !ist(titel({}, 1, '2026-01-07')))
  pruefe('Japan 30 Tage vorher ist noch Simulcast: „Neu bei“', !ist(titel({}, 1, '2025-12-07')))
  pruefe('Japan 31 Tage vorher: Erstveröffentlichung', ist(titel({}, 1, '2025-12-06')))
  pruefe('ohne japanischen Starttag: „Neu bei“ (der Abstand ist unbekannt)', !ist(titel({}, 1, null)))
  pruefe('Film, 115 Tage nach Japan (Milky Subway): Erstveröffentlichung', ist(titel({}, 1, '2025-09-13', 'MOVIE')))
  pruefe('Handbeleg „Premiere“ im Streaming stützt den Tag, auch am Simulcast-Tag', ist(titel({}, 1, TAG), katalog({ premiere: { weg: 'stream', quelle: 'https://x' } })))
  pruefe('Handbeleg „Premiere*“ (vorher auf Disc) stützt ihn nicht', !ist(titel({}, 1, TAG), katalog({ premiere: { weg: 'stream', quelle: 'https://x', vorher: 'disc', vorherDatum: '2025-01-01' } })))
  pruefe('Handbeleg „Premiere“ für das Fernsehen stützt ihn nicht', !ist(titel({}, 1, TAG), katalog({ premiere: { weg: 'tv', quelle: 'https://x' } })))
  pruefe('Netflix-Eigenproduktion am Simulcast-Tag: Erstveröffentlichung', ist(titel({}, 1, TAG), katalog({ platform: 'netflix', netflixOriginal: true })))
  pruefe('Netflix ohne Eigenproduktion am Simulcast-Tag: „Neu bei“', !ist(titel({}, 1, TAG), katalog({ platform: 'netflix' })))
  pruefe('Eigenproduktion-Marke bei einem anderen Anbieter zählt nicht', !ist(titel({}, 1, TAG), katalog({ netflixOriginal: true })))
  pruefe('Nein-Handbeleg „nur Untertitel“ zum Anbieter: „Neu bei“, auch weit nach Japan', !ist(titel(), r, NEIN_PRIME))
  pruefe('Nein-Handbeleg, auch wenn ein Premiere-Handbeleg am Release steht', !ist(titel({}, 1, TAG), katalog({ premiere: { weg: 'stream', quelle: 'https://x' } }), NEIN_PRIME))
  /* Zwei Ausgaben beim selben Anbieter (Digimon bei Prime): das Nein gehört nur der Adresse, die es nennt. */
  const adresseNein = neinHandbelege([
    { anilistId: 1, platform: 'primevideo', dub: true, url: 'https://www.amazon.de/dp/B0JA' },
    { anilistId: 1, platform: 'primevideo', dub: false, url: 'https://www.amazon.de/dp/B0NEIN' },
  ])
  pruefe('Nein-Handbeleg einer Adresse trifft das Release mit dieser Adresse', !ist(titel(), katalog({ platformUrl: 'https://www.amazon.de/dp/B0NEIN' }), adresseNein))
  pruefe('… und nicht das Release der anderen Adresse', ist(titel(), katalog({ platformUrl: 'https://www.amazon.de/dp/B0JA' }), adresseNein))
  pruefe('Nein-Handbeleg eines anderen Anbieters gilt nicht', ist(titel(), katalog({ platform: 'netflix' }), NEIN_PRIME))
  pruefe('Nein-Handbeleg eines anderen Titels gilt nicht', ist(titel(), katalog({ titleId: 2 }), NEIN_PRIME))
}

console.log('\nerstausgabeTrotzNein (Zusicherung für check:handbelege):')
{
  const mit = katalog({ erstausgabe: true })
  const andererAnbieter = katalog({ slug: 'x-netflix', platform: 'netflix', erstausgabe: true })
  const ohneMarke = katalog({ slug: 'y-prime' })
  const gefunden = erstausgabeTrotzNein([mit, andererAnbieter, ohneMarke], NEIN_PRIME)
  pruefe('nennt genau das markierte Release, dessen Anbieter verneint ist', gefunden.length === 1 && gefunden[0] === 'anisearch-1-primevideo', gefunden)
  pruefe('ohne Nein-Handbeleg: nichts', erstausgabeTrotzNein([mit], KEIN_NEIN).length === 0)
  const adresseNein = neinHandbelege([
    { anilistId: 1, platform: 'primevideo', dub: true, url: 'https://www.amazon.de/dp/B0JA' },
    { anilistId: 1, platform: 'primevideo', dub: false, url: 'https://www.amazon.de/dp/B0NEIN' },
  ])
  const anderes = katalog({ erstausgabe: true, platformUrl: 'https://www.amazon.de/dp/B0JA' })
  const getroffen = katalog({ slug: 'z-prime', erstausgabe: true, platformUrl: 'https://www.amazon.de/dp/B0NEIN' })
  pruefe('ein Nein gilt nur der Adresse, die es nennt', JSON.stringify(erstausgabeTrotzNein([anderes, getroffen], adresseNein)) === '["z-prime"]', erstausgabeTrotzNein([anderes, getroffen], adresseNein))
}

console.log('\nmarkiereErstausgabe (Bau):')
{
  const a = katalog()
  const b = katalog({ slug: 'anisearch-2-netflix', titleId: 2, platform: 'netflix' })
  const c = katalog({ slug: 'motn-3-netflix', titleId: 3, platform: 'netflix' })
  const titles = new Map([[1, titel(undefined, 1)], [2, titel({ von: '2026-01-05' }, 2)], [3, titel(undefined, 3)]])
  const n = markiereErstausgabe({ alle: [a, b, c], pruefen: [a, b], titles, handNein: KEIN_NEIN })
  pruefe('markiert die Releases mit Erstausgabetag und zählt sie', n === 1 && a.erstausgabe === true && b.erstausgabe === undefined, [n, a.erstausgabe, b.erstausgabe])
  pruefe('ein Release außerhalb von „pruefen“ bleibt unberührt', c.erstausgabe === undefined)
  pruefe('zweiter Durchlauf zählt nichts doppelt', markiereErstausgabe({ alle: [a, b, c], pruefen: [a, b, c], titles, handNein: KEIN_NEIN }) === 1)
  const spaeter = katalog({ slug: 'anisearch-4-netflix', titleId: 4, platform: 'netflix' })
  const frueher = anderer({ titleId: 4, slug: 'crunchyroll-4' })
  const t4 = new Map([[4, titel(undefined, 4)]])
  pruefe('Titel mit früherem Anbieter in „alle“: nicht markiert, auch wenn nur das Katalog-Release geprüft wird', markiereErstausgabe({ alle: [spaeter, frueher], pruefen: [spaeter], titles: t4, handNein: KEIN_NEIN }) === 0 && spaeter.erstausgabe === undefined)
  pruefe('… in jeder Reihenfolge der Releases (der frühere steht vorn)', markiereErstausgabe({ alle: [frueher, spaeter], pruefen: [spaeter], titles: t4, handNein: KEIN_NEIN }) === 0 && spaeter.erstausgabe === undefined)
  const bleach = katalog({ slug: 'anisearch-5-prime', titleId: 5 })
  const nein5 = neinHandbelege([{ anilistId: 5, platform: 'primevideo', dub: false }])
  pruefe('Nein-Handbeleg zum Anbieter: nicht markiert', markiereErstausgabe({ alle: [bleach], pruefen: [bleach], titles: new Map([[5, titel(undefined, 5)]]), handNein: nein5 }) === 0 && bleach.erstausgabe === undefined)
}

console.log('\nAufrufer im Bau: die Marke steht, bevor die Termine entstehen:')
{
  const titles = new Map([[1, titel()]])
  const a = katalog()
  const events: ReleaseEvent[] = []
  const termine = terminiereNeueReleases({ events, neue: [a], alle: [a], titles, handNein: KEIN_NEIN })
  pruefe('späte Phase: der Termin trägt „erstausgabe“ und steht in „events“', termine[0]?.erstausgabe === true && termine[0].imAngebot === undefined && events.length === 1, termine)
  const b = katalog({ slug: 'anisearch-1-netflix', platform: 'netflix' })
  const ohneBeleg = terminiereNeueReleases({ events: [], neue: [b], alle: [b], titles: new Map([[1, titel({}, 1, '2026-01-07')]]), handNein: KEIN_NEIN })
  pruefe('späte Phase am Simulcast-Tag: „imAngebot“', ohneBeleg[0]?.imAngebot === true && ohneBeleg[0].erstausgabe === undefined, ohneBeleg)
  const mitNein = terminiereNeueReleases({ events: [], neue: [katalog()], alle: [katalog()], titles, handNein: NEIN_PRIME })
  pruefe('späte Phase mit Nein-Handbeleg: „imAngebot“', mitNein[0]?.imAngebot === true && mitNein[0].erstausgabe === undefined, mitNein)
  const fruehererTermin = anderer({ slug: 'crunchyroll-davor' })
  const mitFruehererem = terminiereNeueReleases({ events: [], neue: [katalog()], alle: [katalog(), fruehererTermin], titles, handNein: KEIN_NEIN })
  pruefe('späte Phase: ein früherer Anbieter aus „alle“ verhindert die Marke', mitFruehererem[0]?.imAngebot === true && mitFruehererem[0].erstausgabe === undefined, mitFruehererem)
  /* Frühe Phase: Die Attrappe sieht die Releases in dem Zustand, in dem `rolleTermineAus` sie bekäme. */
  const frueh = katalog({ slug: 'hensuki-crunchyroll', platform: 'crunchyroll', titleId: 987654 })
  const gesehen: (true | undefined)[] = []
  const rolle = ((args: { releases: Release[] }) => {
    gesehen.push(...args.releases.map((r) => r.erstausgabe))
    return {}
  }) as unknown as typeof rolleTermineAus
  const frueheTitel = new Map([[987654, titel(undefined, 987654)]])
  const aufruf = (releases: Release[], handNein: ReadonlySet<string>) =>
    rolleTermineAusMitKomplettabwurf({ releases, titles: frueheTitel, jpStart: new Map() }, { rolle, handNein: () => handNein })
  aufruf([frueh], KEIN_NEIN)
  pruefe('frühe Phase: `rolleTermineAus` bekommt das markierte Release', gesehen.length === 1 && gesehen[0] === true, gesehen)
  gesehen.length = 0
  aufruf([katalog({ slug: 'hensuki-crunchyroll', platform: 'crunchyroll', titleId: 987654 }), anderer({ slug: 'cr-davor', titleId: 987654 })], KEIN_NEIN)
  pruefe('frühe Phase: ein früherer Anbieter unter allen Releases verhindert die Marke', gesehen.length === 2 && gesehen.every((g) => g === undefined), gesehen)
  gesehen.length = 0
  aufruf([katalog({ slug: 'x-crunchyroll', titleId: 987655 })], KEIN_NEIN)
  pruefe('frühe Phase: ein Release ohne Erstausgabe bleibt unmarkiert', gesehen.length === 1 && gesehen[0] === undefined, gesehen)
  gesehen.length = 0
  aufruf([katalog({ slug: 'hensuki-crunchyroll', platform: 'crunchyroll', titleId: 987654 })], neinHandbelege([{ anilistId: 987654, platform: 'crunchyroll', dub: false }]))
  pruefe('frühe Phase: ein Nein-Handbeleg verhindert die Marke', gesehen.length === 1 && gesehen[0] === undefined, gesehen)
}

console.log('\nAufrufer im Bau ohne eingesetzte Werte: der Standard liest die echten Nein-Handbelege (Prüfer 15.10.2026):')
{
  /* Kulisse (AK_ROOT, `lib/kulisse-erstausgabe.ts`): NEIN_ID hat bei Prime einen Nein-Handbeleg in der Form der echten Datei; 987654 hat keinen. */
  const OHNE_NEIN_ID = 987654
  pruefe('Voraussetzung: der Handbeleg der Kulisse zu NEIN_ID bei Prime wird gelesen', neinHandbelege(loadDubChecks()).has(`${NEIN_ID}|primevideo`))
  const titles = new Map([[NEIN_ID, titel({}, NEIN_ID)], [OHNE_NEIN_ID, titel({}, OHNE_NEIN_ID)]])
  const prime = (id: number, o: Partial<Release> = {}) => katalog({ slug: `anisearch-${id}-primevideo`, titleId: id, ...o })
  const gesehen: (true | undefined)[] = []
  const rolle = ((args: { releases: Release[] }) => {
    gesehen.push(...args.releases.map((r) => r.erstausgabe))
    return {}
  }) as unknown as typeof rolleTermineAus
  const frueh = (id: number) => rolleTermineAusMitKomplettabwurf({ releases: [prime(id)], titles, jpStart: new Map() }, { rolle })
  frueh(OHNE_NEIN_ID)
  pruefe('frühe Phase, Standard: ohne Nein-Handbeleg wird markiert', gesehen[0] === true, gesehen)
  gesehen.length = 0
  frueh(NEIN_ID)
  pruefe('frühe Phase, Standard: der echte Nein-Handbeleg verhindert die Marke', gesehen.length === 1 && gesehen[0] === undefined, gesehen)

  const kernOhneDatei = () => ({ lies: () => [] as Title[], schreibe: () => undefined })
  const spaet = (releases: Release[], ab: number) => {
    const events: ReleaseEvent[] = []
    ergaenzeAngebotTermine({ events, releases, ab, slim: [], titles }, { kern: kernOhneDatei() })
    return events
  }
  const ohne = spaet([prime(OHNE_NEIN_ID)], 0)
  pruefe('späte Phase, Standard: ohne Nein-Handbeleg trägt der Termin „erstausgabe“', ohne.length === 1 && ohne[0]?.erstausgabe === true, ohne)
  const mit = spaet([prime(NEIN_ID)], 0)
  pruefe('späte Phase, Standard: der echte Nein-Handbeleg verhindert die Marke', mit.length === 1 && mit[0]?.imAngebot === true && mit[0].erstausgabe === undefined, mit)
  const davor = anderer({ slug: 'crunchyroll-davor', titleId: OHNE_NEIN_ID })
  const mitDavor = spaet([davor, prime(OHNE_NEIN_ID)], 1)
  pruefe('späte Phase: ein früheres Release (vor „ab“) verhindert die Marke, und nur die neuen bekommen einen Termin', mitDavor.length === 1 && mitDavor[0]?.imAngebot === true && mitDavor[0].erstausgabe === undefined, mitDavor)
  const discDavor = anderer({ slug: 'disc-davor', platform: 'disc', releaseType: 'disc', titleId: OHNE_NEIN_ID })
  const mitDisc = spaet([discDavor, prime(OHNE_NEIN_ID)], 1)
  pruefe('späte Phase: eine frühere Disc verhindert die Marke', mitDisc.length === 1 && mitDisc[0]?.erstausgabe === undefined, mitDisc)
}

console.log('\nTermin (expandEvents):')
{
  const [mit] = expandEvents(katalog({ erstausgabe: true }))
  const [ohne] = expandEvents(katalog())
  pruefe('mit Markierung: der Termin trägt „erstausgabe“ und nicht „imAngebot“', mit?.erstausgabe === true && mit.imAngebot === undefined, mit)
  pruefe('ohne Markierung: der Termin trägt „imAngebot“ und nicht „erstausgabe“', ohne?.imAngebot === true && ohne.erstausgabe === undefined, ohne)
  const [premiere] = expandEvents(katalog({ erstausgabe: true, dateMeaning: undefined }))
  pruefe('ohne Katalogdatum trägt der Termin keine der beiden Marken', premiere?.erstausgabe === undefined && premiere?.imAngebot === undefined, premiere)
}

console.log('\nKachel:')
{
  const [mit] = expandEvents(katalog({ erstausgabe: true }))
  const [ohne] = expandEvents(katalog())
  const data = { releaseBySlug: new Map() }
  pruefe('Kachel mit Erstveröffentlichung trägt die Marke „erstausgabe“', kartenArt([mit!], data) === 'erstausgabe', kartenArt([mit!], data))
  pruefe('Kachel mit Katalogdatum bleibt „imAngebot“', kartenArt([ohne!], data) === 'imAngebot')
  pruefe('ein Katalog-Release schlägt die Marke', kartenArt([{ ...mit!, katalog: 'belegt' }], data) === 'katalog')
  pruefe('die Marke ist einspaltig', !istBreit('erstausgabe'))
  const text = (schluessel: keyof typeof TEXTE_KALENDER) => TEXTE_KALENDER[schluessel]
  const name = text(ART_STIL.erstausgabe.name)
  pruefe('Name der Marke: „Erstveröffentlichung“, mit einer Trennstelle für die schmale Kachel', name.replace('­', '') === 'Erstveröffentlichung' && name.includes('­'), name)
  pruefe('Hinweis der Marke: erster Tag der deutschen Fassung, nicht „Im Angebot seit“', text(ART_STIL.erstausgabe.hinweis).startsWith('Erster Tag der deutschen Fassung') && !text(ART_STIL.erstausgabe.hinweis).includes('Im Angebot'), text(ART_STIL.erstausgabe.hinweis))
}

console.log('\nKalenderdatei, Oberfläche des Teilens und Newsletter:')
{
  const [mit] = expandEvents(katalog({ erstausgabe: true }))
  const titelText = eventSummary(mit!)
  const text = eventDescription(mit!, {})
  pruefe('Titel der Kalenderdatei: „Erstveröffentlichung bei <Anbieter>“, nicht „neu bei“', titelText === 'Darwin (Erstveröffentlichung bei Prime Video)', titelText)
  pruefe('Beschreibung nennt den ersten Tag der deutschen Fassung und nicht „Im Angebot seit“', text.includes(ERSTAUSGABE_HINWEIS) && !text.includes('Im Angebot seit'), text)
  const mail = (ev: ReleaseEvent, link?: string) => digestMail([ev], 'daily', 'https://anime-kalender.de/', 'https://x/u', { links: link ? new Map([[ev.releaseSlug, { platformUrl: link }]]) : undefined }).html
  pruefe('Newsletter mit Link: die Marke ist der Link „Erstveröffentlichung bei Prime Video ›“', mail(mit!, 'https://p.example/x').includes('>Erstveröffentlichung bei Prime Video &rsaquo;</a>'))
  pruefe('Newsletter ohne Link: Marke als Text, kein „Neu bei“ und kein „ansehen“', mail(mit!).includes('Erstveröffentlichung bei Prime Video') && !mail(mit!).includes('Neu bei Prime Video') && !mail(mit!).includes('Prime Video ansehen'))
  const [ohne] = expandEvents(katalog())
  pruefe('Newsletter mit Katalogdatum bleibt „Neu bei Prime Video ›“', mail(ohne!, 'https://p.example/x').includes('>Neu bei Prime Video &rsaquo;</a>') && mail(ohne!).includes('Neu bei Prime Video'))
  const release = katalog({ erstausgabe: true })
  const label = terminZeilen(release, expandEvents(release), '2026-06-01')[0]?.label
  pruefe('Karte beim Teilen: „Erstveröffentlichung“ statt „Im Angebot seit“', label === 'Erstveröffentlichung', label)
  const katalogLabel = terminZeilen(katalog(), expandEvents(katalog()), '2026-06-01')[0]?.label
  pruefe('Karte beim Teilen ohne Markierung bleibt „Im Angebot seit“', katalogLabel === 'Im Angebot seit', katalogLabel)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
