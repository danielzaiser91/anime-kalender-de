/**
 * Beleg für die Uhrzeit einer Serie aus einer eigenen Sichtung (18.10.2026, F39; Tank Chair: Folge 3 fehlte um 16:18, war um 16:32 da).
 * Die Zeit selbst steht als Regeltermin in `schedule.time` und gilt für alle Folgen; eine Abweichung einzelner Folgen steht in
 * `schedule.zeiten` und schlägt sie. `timeSighting` belegt nur das Fenster: unter einer Stunde breit gilt `time` als belegt,
 * ab einer Stunde als `timeEstimated` (≈). Geprüft in `pipeline/lib/sichtungsfenster.ts`.
 */
export interface Sichtung {
  /** Zu dieser Zeit fehlte die Folge noch, "HH:MM" Berlin. */
  notSeen: string
  /** Zu dieser Zeit war sie da, "HH:MM" Berlin. */
  seen: string
  /** ISO-Tag der Sichtung. */
  date: string
  source: string
}

declare module './types.ts' {
  interface Schedule {
    timeSighting?: Sichtung
  }
}
