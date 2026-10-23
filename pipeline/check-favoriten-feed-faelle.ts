/**
 * Rotfälle der Feed-Bestandswächter (`pipeline/lib/feed-bestand.ts`, 23.10.2026): ohne `public/data`, mit kleinen Fixtures.
 * Die Messung am echten Bestand steht in `pipeline/check-favoriten-feed-bestand.ts` (nur im Bestandsbau).
 * Aufruf: `npx tsx pipeline/check-favoriten-feed-faelle.ts`
 */
import { buildIcs } from '../shared/ics.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { MAX_MS, MAX_TERMINE, pruefeFeedBestand, type Befund } from './lib/feed-bestand.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) fehler++
  console.log(`  ${ok ? '✓' : '✖'} ${name}`)
}

const ev = (n: number, titleId: number, date = '2026-10-20'): ReleaseEvent => ({
  id: `e${n}`,
  releaseSlug: `s${n}`,
  titleId,
  date,
  time: '10:00',
  releaseType: 'weekly',
  platform: 'netflix',
  name: `Titel ${titleId}`,
  episode: 1,
  episodeCount: 12,
})
const bau = (events: ReleaseEvent[]): string => buildIcs(events, { siteUrl: 'https://anime-kalender.de/', calendarName: 'Anime-Kalender DE' })
const KLEIN = [ev(1, 5), ev(2, 7), ev(3, 7, '2026-10-21'), ev(4, 12)]
const schnell = (): number => 1
const rot = (b: Befund[]): string[] => b.filter((x) => !x.ok).map((x) => x.name)
const viele = (n: number): ReleaseEvent[] => Array.from({ length: n }, (_, i) => ev(i + 1, i + 1))

const gut = pruefeFeedBestand(bau(KLEIN), KLEIN, schnell)
pruefe('Fixture gut: fünf Befunde, keiner rot', gut.length === 5 && rot(gut).length === 0)

let gesehen: { alle: string; titel: number[] } | undefined
pruefeFeedBestand(bau(KLEIN), KLEIN, (alle, favoriten) => {
  gesehen = { alle, titel: [...favoriten].sort((a, b) => a - b) }
  return 1
})
pruefe('Messung bekommt den Feed und alle Titel', gesehen?.alle === bau(KLEIN) && gesehen.titel.join() === '5,7,12')

const verdreht = bau(KLEIN).replace('/t/5/', '/t/6/')
const abweichung = rot(pruefeFeedBestand(verdreht, KLEIN, schnell))
pruefe('Ausschnitt weicht von buildIcs ab: Gleichheitsfall rot', abweichung.some((n) => n.includes('gleich buildIcs (alle Titel')))
pruefe('Abweichung bei einem Titel betrifft den Fall „terminreichster Titel“ nicht', !abweichung.some((n) => n.includes('terminreichste')))

const genau = pruefeFeedBestand(bau(viele(MAX_TERMINE)), viele(MAX_TERMINE), schnell)
pruefe(`genau ${MAX_TERMINE} Termine: Terminfall grün`, !rot(genau).some((n) => n.includes('Termine')))
const ueber = pruefeFeedBestand(bau(viele(MAX_TERMINE + 1)), viele(MAX_TERMINE + 1), schnell)
pruefe(`${MAX_TERMINE + 1} Termine: Terminfall rot`, rot(ueber).some((n) => n.includes('Termine')))

const leer = pruefeFeedBestand(bau([]), [], schnell)
pruefe('Feed ohne Termine: Terminfall rot', rot(leer).some((n) => n.includes('Termine')))

const knapp = pruefeFeedBestand(bau(KLEIN), KLEIN, () => MAX_MS - 0.1)
pruefe(`${MAX_MS - 0.1} ms: Zeitfall grün`, rot(knapp).length === 0)
const zuLang = pruefeFeedBestand(bau(KLEIN), KLEIN, () => MAX_MS)
pruefe(`${MAX_MS} ms: Zeitfall rot`, rot(zuLang).some((n) => n.includes('ms')))

console.log(fehler ? `\n${fehler} Rotfall(e) der Feed-Wächter nicht erkannt.` : '\nFavoriten-Feed (Wächterfälle): alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
