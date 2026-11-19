/**
 * Zusicherung: Fortgeschriebene Folgen am selben Tag rücken nie hinter eine belegte höhere Folge
 * (Vom Landei zum Schwertheiligen II, Bestandsbau 19.11.2026: Folge 4 am 19.08. hinter belegter Folge 5 am 05.08.). Läuft in `check:logic`.
 */
import { expandEvents } from '../shared/logic.ts'
import type { Release } from '../shared/types.ts'

const r = {
  slug: 'x',
  titleId: 1,
  name: 'X',
  platform: 'primevideo',
  releaseType: 'weekly',
  schedule: { firstEpisodeDate: '2026-07-08', episodeCount: 12, observed: { 1: '2026-07-08', 5: '2026-08-05' } },
} as unknown as Release
const tage = expandEvents(r).map((e) => `${e.episode}:${e.date}`)
const tag = (n: number): string => tage.find((t) => t.startsWith(`${n}:`))!.slice(String(n).length + 1)
const ok = [2, 3, 4].every((n) => tag(n) <= tag(5)) && tag(6) > tag(5)
if (!ok) {
  console.error(`check-gleichtag-grenze: Folgen 2–4 liegen hinter Folge 5 — gefunden: ${tage.join(' ')}`)
  process.exit(1)
}
console.log('check-gleichtag-grenze: alles grün')
