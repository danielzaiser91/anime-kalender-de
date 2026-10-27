/**
 * Welche Workflow-Jobs ein Skript mit Browser (Playwright) starten, ohne vorher Chromium einzurichten.
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
  if?: unknown
  with?: Record<string, unknown>
}
interface Job {
  steps?: Schritt[]
}
interface Workflow {
  on?: { workflow_dispatch?: { inputs?: Record<string, { options?: unknown[] }> } }
  jobs?: Record<string, Job>
}

const NAMEN = Object.values(BROWSER_SKRIPTE).flat()

function richtetBrowserEin(schritt: Schritt): boolean {
  const einrichten = !!schritt.uses?.endsWith('/einrichten') && String(schritt.with?.playwright) === 'true'
  return einrichten || (schritt.run ?? '').includes('playwright install')
}

/** Ob der Schritt ein Browser-Skript startet: dessen Name im Befehl, oder ein Befehl, der den Namen aus einer wählbaren Option einsetzt (`npm run "$LAUF"`). */
function startetBrowser(schritt: Schritt, optionen: string[]): boolean {
  const run = schritt.run ?? ''
  return NAMEN.some((n) => run.includes(n)) || (optionen.some((o) => NAMEN.includes(o)) && run.includes('npm run "'))
}

/** Eine Bedingung am Installationsschritt muss jede wählbare Browser-Option nennen, sonst installiert er für die falsche Wahl. */
function bedingungPasst(schritt: Schritt, optionen: string[]): boolean {
  if (schritt.if === undefined) return true
  const bedingung = String(schritt.if)
  return optionen.filter((o) => NAMEN.includes(o)).every((o) => bedingung.includes(o))
}

/** Namen der Jobs, die ein Browser-Skript aufrufen (direkt oder über eine Option) und davor keinen passenden Installationsschritt haben. */
export function jobsOhneBrowser(yamlText: string): string[] {
  const wf = parse(yamlText) as Workflow
  const optionen = Object.values(wf.on?.workflow_dispatch?.inputs ?? {}).flatMap((i) => (i.options ?? []).map(String))
  const raus: string[] = []
  for (const [name, job] of Object.entries(wf.jobs ?? {})) {
    const schritte = job.steps ?? []
    const erster = schritte.findIndex((s) => startetBrowser(s, optionen))
    if (erster < 0) continue
    const davor = schritte.slice(0, erster)
    if (!davor.some((s) => richtetBrowserEin(s) && bedingungPasst(s, optionen))) raus.push(name)
  }
  return raus
}
