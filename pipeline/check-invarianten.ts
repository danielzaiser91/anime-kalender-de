/**
 * Gegenprobe der Invarianten am Ergebnis (`lib/invarianten.ts`): je Regel ein nachgestellter Fehlerfall,
 * der rot wird, und ein sauberer Fall, der es nicht wird. `--bestand` fährt sie zusätzlich über `public/data`.
 */
import { readFileSync } from 'node:fs'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { folgennummernEindeutig, pruefeInvarianten, slugsEindeutig, verweiseAufgeloest, zaehlworteStimmen } from './lib/invarianten.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const release = (slug: string, titleId = 1, platform = 'crunchyroll', releaseType = 'weekly'): Release =>
  ({ slug, titleId, name: slug, platform, releaseType, schedule: { firstEpisodeDate: '2026-09-01' }, year: 2026, sources: ['x'] }) as unknown as Release
const termin = (releaseSlug: string, episode: number | undefined, date: string): ReleaseEvent =>
  ({ id: `${releaseSlug}-${episode}-${date}`, releaseSlug, titleId: 1, date, episode, releaseType: 'weekly', platform: 'crunchyroll', name: releaseSlug }) as unknown as ReleaseEvent
const titel = new Map<number, Title>([[1, { id: 1 } as unknown as Title]])

console.log('\nInvarianten am Ergebnis:')
{
  // B-04: zwei Releases mit demselben Slug (Pokémon Reisen, TOGGO plus)
  pruefe('Slug doppelt wird gemeldet', slugsEindeutig([release('auto-112153-tv-toggo-plus'), release('auto-112153-tv-toggo-plus')]).length === 1)
  pruefe('verschiedene Slugs gehen durch', slugsEindeutig([release('a'), release('b')]).length === 0)

  // B-03: „Folge 8" dreimal im Kalender
  const dreimal = [termin('polar', 8, '2026-09-13'), termin('polar', 8, '2026-09-20'), termin('polar', 8, '2026-10-04'), termin('polar', 9, '2026-10-11')]
  const f = folgennummernEindeutig([release('polar')], dreimal)
  pruefe('Folgennummer doppelt wird gemeldet', f.length === 1 && f[0].includes('8×3'), f)
  pruefe('Folgen ohne Nummer und Discs zählen nicht', folgennummernEindeutig([release('d', 1, 'disc', 'disc'), release('b')], [termin('d', 1, '2026-09-01'), termin('d', 1, '2026-09-02'), termin('b', undefined, '2026-09-01'), termin('b', undefined, '2026-09-08')]).length === 0)
  pruefe('aufsteigende Folgen gehen durch', folgennummernEindeutig([release('polar')], [termin('polar', 8, '2026-09-13'), termin('polar', 9, '2026-09-20')]).length === 0)

  // B-06: Release ohne vorhandenen Titel, Termin ohne Release
  const v = verweiseAufgeloest([release('x', 999)], [termin('geist', 1, '2026-09-01')], titel)
  pruefe('Release ohne Titel wird gemeldet', v.fehler.some((e) => e.includes('Titel 999')), v.fehler)
  pruefe('Termin ohne Release wird gemeldet', v.fehler.some((e) => e.includes('ohne Release')), v.fehler)
  const w = verweiseAufgeloest([release('cr-GR3K50PZR', -1), release('cartoon', -5)], [], titel)
  pruefe('titleId -1 ist Warnung, Cartoon-ID ist kein Fehler', w.fehler.length === 0 && w.warnungen.length === 1, w)
  pruefe('sauberer Bestand geht durch', pruefeInvarianten([release('a')], [termin('a', 1, '2026-09-01')], titel).fehler.length === 0)

  // B-07/B-08: Fußzeile nannte 610 Releases, die Datei hatte 722
  const z = zaehlworteStimmen({ titleCount: 10, releaseCount: 610, eventCount: 5 }, { titles: 10, releases: 722, events: 5 })
  pruefe('Zählwort ungleich Dateilänge wird gemeldet', z.length === 1 && z[0].includes('610') && z[0].includes('722'), z)
  pruefe('passende Zählworte gehen durch', zaehlworteStimmen({ titleCount: 1, releaseCount: 2, eventCount: 3 }, { titles: 1, releases: 2, events: 3 }).length === 0)
}

if (process.argv.includes('--bestand')) {
  const d = <T>(datei: string): T => JSON.parse(readFileSync(new URL(`../public/data/${datei}`, import.meta.url), 'utf8')) as T
  const titles = new Map([...d<Title[]>('titles.json')].map((t) => [t.id, t]))
  const releases = d<Release[]>('releases.json')
  const events = d<ReleaseEvent[]>('events.json')
  const r = pruefeInvarianten(releases, events, titles)
  console.log(`\nBestand: ${releases.length} Releases, ${events.length} Termine — ${r.fehler.length} Fehler, ${r.warnungen.length} Warnungen`)
  for (const t of [...r.fehler, ...r.warnungen].slice(0, 10)) console.log('  ', t)
  const meta = d<{ titleCount: number; releaseCount: number; eventCount: number }>('meta.json')
  const z = zaehlworteStimmen(meta, { titles: titles.size, releases: releases.length, events: events.length })
  console.log(`Zählworte: ${z.length} Abweichung(en)`, z)
  verletzt += r.fehler.length
}
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Invarianten-Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
