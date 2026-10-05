import type { Env } from './env.ts'

/**
 * **Der Wecker für die Datenläufe.** GitHubs eigener Cron-Plan feuert nicht pünktlich: gemessen am 05.10.2026 kam „Stündlich" alle ~4,6 Stunden, „Täglich"
 * im Mittel 6 Stunden und „Wöchentlich" 7 Stunden zu spät (Mittelwert über 14 Tage, `docs/wissen/betrieb.md`). Ein Cloudflare-Cron (`0 * * * *`) kommt
 * pünktlich und startet die Workflows über die GitHub-API (`workflow_dispatch`). Das Token liegt als Worker-Secret `GITHUB_WECKER_TOKEN` (Fine-grained,
 * nur dieses Repo, Actions: Read and write). Ohne Token tut die Funktion nichts.
 *
 * Fällt der Wecker aus, merkt es `wecker-wache.yml` (GitHub-Cron als zweite, unabhängige Linie) und startet überfällige Läufe selbst.
 */
const REPO = 'danielzaiser91/anime-kalender-de'

/** Wann welcher Workflow startet. Zeiten in UTC (der Worker-Cron feuert zur vollen Stunde); `wochentag`: 1 = Montag … 7 = Sonntag. */
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

async function starte(env: Env, workflow: string): Promise<void> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_WECKER_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'anime-kalender-wecker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main' }),
  })
  if (r.status !== 204) console.error(`[wecker] ${workflow}: HTTP ${r.status}`)
}

/** Jede volle Stunde aufgerufen (`scheduled`): startet alles, was jetzt fällig ist. Ein Ausfall eines Starts hält die anderen nicht auf. */
export async function starteFaelligeLaeufe(env: Env, jetzt: Date = new Date()): Promise<void> {
  if (!env.GITHUB_WECKER_TOKEN) return
  await Promise.all(faelligeLaeufe(jetzt).map((w) => starte(env, w).catch((e) => console.error(`[wecker] ${w}:`, e))))
}
