/**
 * Weicher Schritt mit „FEHLER:“-Zeile: Ein Schritt mit `continue-on-error` lässt den Lauf grün, `wache-eskalation` meldet
 * erst ab der doppelten Frist (link-check: 18 Tage, der Schritt lief 6 Tage gelb). Diese Prüfung meldet schon beim ersten
 * Auftreten, und zwar mit Workflow, Job, Schritt, erster FEHLER-Zeile und Lauf-Link. Nur der jüngste Lauf je Workflow zählt:
 * ein grüner Folgelauf nimmt die Zeile von selbst zurück.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAG_MS = 86_400_000
/** Ein älterer Lauf ist keine Neuigkeit mehr; die Frist-Eskalation (`wache-eskalation`) übernimmt. */
export const LAUF_ALTER_TAGE = 14

/** Workflow-Dateien (nur Name) mit mindestens einem weichen Schritt, sortiert. */
export function workflowMitWeichemSchritt(wurzel) {
  const ordner = join(wurzel, '.github', 'workflows')
  return readdirSync(ordner)
    .filter((f) => f.endsWith('.yml') && /^\s*continue-on-error:\s*true\b/m.test(readFileSync(join(ordner, f), 'utf8')))
    .sort()
}

/** Weiche Fehlschläge einer Jobs-Antwort: Schritt `failure` in einem Job, der trotzdem `success` ist. */
export function weicheSchritte(antwort) {
  const jobs = Array.isArray(antwort?.jobs) ? antwort.jobs : []
  return jobs
    .filter((job) => job.conclusion === 'success')
    .flatMap((job) => (job.steps ?? []).filter((s) => s.conclusion === 'failure').map((s) => ({ jobId: job.id, job: job.name, schritt: s.name })))
}

/**
 * Erste Zeile des Logs, die mit `FEHLER:` beginnt (nach dem Zeitstempel, ohne Einrückung: die `env:`-Zeilen des
 * Schrittkopfs sind eingerückt) und danach Text trägt; sonst undefined.
 */
export function ersteFehlerZeile(log) {
  for (const roh of String(log).split(/\r?\n/)) {
    const inhalt = roh.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '')
    if (/^FEHLER:\s*\S/.test(inhalt)) return inhalt.trim()
  }
  return undefined
}

const json = (gh, ...args) => JSON.parse(gh(...args))

/** Warnzeilen eines Workflows aus dessen jüngstem Lauf; leer, wenn er rot, alt oder ohne weichen FEHLER-Schritt ist. */
function zeilenJe(gh, repo, datei, jetztMs) {
  const [lauf] = json(gh, 'run', 'list', '--repo', repo, '--workflow', datei, '--branch', 'main', '--status', 'completed', '--limit', '1', '--json', 'databaseId,conclusion,createdAt,url')
  if (!lauf || lauf.conclusion !== 'success') return []
  if (!((jetztMs - Date.parse(lauf.createdAt)) / TAG_MS <= LAUF_ALTER_TAGE)) return []
  const zeilen = []
  for (const w of weicheSchritte(json(gh, 'api', `repos/${repo}/actions/runs/${lauf.databaseId}/jobs?per_page=100`))) {
    const fehler = ersteFehlerZeile(gh('api', `repos/${repo}/actions/jobs/${w.jobId}/logs`))
    if (fehler) zeilen.push(`WEICH ${datei} / ${w.job} / ${w.schritt}: ${fehler} (${lauf.url})`)
  }
  return zeilen
}

/** Alle Warnzeilen; ein nicht lesbarer Workflow ist selbst eine Zeile (`WEICH? …`), nie Schweigen. */
export function weichZeilen(gh, repo, dateien, jetztMs) {
  return dateien.flatMap((datei) => {
    try {
      return zeilenJe(gh, repo, datei, jetztMs)
    } catch (fehler) {
      return [`WEICH? ${datei} nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
    }
  })
}

/** Aufruf der Wachphase: Dateiliste und Abrufe in einem; fehlt der Workflow-Ordner, steht das als Zeile da. */
export function weichWache(gh, repo, wurzel, jetztMs) {
  try {
    return weichZeilen(gh, repo, workflowMitWeichemSchritt(wurzel), jetztMs)
  } catch (fehler) {
    return [`WEICH? Workflows nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}
