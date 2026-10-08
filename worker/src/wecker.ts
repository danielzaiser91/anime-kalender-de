import type { Env } from './env.ts'
import { faelligeLaeufe, startErlaubt, type LaufStand } from '../../shared/weckplan.ts'

/**
 * **Der Wecker für die Datenläufe.** GitHubs eigener Cron-Plan feuert nicht pünktlich: gemessen am 05.10.2026 kam „Stündlich" alle ~4,6 Stunden, „Täglich"
 * im Mittel 6 Stunden und „Wöchentlich" 7 Stunden zu spät (Mittelwert über 14 Tage, `docs/wissen/betrieb.md`). Ein Cloudflare-Cron (`0 * * * *`) kommt
 * pünktlich und startet die Workflows über die GitHub-API (`workflow_dispatch`). Das Token liegt als Worker-Secret `GITHUB_WECKER_TOKEN` (Fine-grained,
 * nur dieses Repo, Actions: Read and write). Ohne Token tut die Funktion nichts.
 *
 * Fällt der Wecker aus, merkt es `wecker-wache.yml` (GitHub-Cron als zweite, unabhängige Linie) und startet überfällige Läufe selbst.
 */
const REPO = 'danielzaiser91/anime-kalender-de'

const KOPF = (env: Env) => ({
  Authorization: `Bearer ${env.GITHUB_WECKER_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'anime-kalender-wecker',
  'X-GitHub-Api-Version': '2022-11-28',
})

/** Die letzten Läufe dieses Workflows (neuester zuerst); leer, wenn die API nicht antwortet (dann wird gestartet). */
async function letzteLaeufe(env: Env, workflow: string): Promise<LaufStand[]> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=10`, { headers: KOPF(env) })
  if (!r.ok) return []
  return ((await r.json()) as { workflow_runs?: LaufStand[] }).workflow_runs ?? []
}

async function starte(env: Env, workflow: string, jetzt: Date): Promise<void> {
  /* Doppelstarts abfangen: Am 05.10.2026 kamen zwei Starts im Abstand von zehn Sekunden; Ursache ungeklärt, der Schutz gilt unabhängig davon. */
  const laeufe = await letzteLaeufe(env, workflow).catch(() => [])
  if (!startErlaubt(workflow, laeufe, jetzt)) {
    console.log(`[wecker] ${workflow}: übersprungen (Mindestabstand oder Lauf aktiv)`)
    return
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: KOPF(env),
    body: JSON.stringify({ ref: 'main' }),
  })
  if (r.status !== 204) console.error(`[wecker] ${workflow}: HTTP ${r.status}`)
}

/** Jede volle Stunde aufgerufen (`scheduled`): startet alles, was jetzt fällig ist. Ein Ausfall eines Starts hält die anderen nicht auf. */
export async function starteFaelligeLaeufe(env: Env, jetzt: Date = new Date()): Promise<void> {
  if (!env.GITHUB_WECKER_TOKEN) return
  await Promise.all(faelligeLaeufe(jetzt).map((w) => starte(env, w, jetzt).catch((e) => console.error(`[wecker] ${w}:`, e))))
}
