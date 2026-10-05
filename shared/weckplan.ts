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
}

export const WECKPLAN: Weckplan[] = [
  { workflow: 'refresh-hourly.yml' },
  // Vorher 04:17 / 05:41 / 06:00 nach GitHub-Cron; der Tageslauf endet nach höchstens 75 Minuten, bevor der aniSearch-Katalog um 06:00 beginnt.
  { workflow: 'refresh-data.yml', stunden: [4] },
  { workflow: 'refresh-weekly.yml', stunden: [5], wochentag: 1 },
  { workflow: 'adn-laufende.yml', stunden: [2, 8, 14, 20] },
  { workflow: 'claude-verpasst-recherche.yml', stunden: [11] },
  { workflow: 'anisearch-katalog.yml', stunden: [6] },
]

/** Die Workflows, die zu diesem Zeitpunkt (UTC) starten sollen. */
export function faelligeLaeufe(jetzt: Date, plan: Weckplan[] = WECKPLAN): string[] {
  const stunde = jetzt.getUTCHours()
  const wochentag = jetzt.getUTCDay() === 0 ? 7 : jetzt.getUTCDay()
  return plan.filter((p) => (!p.stunden || p.stunden.includes(stunde)) && (!p.wochentag || p.wochentag === wochentag)).map((p) => p.workflow)
}
