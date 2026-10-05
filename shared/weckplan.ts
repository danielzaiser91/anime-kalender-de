/**
 * **Wann welcher Datenlauf gestartet wird** — der Plan des Cloudflare-Weckers (`worker/src/wecker.ts`). Steht in `shared/`, damit `check:logic` ihn prüft, ohne den
 * Worker (und dessen Cloudflare-Typen) zu laden.
 *
 * Zeiten in UTC (der Worker-Cron feuert zur vollen Stunde); `wochentag`: 1 = Montag … 7 = Sonntag.
 */
export interface Weckplan {
  workflow: string
  /** Leer = jede Stunde. */
  stunden?: number[]
  wochentag?: number
  /** Mindestabstand zum letzten Start desselben Workflows in Minuten — schützt vor Doppelstarts (gemessen 05.10.2026: zwei Starts im Abstand von zehn Sekunden). */
  abstandMin: number
}

export const WECKPLAN: Weckplan[] = [
  { workflow: 'refresh-hourly.yml', abstandMin: 40 },
  // Vorher 04:17 / 05:41 / 06:00 nach GitHub-Cron; der Tageslauf endet nach höchstens 75 Minuten, bevor der aniSearch-Katalog um 06:00 beginnt.
  { workflow: 'refresh-data.yml', stunden: [4], abstandMin: 600 },
  { workflow: 'refresh-weekly.yml', stunden: [5], wochentag: 1, abstandMin: 4320 },
  { workflow: 'adn-laufende.yml', stunden: [2, 8, 14, 20], abstandMin: 240 },
  { workflow: 'claude-verpasst-recherche.yml', stunden: [11], abstandMin: 600 },
  { workflow: 'anisearch-katalog.yml', stunden: [6], abstandMin: 600 },
]

/** Mindestabstand eines Workflows in Minuten (Vorgabe 30 für Unbekannte). */
export const abstandMin = (workflow: string, plan: Weckplan[] = WECKPLAN): number => plan.find((p) => p.workflow === workflow)?.abstandMin ?? 30

/** Die Workflows, die zu diesem Zeitpunkt (UTC) starten sollen. */
export function faelligeLaeufe(jetzt: Date, plan: Weckplan[] = WECKPLAN): string[] {
  const stunde = jetzt.getUTCHours()
  const wochentag = jetzt.getUTCDay() === 0 ? 7 : jetzt.getUTCDay()
  return plan.filter((p) => (!p.stunden || p.stunden.includes(stunde)) && (!p.wochentag || p.wochentag === wochentag)).map((p) => p.workflow)
}
