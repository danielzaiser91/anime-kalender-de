/**
 * Zusicherung: Fortgeschriebene Folgen am selben Tag rücken nie hinter eine belegte höhere Folge.
 * Echter Ablauf (Vom Landei zum Schwertheiligen II, Bestandsbau 19.11.2026): Handbeleg `available: false`
 * → kein `belegtBis` → Folgen 2–4 geschätzt am 05.08. (Tag der belegten Folge 5) → Gleichtag-Schleife schob 4 auf den 19.08.
 * Läuft in `check:logic`.
 */
import { expandEvents } from '../shared/logic.ts'
import type { Release } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const landei = (observed: Record<number, string>, belegtBis?: { folge: number; am: string }): Release =>
  ({
    slug: 'vom-landei-zum-schwertheiligen-2',
    titleId: 1,
    name: 'Vom Landei zum Schwertheiligen II',
    platform: 'primevideo',
    releaseType: 'weekly',
    year: 2026,
    sources: ['x'],
    schedule: { firstEpisodeDate: '2026-07-08', time: '18:00', episodeCount: 12, observed, ...(belegtBis ? { belegtBis } : {}) },
  }) as unknown as Release

const tage = (r: Release): Record<number, string> => Object.fromEntries(expandEvents(r).map((e) => [e.episode!, e.date]))

console.log('Gleichtag-Verschiebung bleibt vor der belegten Folge:')
const ohneBeleg = tage(landei({ 1: '2026-07-08', 5: '2026-08-05' }))
const gefunden = JSON.stringify(ohneBeleg)
for (const n of [2, 3, 4]) pruefe(`Folge ${n} liegt nicht hinter der belegten Folge 5`, ohneBeleg[n] <= ohneBeleg[5], gefunden)
pruefe('Folge 6 folgt weiter nach Folge 5', ohneBeleg[6] > ohneBeleg[5], gefunden)

console.log('Mit belegtBis (Stand nach #4289) bleibt das Ergebnis dasselbe Muster:')
const mitBeleg = tage(landei({ 1: '2026-07-08', 5: '2026-08-05' }, { folge: 12, am: '2026-09-28' }))
for (const n of [2, 3, 4]) pruefe(`Folge ${n} nicht hinter Folge 5`, mitBeleg[n] <= mitBeleg[5], JSON.stringify(mitBeleg))

console.log('Die Grenze bremst nur hinter belegten Folgen:')
const spaet = tage(landei({ 1: '2026-07-08', 3: '2026-07-22', 5: '2026-08-19' }))
pruefe('Folge 4 zwischen den Belegen liegt zwischen 3 und 5', spaet[4] >= spaet[3] && spaet[4] <= spaet[5], JSON.stringify(spaet))
pruefe('Folge 6 liegt nach Folge 5', spaet[6] > spaet[5], JSON.stringify(spaet))

/* Zwei offene Ausfälle (Polar Opposites S2, 20.09.2026): Folge 8 und 9 landen beide am 27.09., die Schleife schiebt 9 weiter. */
const ausfallRelease = (observed: Record<number, string>, lastEpisodeDate?: string): Release =>
  ({
    slug: 'probe-ausfall',
    titleId: 1,
    name: 'Probe',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    year: 2026,
    sources: ['x'],
    schedule: {
      firstEpisodeDate: '2026-07-26',
      episodeCount: 12,
      time: '17:00',
      estimated: true,
      observed,
      ...(lastEpisodeDate ? { lastEpisodeDate } : {}),
      verpasst: {
        8: { erwartetAm: '2026-09-13T08:30:00.000Z' },
        9: { erwartetAm: '2026-09-20T08:30:00.000Z', neuErwartet: '2026-09-27T08:30:00.000Z' },
      },
    },
  }) as unknown as Release
const ausfall = (observed: Record<number, string>): Record<number, string> => tage(ausfallRelease(observed))

console.log('Verschiebung erlaubt bis einschließlich zum Tag der belegten Folge:')
const frei = ausfall({ 7: '2026-09-06' })
pruefe('ohne spätere Belege rückt Folge 9 auf den 04.10.', frei[9] === '2026-10-04', JSON.stringify(frei))
const genau = ausfall({ 7: '2026-09-06', 10: '2026-10-04' })
pruefe('belegte Folge 10 am 04.10.: Folge 9 darf dorthin', genau[9] === '2026-10-04', JSON.stringify(genau))
const davor = ausfall({ 7: '2026-09-06', 10: '2026-09-27' })
pruefe('belegte Folge 10 am 27.09.: Folge 9 bleibt am 27.09.', davor[9] === '2026-09-27', JSON.stringify(davor))
const zwei = ausfall({ 7: '2026-09-06', 10: '2026-09-27', 11: '2026-10-04' })
pruefe('mit Folge 10 (27.09.) und 11 (04.10.) gilt die frühere Grenze: Folge 9 bleibt am 27.09.', zwei[9] === '2026-09-27', JSON.stringify(zwei))
const ende = tage(ausfallRelease({ 7: '2026-09-06' }, '2026-09-27'))
pruefe('belegtes Ende am 27.09. (lastEpisodeDate): Folge 9 rückt nicht darüber hinaus', ende[9] <= '2026-09-27', JSON.stringify(ende))
const ids = expandEvents(ausfallRelease({ 7: '2026-09-06' })).filter((e) => e.estimated)
pruefe('verschobene Folgen tragen die Kennung ihres neuen Tags', ids.every((e) => e.id.startsWith(`probe-ausfall@${e.date}`)), ids.map((e) => `${e.id} ${e.date}`))

if (verletzt) {
  console.error(`\ncheck-gleichtag-grenze: ${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-gleichtag-grenze: alles grün')
