/**
 * Welche Workflow-Jobs ein Skript mit Browser (Playwright) starten, ohne Chromium einzurichten.
 * Anlass: `daten-auf-abruf.yml` bot `data:cr-dub` zur Wahl, installierte aber nie einen Browser (27.10.2026).
 */
import { parse } from 'yaml'

/** Skripte, die `chromium` aus Playwright starten (Wert-Import in `pipeline/*.ts`), mit allen Namen, unter denen Workflows sie aufrufen. */
export const BROWSER_SKRIPTE: Record<string, string[]> = {
  'belege-lesen.ts': ['belege-lesen'],
  'messbelege.ts': ['messbelege'],
  'scrape-crunchyroll-dub.ts': ['scrape-crunchyroll-dub', 'data:cr-dub'],
  'scrape-crunchyroll-woche.ts': ['scrape-crunchyroll-woche'],
}

interface Schritt {
  uses?: string
  run?: string
  with?: Record<string, unknown>
}
interface Job {
  steps?: Schritt[]
}
interface Workflow {
  on?: { workflow_dispatch?: { inputs?: Record<string, { options?: unknown[] }> } }
  jobs?: Record<string, Job>
}

function richtetBrowserEin(schritt: Schritt): boolean {
  const einrichten = !!schritt.uses?.endsWith('/einrichten') && String(schritt.with?.playwright) === 'true'
  return einrichten || (schritt.run ?? '').includes('playwright install')
}

/** Namen der Jobs, die ein Browser-Skript aufrufen (direkt oder über eine wählbare Option des Workflows) und keinen Browser einrichten. */
export function jobsOhneBrowser(yamlText: string): string[] {
  const wf = parse(yamlText) as Workflow
  const optionen = Object.values(wf.on?.workflow_dispatch?.inputs ?? {}).flatMap((i) => (i.options ?? []).map(String))
  const raus: string[] = []
  for (const [name, job] of Object.entries(wf.jobs ?? {})) {
    const schritte = job.steps ?? []
    const text = [...schritte.map((s) => s.run ?? ''), ...optionen].join('\n')
    const braucht = Object.values(BROWSER_SKRIPTE).flat().some((n) => text.includes(n))
    if (braucht && !schritte.some(richtetBrowserEin)) raus.push(name)
  }
  return raus
}
