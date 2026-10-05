import type { Env } from './env.ts'
import { abstandMin, faelligeLaeufe } from '../../shared/weckplan.ts'

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

/** Wie viele Minuten der letzte Start dieses Workflows zurückliegt; `null`, wenn unbekannt (dann wird gestartet). */
async function minutenSeitLetztemStart(env: Env, workflow: string, jetzt: Date): Promise<number | null> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=1`, { headers: KOPF(env) })
  if (!r.ok) return null
  const j = (await r.json()) as { workflow_runs?: { created_at?: string }[] }
  const t = Date.parse(j.workflow_runs?.[0]?.created_at ?? '')
  return Number.isFinite(t) ? (jetzt.getTime() - t) / 60000 : null
}

async function starte(env: Env, workflow: string, jetzt: Date): Promise<void> {
  /* Doppelstarts abfangen: Am 05.10.2026 kamen zwei Starts im Abstand von zehn Sekunden; Ursache ungeklärt, der Schutz gilt unabhängig davon. */
  const her = await minutenSeitLetztemStart(env, workflow, jetzt).catch(() => null)
  if (her !== null && her < abstandMin(workflow)) {
    console.log(`[wecker] ${workflow}: übersprungen, letzter Start vor ${her.toFixed(1)} min`)
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
