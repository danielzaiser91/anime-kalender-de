/**
 * Zusicherungen zu `bau/adn-kuratiert.ts` (13.10.2026): Ein kuratierter ADN-Termin und der ADN-Termin desselben Titels am selben Tag sind ein Termin.
 * Anlass: Die vier Bleach-Filme standen nach dem Katalogeintrag doppelt in der Woche (kuratiert ohne Uhrzeit, `adn-352` mit 09:00).
 */
import { verschmelzeAdnMitKuratiertem } from './bau/adn-kuratiert.ts'
import type { Release } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const SUCHE = 'https://animationdigitalnetwork.com/de/search?q=Bleach%3A%20Fade%20to%20Black'
const SEITE = 'https://animationdigitalnetwork.com/de/video/352-bleach-fade-to-black-movie-3/6248-film-1'
const rel = (extra: Partial<Release>): Release =>
  ({ slug: 'x', titleId: 4835, name: 'Bleach: Fade to Black', platform: 'adn', releaseType: 'movie', schedule: { firstEpisodeDate: '2026-10-12' }, sources: ['https://a/'], ...extra }) as unknown as Release
const kuratiert = () => rel({ slug: 'bleach-fade-to-black-adn', platformUrl: SUCHE, dateMeaning: 'available-from' })
const ausAdn = () => rel({ slug: 'adn-352', releaseType: 'batch', platformUrl: SEITE, schedule: { firstEpisodeDate: '2026-10-12', time: '09:00', episodeCount: 1 }, sources: ['https://adn/'] })

console.log('\nGleicher Titel, gleicher Tag:')
{
  const liste = [kuratiert(), ausAdn()]
  const n = verschmelzeAdnMitKuratiertem(liste)
  pruefe('Ein Eintrag bleibt, der kuratierte', n === 1 && liste.length === 1 && liste[0]!.slug === 'bleach-fade-to-black-adn', liste.map((r) => r.slug))
  pruefe('Die Suchadresse weicht der Seite von ADN', liste[0]!.platformUrl === SEITE, liste[0]!.platformUrl)
  pruefe('Die Uhrzeit kommt von ADN', liste[0]!.schedule.time === '09:00', liste[0]!.schedule)
  pruefe('Beide Quellen stehen am Eintrag', liste[0]!.sources?.join() === 'https://a/,https://adn/', liste[0]!.sources)
  pruefe('Art und Bedeutung des Datums bleiben die des kuratierten', liste[0]!.releaseType === 'movie' && liste[0]!.dateMeaning === 'available-from')
}

console.log('\nEigene Angaben des kuratierten bleiben:')
{
  const k = rel({ slug: 'k', platformUrl: 'https://animationdigitalnetwork.com/de/video/9-hand', schedule: { firstEpisodeDate: '2026-10-12', time: '10:30' } })
  const liste = [k, ausAdn()]
  verschmelzeAdnMitKuratiertem(liste)
  pruefe('Eigene Titelseite und Uhrzeit bleiben', liste[0]!.platformUrl?.endsWith('9-hand') === true && liste[0]!.schedule.time === '10:30', liste[0])
}

console.log('\nNichts zusammenlegen:')
{
  const anderer = (extra: Partial<Release>) => {
    const liste = [kuratiert(), ausAdn()]
    Object.assign(liste[1]!, extra)
    return { liste, n: verschmelzeAdnMitKuratiertem(liste) }
  }
  pruefe('anderer Titel', anderer({ titleId: 1 }).n === 0)
  pruefe('anderer Tag', anderer({ schedule: { firstEpisodeDate: '2026-10-19' } as never }).n === 0)
  pruefe('anderer Anbieter', anderer({ platform: 'netflix' as never }).n === 0)
  pruefe('Titel unbekannt (-1)', anderer({ titleId: -1 }).n === 0)
  const zwei = [ausAdn(), { ...ausAdn(), slug: 'adn-353' }]
  pruefe('zwei ADN-Einträge ohne kuratierten bleiben beide', verschmelzeAdnMitKuratiertem(zwei) === 0 && zwei.length === 2)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
