/**
 * Deploy aus dem geprüften Build (16.10.2026): Der Deploy nach einem Squash-Merge baut nicht neu, wenn die PR-Prüfkette genau diesen
 * Quelltext schon gebaut und geprüft hat. Beweis ist der Git-Baum: `version.json` im Bau der PR-Prüfkette trägt `baum` (HEAD^{tree} der
 * Prüfung), und der gemergte Commit muss denselben Baum haben. Weicht er ab (main ist inzwischen weitergewandert), fehlt der Lauf,
 * ist der Lauf nicht grün, das Artefakt abgelaufen oder hat der PR `.github/` geändert, bleibt der Treffer aus und der Deploy baut wie bisher.
 * Aufruf im Workflow `deploy.yml` (Job `herkunft`): schreibt bei Treffer `treffer=1` nach $GITHUB_OUTPUT und `artifact.tar` ins Arbeitsverzeichnis.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KETTE = 'pr-pruefung.yml'

/** Der PR, dessen Squash-Commit genau `sha` ist (Zusammenführung nach main), sonst null. */
export function waehlePR(prs, sha) {
  const treffer = (prs ?? []).filter((p) => p.merged_at && p.merge_commit_sha === sha && p.base?.ref === 'main')
  return treffer.length === 1 ? { nummer: treffer[0].number, kopf: treffer[0].head.sha } : null
}

/** Neuester erfolgreich beendeter Lauf der PR-Prüfkette für den Kopf-Commit des PR, sonst null. */
export function waehleLauf(laeufe, kopf) {
  const gruen = (laeufe ?? []).filter((l) => l.event === 'pull_request' && l.head_sha === kopf && l.conclusion === 'success')
  return gruen.sort((a, b) => b.id - a.id)[0] ?? null
}

/** Stimmt der Baum aus `version.json` des Baus mit dem Baum des gemergten Commits überein (und ist nicht leer)? */
export function baumPasst(versionJson, baum) {
  try {
    const gelesen = JSON.parse(versionJson).baum
    return gelesen.length === 40 && gelesen === baum
  } catch {
    return false
  }
}

/** Der Teil `.github/` (Workflows, Action der Kette) darf sich im PR nicht geändert haben: sonst hätte der PR die Prüfung selbst verändern können. */
export function githubUnveraendert(ordnerCommit, ordnerEltern) {
  return Boolean(ordnerCommit) && ordnerCommit === ordnerEltern
}

const ausfuehren = (befehl, args, optionen = {}) => execFileSync(befehl, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...optionen }).trim()
const api = (pfad) => JSON.parse(ausfuehren('gh', ['api', pfad]))

function versionAusTar(tar) {
  for (const name of ['./version.json', 'version.json']) {
    try {
      return ausfuehren('tar', ['-xOf', tar, name], { stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      // nächster Name
    }
  }
  return ''
}

/** Prüft und holt den Bau; Rückgabe `{ treffer, grund }`. Wirft nie bei erwartbaren Abweichungen. */
export function holeBau({ repo, sha, ziel }) {
  const baum = ausfuehren('git', ['rev-parse', 'HEAD^{tree}'])
  const gh = ausfuehren('git', ['rev-parse', 'HEAD:.github'])
  let elternGh = ''
  try {
    elternGh = ausfuehren('git', ['rev-parse', 'HEAD~1:.github'], { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return { treffer: false, grund: 'kein Elterncommit zum Vergleich von .github/' }
  }
  if (!githubUnveraendert(gh, elternGh)) return { treffer: false, grund: '.github/ weicht vom Elterncommit ab (Workflows im PR geändert)' }
  const pr = waehlePR(api(`repos/${repo}/commits/${sha}/pulls`), sha)
  if (!pr) return { treffer: false, grund: 'kein gemergter PR mit diesem Squash-Commit' }
  const lauf = waehleLauf(api(`repos/${repo}/actions/workflows/${KETTE}/runs?head_sha=${pr.kopf}&event=pull_request&per_page=20`).workflow_runs, pr.kopf)
  if (!lauf) return { treffer: false, grund: `kein grüner Lauf der PR-Prüfkette für ${pr.kopf.slice(0, 8)}` }
  const ordner = mkdtempSync(join(tmpdir(), 'bau-'))
  try {
    ausfuehren('gh', ['run', 'download', String(lauf.id), '--repo', repo, '-n', 'github-pages', '-D', ordner], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    rmSync(ordner, { recursive: true, force: true })
    return { treffer: false, grund: `Artefakt von Lauf ${lauf.id} nicht abrufbar (abgelaufen?)` }
  }
  const tar = join(ordner, 'artifact.tar')
  if (!existsSync(tar) || !baumPasst(versionAusTar(tar), baum)) return { treffer: false, grund: `Baum des Baus aus Lauf ${lauf.id} weicht ab (main ist weitergewandert)` }
  copyFileSync(tar, ziel)
  return { treffer: true, grund: `PR #${pr.nummer}, Lauf ${lauf.id}` }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { treffer, grund } = holeBau({ repo: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA, ziel: process.argv[2] ?? 'artifact.tar' })
  console.log(treffer ? `Deploy aus geprüftem Bau: ${grund}` : `Deploy baut neu: ${grund}`)
  if (treffer && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'treffer=1\n')
}
