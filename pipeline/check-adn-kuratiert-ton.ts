/**
 * Zusicherungen zu `bau/adn-kuratiert-ton.ts` (14.10.2026, 86 EIGHTY-SIX): Ein kuratierter ADN-Termin, zu dem ADN am Starttag eine Folge mit `vde` führt,
 * gibt dem Titel einen ADN-Weg mit `dub: true`. Ohne das blieb der Weg bei „Ton offen“ (Weg aus einem Termin), obwohl alle 23 Folgen `vde` tragen.
 */
import { adnShowsAusKalenderUndKatalog, belegeTonKuratierterAdnTermine } from './bau/adn-kuratiert-ton.ts'
import type { AdnData, AdnShow } from './lib/adn.ts'
import type { Release, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-14'
const SERIE = 'https://animationdigitalnetwork.com/de/video/1423-eighty-six'
const show = (showId: number, daten: string[]): AdnShow =>
  ({ showId, title: 'x', url: `https://animationdigitalnetwork.com/de/video/${showId}`, episodes: daten.map((date) => ({ date })), batch: true }) as unknown as AdnShow
const titel = (id: number, streams: Title['streams'] = []): Title => ({ id, streams }) as unknown as Title
const termin = (extra: Partial<Release> = {}): Release =>
  ({ slug: 'k', titleId: 1, platform: 'adn', platformUrl: SERIE, schedule: { firstEpisodeDate: '2026-10-08' }, ...extra }) as unknown as Release
const lauf = (release: Release, titles: Title[], shows: AdnShow[]) => {
  const karte = new Map(titles.map((t) => [t.id, t]))
  return { n: belegeTonKuratierterAdnTermine([release], karte, shows, HEUTE), karte }
}

console.log('\nvde am Starttag:')
{
  const { n, karte } = lauf(termin(), [titel(1)], [show(1423, ['2026-10-08', '2026-10-15'])])
  const weg = karte.get(1)!.streams[0]
  pruefe('Titel bekommt den ADN-Weg mit dub: true', n === 1 && weg?.platform === 'adn' && weg.dub === true, karte.get(1)!.streams)
  pruefe('Die Titelseite des Termins bleibt die Adresse', weg?.url === SERIE, weg)
  pruefe('Ein Weg aus einem Termin ist es nicht (kein Tonurteil mit Herkunft Termin)', weg?.herkunft === undefined, weg)
  const ohneAdresse = lauf(termin({ platformUrl: 'https://animationdigitalnetwork.com/de/video/1423-eighty-six/32631-folge-1' }), [titel(1)], [show(1423, ['2026-10-08'])])
  pruefe('Auch eine Folgenadresse nennt die Serie', ohneAdresse.n === 1)
}

console.log('\nKein Beleg:')
{
  pruefe('Kein vde am Starttag: nichts', lauf(termin(), [titel(1)], [show(1423, ['2026-10-09'])]).n === 0)
  pruefe('Serie nicht in den ADN-Daten: nichts', lauf(termin(), [titel(1)], [show(1, ['2026-10-08'])]).n === 0)
  pruefe('Starttag in der Zukunft (angekündigt): nichts', lauf(termin({ schedule: { firstEpisodeDate: '2026-10-29' } as never }), [titel(1)], [show(1423, ['2026-10-29'])]).n === 0)
  pruefe('Suchadresse ohne Kennung: nichts', lauf(termin({ platformUrl: 'https://animationdigitalnetwork.com/de/search?q=x' }), [titel(1)], [show(1423, ['2026-10-08'])]).n === 0)
  pruefe('Anderer Anbieter: nichts', lauf(termin({ platform: 'netflix' as never }), [titel(1)], [show(1423, ['2026-10-08'])]).n === 0)
  pruefe('Titel unbekannt: nichts', lauf(termin({ titleId: 99 }), [titel(1)], [show(1423, ['2026-10-08'])]).n === 0)
}

console.log('\nVorhandener ADN-Weg bleibt:')
{
  const vorhanden = titel(1, [{ platform: 'adn', url: 'https://x/', dub: false }])
  const { n, karte } = lauf(termin(), [vorhanden], [show(1423, ['2026-10-08'])])
  pruefe('Weg unverändert, keiner dazu', n === 0 && karte.get(1)!.streams.length === 1 && karte.get(1)!.streams[0]!.dub === false)
}

console.log('\nKalender und Katalog:')
{
  const leer = (shows: AdnShow[]): AdnData => ({ scrapedAt: '', window: { from: '', to: '' }, shows })
  const gemischt = adnShowsAusKalenderUndKatalog(leer([show(1, ['2026-10-01'])]), leer([show(1, ['2026-09-01']), show(2, [])]))
  pruefe('Der Kalender gewinnt, der Katalog füllt auf', gemischt.length === 2 && gemischt[0]!.episodes[0]!.date === '2026-10-01', gemischt)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
