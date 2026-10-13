/**
 * Zusicherung zu `schedule.belegtBis` (Snowball Earth, 12.10.2026): Die Meldung "bis Folge N lieferbar" sagt nichts über den Tag
 * der Folgen davor. Vor der frühesten beobachteten Folge sind die Tage zurückgerechnet und bleiben geschätzt; danach
 * gilt die Meldung (Tokyo Revengers: Folge 2 nach beobachteter Folge 1). Aufruf: `npm run check:logic`.
 */
import { expandEvents } from '../shared/logic.ts'
import type { Release } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const release = (observed: Record<number, string>): Release =>
  ({
    slug: 'probe',
    titleId: 1,
    name: 'Probe',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    year: 2026,
    sources: ['x'],
    schedule: { firstEpisodeDate: '2026-07-20', episodeCount: 13, estimated: true, observed, belegtBis: { folge: 13, am: '2026-10-12' } },
  }) as unknown as Release

console.log('\nbelegtBis spricht zurückgerechnete Tage nicht frei:')
const eine = expandEvents(release({ 13: '2026-10-12' }))
pruefe('eine beobachtete Folge: Folge 1–12 bleiben geschätzt', eine.filter((e) => e.episode! < 13).every((e) => e.estimated === true), eine.map((e) => e.estimated))
pruefe('… die beobachtete Folge 13 ist belegt', eine.find((e) => e.episode === 13)?.estimated === undefined)
const zwei = expandEvents(release({ 5: '2026-08-17', 13: '2026-10-12' }))
pruefe('Folge 10 nach der frühesten Beobachtung (5) bis Folge 13 vor dem Prüftag ist belegt', zwei.find((e) => e.episode === 10)?.estimated === undefined, zwei.find((e) => e.episode === 10))
pruefe('Folge 3 vor der frühesten Beobachtung bleibt geschätzt', zwei.find((e) => e.episode === 3)?.estimated === true, zwei.find((e) => e.episode === 3))
const start = expandEvents(release({ 1: '2026-07-20' }))
pruefe('Beobachtung von Folge 1: Folge 2 bis Folge 13 vor dem Prüftag ist belegt', start.find((e) => e.episode === 2)?.estimated === undefined, start.find((e) => e.episode === 2))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
