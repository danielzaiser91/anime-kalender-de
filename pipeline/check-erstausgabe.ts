/**
 * Zusicherung (F9, Daniel 14.10.2026): Ein Katalogdatum, das zugleich der erste Tag der deutschen Fassung ist (aniSearch-Erstausgabe, belegte Synchro,
 * kein Anbieter früher), heißt „Erstveröffentlichung“ und nicht „Neu bei X“. Ein später dazugekommener Anbieter bleibt „Neu bei“.
 * Aufruf: `npm run check:logic`.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { ERSTAUSGABE_HINWEIS, eventDescription, eventSummary } from '../shared/ics.ts'
import { digestMail } from '../worker/src/templates.ts'
import { ART_STIL, istBreit, kartenArt } from '../web/src/lib/kachel-folgen.ts'
import { TEXTE_KALENDER } from '../web/src/lib/i18n-kalender.ts'
import { terminZeilen } from './lib/og-termin.ts'
import { istErstausgabe, markiereErstausgabe } from './bau/erstausgabe-markieren.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TAG = '2026-01-06'
const titel = (o: Partial<Title['deErstausgabe']> | null = {}, id = 1): Title =>
  ({ id, ...(o ? { deErstausgabe: { von: TAG, publisher: 'Amazon.com, Inc.', synchro: true, ...o } } : {}) }) as unknown as Title
const katalog = (o: Partial<Release> = {}): Release =>
  ({
    slug: 'anisearch-1-primevideo',
    titleId: 1,
    name: 'Darwin',
    platform: 'primevideo',
    releaseType: 'batch',
    dateMeaning: 'available-from',
    schedule: { firstEpisodeDate: TAG, episodeCount: 13, lastEpisodeDate: TAG },
    sources: ['https://www.anisearch.de/anime/1'],
    ...o,
  }) as Release
const anderer = (o: Partial<Release> = {}): Release =>
  katalog({ slug: 'crunchyroll-1', platform: 'crunchyroll', releaseType: 'weekly', dateMeaning: undefined, schedule: { firstEpisodeDate: '2026-01-02', episodeCount: 12 }, ...o })

console.log('\nistErstausgabe (die Regel):')
{
  const r = katalog()
  pruefe('Katalogtag = aniSearch-Erstausgabe, Synchro belegt, sonst kein Anbieter: Erstveröffentlichung', istErstausgabe(r, titel(), [r]))
  pruefe('anderer Tag: „Neu bei“', !istErstausgabe(r, titel({ von: '2026-01-05' }), [r]))
  pruefe('Erstausgabe ohne belegte Synchro (kann OmU sein): „Neu bei“', !istErstausgabe(r, titel({ synchro: false }), [r]))
  pruefe('Titel ohne Erstausgabe: „Neu bei“', !istErstausgabe(r, titel(null), [r]))
  pruefe('Erstausgabe ohne Tagesdatum: „Neu bei“', !istErstausgabe(r, titel({ von: undefined }), [r]))
  pruefe('ein anderer Anbieter war früher da: „Neu bei“ (Snowball Earth)', !istErstausgabe(r, titel(), [r, anderer()]))
  pruefe('ein anderer Anbieter erst später: die Erstveröffentlichung bleibt', istErstausgabe(r, titel(), [r, anderer({ schedule: { firstEpisodeDate: '2026-02-01', episodeCount: 12 } })]))
  pruefe('ein anderer Anbieter am selben Tag war nicht „vorher“: die Erstveröffentlichung bleibt', istErstausgabe(r, titel(), [r, anderer({ schedule: { firstEpisodeDate: TAG, episodeCount: 12 } })]))
  pruefe('ein Fernsehtermin davor zählt als früherer Anbieter', !istErstausgabe(r, titel(), [r, anderer({ platform: 'tv', slug: 'tv-1' })]))
  pruefe('eine Disc davor zählt nicht (anderer Weg)', istErstausgabe(r, titel(), [r, anderer({ platform: 'disc', releaseType: 'disc', slug: 'disc-1' })]))
  pruefe('ein widerlegter früherer Termin zählt nicht', istErstausgabe(r, titel(), [r, anderer({ widerlegt: { grund: 'x', am: '2026-01-03', gemeldet: false } })]))
  pruefe('ein Termin mit Erscheinungsdatum (Premiere) ist nie „Neu bei“, also auch keine Erstveröffentlichung der Marke', !istErstausgabe(katalog({ dateMeaning: undefined }), titel(), []))
  pruefe('Fernsehen und Disc tragen die Marke nicht', !istErstausgabe(katalog({ platform: 'tv' }), titel(), []) && !istErstausgabe(katalog({ platform: 'disc' }), titel(), []))
}

console.log('\nmarkiereErstausgabe (Bau):')
{
  const a = katalog()
  const b = katalog({ slug: 'anisearch-2-netflix', titleId: 2, platform: 'netflix' })
  const c = katalog({ slug: 'motn-3-netflix', titleId: 3, platform: 'netflix' })
  const titles = new Map([[1, titel(undefined, 1)], [2, titel({ von: '2026-01-05' }, 2)], [3, titel(undefined, 3)]])
  const n = markiereErstausgabe({ alle: [a, b, c], pruefen: [a, b], titles })
  pruefe('markiert die Releases mit Erstausgabetag und zählt sie', n === 1 && a.erstausgabe === true && b.erstausgabe === undefined, [n, a.erstausgabe, b.erstausgabe])
  pruefe('ein Release außerhalb von „pruefen“ bleibt unberührt', c.erstausgabe === undefined)
  pruefe('zweiter Durchlauf zählt nichts doppelt', markiereErstausgabe({ alle: [a, b, c], pruefen: [a, b, c], titles }) === 1)
  const spaeter = katalog({ slug: 'anisearch-4-netflix', titleId: 4, platform: 'netflix' })
  const frueher = anderer({ titleId: 4, slug: 'crunchyroll-4' })
  const t4 = new Map([[4, titel(undefined, 4)]])
  pruefe('Titel mit früherem Anbieter in „alle“: nicht markiert, auch wenn nur das Katalog-Release geprüft wird', markiereErstausgabe({ alle: [spaeter, frueher], pruefen: [spaeter], titles: t4 }) === 0 && spaeter.erstausgabe === undefined)
  pruefe('… in jeder Reihenfolge der Releases (der frühere steht vorn)', markiereErstausgabe({ alle: [frueher, spaeter], pruefen: [spaeter], titles: t4 }) === 0 && spaeter.erstausgabe === undefined)
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
  pruefe('Name der Marke: „Erstveröffentlichung“', text(ART_STIL.erstausgabe.name) === 'Erstveröffentlichung', text(ART_STIL.erstausgabe.name))
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
