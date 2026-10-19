/**
 * Rechnet die PR-Prüfkette eines PR nach, bevor er gemergt wird (19.10.2026, Befund Prüfer 1576; Ansatz 1597 R2).
 * Grund: Die Kette läuft auf `refs/pull/N/merge`, also gegen main zum Zeitpunkt ihres Starts. GitHub baut diesen Merge-Commit
 * nicht neu, wenn main weiterkommt (gemessen 19.10.2026: 1597 blieb über 30 min auf der alten Basis), ein grüner Check kann also
 * gegen einen main gerechnet sein, den es nicht mehr gibt. `gh run rerun` nutzt denselben Merge-Commit; erst `reopened` baut ihn neu.
 *
 * Aufruf (Dirigent, vor jedem Merge): node tools/pr-nachrechnen.mjs <PR>
 *   Exit 0: der neueste Kettenlauf zum Kopf rechnete gegen den jetzigen main-HEAD.
 *   Exit 1: nicht aktuell; der PR wurde geschlossen und wieder geöffnet, die Kette läuft neu (der Prüfer hört nicht auf `reopened`).
 *   Exit 2: nichts angestoßen (Konflikt, Mergebarkeit offen, kein Lauf, Basis nicht lesbar, Fehler); die Meldung sagt, warum.
 * Die Basis steht in der Checkout-Zeile des Jobs JOB: „HEAD is now at … Merge <Kopf> into <Basis>“ (Text des Merge-Commits von GitHub).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const KETTE = 'pr-pruefung.yml'
/** Kleiner Job der Kette mit Checkout ohne eigenes `ref` (prüft `pr-nachrechnen.test.mjs` an der YAML). */
export const JOB = 'Kette – Workflows'
const OEFFNEN_VERSUCHE = 3

/** Basis (erster Elternteil des Merge-Commits) aus dem Job-Log, nur wenn die Zeile zum Kopf gehört; sonst null. */
export function basisAusLog(log, kopf) {
  if (!/^[0-9a-f]{40}$/.test(kopf)) return null
  const m = new RegExp(`HEAD is now at [0-9a-f]+ Merge ${kopf} into ([0-9a-f]{40})\\s*$`, 'm').exec(log)
  return m ? m[1] : null
}

/** Neuester Kettenlauf zum Kopf (gleicher Commit), sonst null. */
export function neuesterLauf(laeufe, kopf) {
  const passend = laeufe.filter((l) => l.headSha === kopf)
  return passend.reduce((neu, l) => (neu === null || Date.parse(l.createdAt) > Date.parse(neu.createdAt) ? l : neu), null)
}

/** Vor dem Lesen der Läufe: nur ein offener, konfliktfreier PR bekommt durch `reopened` eine neue Kette. */
export function hindernis(pr) {
  if (pr.state !== 'OPEN') return `PR ${pr.number} ist nicht offen (${pr.state})`
  if (pr.mergeable === 'CONFLICTING') return `PR ${pr.number} hat einen Konflikt mit main: erst main hineinmergen, das startet die Kette neu`
  if (pr.mergeable !== 'MERGEABLE') return `PR ${pr.number}: Mergebarkeit noch nicht berechnet (${pr.mergeable}), gleich erneut aufrufen`
  return null
}

const kurz = (sha) => sha.slice(0, 9)

function oeffneMitWiederholung(gh, nummer) {
  for (let versuch = 1; ; versuch++) {
    try {
      return gh(['pr', 'reopen', String(nummer)])
    } catch (e) {
      if (versuch >= OEFFNEN_VERSUCHE) throw new Error(`PR ${nummer} BLEIBT GESCHLOSSEN, von Hand öffnen (${e.message})`)
    }
  }
}

/** Liest Basis des neuesten Kettenlaufs; Rückgabe { basis } oder { grund } (dann ist nichts zu entscheiden). */
function basisDesLaufs(gh, pr) {
  const laeufe = JSON.parse(gh(['run', 'list', '--workflow', KETTE, '--event', 'pull_request', '--branch', pr.headRefName, '--limit', '20', '--json', 'databaseId,headSha,createdAt']))
  const lauf = neuesterLauf(laeufe, pr.headRefOid)
  if (lauf === null) return { grund: `PR ${pr.number}: kein Kettenlauf zum Kopf ${kurz(pr.headRefOid)}` }
  const jobs = JSON.parse(gh(['run', 'view', String(lauf.databaseId), '--json', 'jobs'])).jobs
  const job = jobs.find((j) => j.name === JOB)
  if (job === undefined) return { grund: `PR ${pr.number}: Lauf ${lauf.databaseId} hat keinen Job „${JOB}“` }
  const basis = basisAusLog(gh(['api', `repos/{owner}/{repo}/actions/jobs/${job.databaseId}/logs`]), pr.headRefOid)
  if (basis === null) return { grund: `PR ${pr.number}: Basis nicht im Log von „${JOB}“ (Lauf ${lauf.databaseId}; läuft er noch, übersprungen?)` }
  return { basis }
}

/** Ablauf für einen PR; `gh(args)` ist eingespeist, `melde` schreibt eine Zeile. Rückgabe: Exit-Code (siehe Kopf). */
export function nachrechnen(nummer, gh, melde) {
  const pr = JSON.parse(gh(['pr', 'view', String(nummer), '--json', 'number,state,mergeable,headRefOid,headRefName']))
  const halt = hindernis(pr)
  if (halt !== null) {
    melde(halt)
    return 2
  }
  const { basis, grund } = basisDesLaufs(gh, pr)
  if (grund !== undefined) {
    melde(grund)
    return 2
  }
  const main = gh(['api', 'repos/{owner}/{repo}/git/ref/heads/main', '--jq', '.object.sha']).trim()
  if (basis === main) {
    melde(`PR ${nummer}: aktuell, die Kette rechnete gegen main ${kurz(main)}`)
    return 0
  }
  gh(['pr', 'close', String(nummer)])
  oeffneMitWiederholung(gh, nummer)
  melde(`PR ${nummer}: NICHT AKTUELL (Kette gegen ${kurz(basis)}, main ist ${kurz(main)}), geschlossen und wieder geöffnet; Kette abwarten, dann erneut aufrufen`)
  return 1
}

export function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
}

/** Startlogik: Argument prüfen, Fehler als Exit 2 (nie still grün). */
export function main(argv, ausfuehrer, melde) {
  if (argv.length !== 1 || !/^\d+$/.test(argv[0])) {
    melde('Aufruf: node tools/pr-nachrechnen.mjs <PR-Nummer>')
    return 2
  }
  try {
    return nachrechnen(Number(argv[0]), ausfuehrer, melde)
  } catch (e) {
    melde(`pr-nachrechnen: FEHLER ${e.message}`)
    return 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2), gh, (t) => console.log(t)))
}
