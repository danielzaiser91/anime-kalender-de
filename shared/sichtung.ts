/**
 * Uhrzeit aus Sichtungsfenster gilt nur für die gesichtete Folge (18.10.2026, Tank Chair: Folge 3 am 18.10. zwischen
 * 16:18 und 16:32). Die übrigen Folgen bekommen aus dem Plan keine Uhrzeit — gemessen ist sie dort nicht.
 */
import type { ReleaseEvent } from './types.ts'

declare module './types.ts' {
  interface Schedule {
    /** Begründung einer `time` aus eigener Sichtung: Folge zu `notSeen` nicht da, zu `seen` da (≤ 30 min), am Tag `date` (`pipeline/lib/sichtungsfenster.ts`). */
    timeSighting?: { notSeen: string; seen: string; date: string; source: string }
  }
}

export function nurGesichteteFolge(termine: ReleaseEvent[], sichtung: { date: string } | undefined): ReleaseEvent[] {
  if (!sichtung) return termine
  return termine.map((e) => {
    if (e.date === sichtung.date) return e
    const { time: _zeit, timeEstimated: _geschaetzt, ...ohneZeit } = e
    return ohneZeit
  })
}
