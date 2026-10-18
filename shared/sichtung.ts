/**
 * Uhrzeit aus Sichtungsfenster (18.10.2026, Tank Chair: Folge 3 am 18.10. zwischen 16:18 und 16:32).
 * Sie steht nur in `schedule.timeSighting.time`; `setzeSichtungszeit` ist ihr einziger Leser und macht daraus die
 * geschätzte Terminzeit am Sichtungstag. Alle anderen Termine bekommen aus der Sichtung nichts. Ein späteres
 * Fortschreiben auf kommende Folgen ändert nur die Bedingung dort.
 */
import type { ReleaseEvent } from './types.ts'

export interface Sichtung {
  /** Gewählte Zeit im Fenster, "HH:MM" Berlin. */
  time: string
  /** Zu dieser Zeit fehlte die Folge noch. */
  notSeen: string
  /** Zu dieser Zeit war sie da (höchstens 30 min nach `notSeen`). */
  seen: string
  /** ISO-Tag der Sichtung, gehört zu genau einem Termin. */
  date: string
  source: string
}

declare module './types.ts' {
  interface Schedule {
    timeSighting?: Sichtung
  }
}

/** Setzt `time` + `timeEstimated` am Termin des Sichtungstags; eine gemessene Zeit am Termin bleibt. */
export function setzeSichtungszeit(termine: ReleaseEvent[], sichtung: Sichtung | undefined): ReleaseEvent[] {
  if (!sichtung) return termine
  return termine.map((e) => (e.date === sichtung.date && !e.time ? { ...e, time: sichtung.time, timeEstimated: true } : e))
}
