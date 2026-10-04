import type { Env } from './env.ts'

/**
 * **Der Wecker für „Stündlich — Sendezeiten".** GitHubs eigener Cron-Plan feuerte am 04.10.2026 real etwa alle
 * 4,6 Stunden statt stündlich; ein Cloudflare-Cron kommt pünktlich. Er startet den Workflow über die GitHub-API
 * (`workflow_dispatch`); das Token liegt als Worker-Secret `GITHUB_WECKER_TOKEN` (Fine-grained, nur dieses Repo,
 * Actions: Read and write). Ohne Token tut die Funktion nichts.
 */
const REPO = 'danielzaiser91/anime-kalender-de'
const WORKFLOW = 'refresh-hourly.yml'

export async function starteStundenlauf(env: Env): Promise<void> {
  if (!env.GITHUB_WECKER_TOKEN) return
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_WECKER_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'anime-kalender-wecker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main' }),
  })
  if (r.status !== 204) console.error(`[wecker] ${WORKFLOW}: HTTP ${r.status}`)
}
