/**
 * Zusicherung zum Staffelstart (Daniel, 12.10.2026, Snowball Earth): Ein Release mit nur einer Folge, die über Folge 1 liegt,
 * ist ein Nachtrag und kein Start — Disney+ Folge 13 am Finaltag trug sonst „Staffelstart" neben dem Finale.
 * Ein geteilter Start mit mehreren Folgen bleibt ein Start. Aufruf: `npm run check:logic`.
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { istStaffelfinale, istStaffelstart } from '../web/src/lib/staffelstart.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}`)
}

const release = (slug: string, erste: number, anzahl: number): Release =>
  ({ slug, titleId: 1, name: slug, platform: 'disneyplus', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-12', firstEpisodeNumber: erste, episodeCount: anzahl } }) as unknown as Release
const termin = (slug: string, episode: number): ReleaseEvent =>
  ({ id: `${slug}@${episode}`, releaseSlug: slug, titleId: 1, date: '2026-10-12', releaseType: 'weekly', platform: 'disneyplus', name: slug, episode, episodeCount: 13 }) as unknown as ReleaseEvent

console.log('\nStaffelstart: Einzelfolge über Folge 1:')
const daten = { releaseBySlug: new Map([['einzeln', release('einzeln', 13, 1)], ['teil', release('teil', 13, 12)]]) }
pruefe('Folge 13 als einziger Termin eines Releases ist kein Staffelstart', !istStaffelstart(termin('einzeln', 13), daten))
pruefe('… aber das Finale', istStaffelfinale(termin('einzeln', 13), daten))
pruefe('geteilter Start ab Folge 13 mit mehreren Folgen bleibt ein Start', istStaffelstart(termin('teil', 13), daten))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
