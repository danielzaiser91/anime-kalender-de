/**
 * Deploy aus dem geprüften Build (16.10.2026): Der Deploy nach einem Squash-Merge baut nicht neu, wenn die PR-Prüfkette genau diesen
 * Quelltext schon gebaut und geprüft hat. Beweis ist der Git-Baum: `version.json` im Bau der PR-Prüfkette trägt `baum` (HEAD^{tree} der
 * Prüfung), und der gemergte Commit muss denselben Baum haben. Ist main inzwischen nur mit Dateien weitergewandert, die der Seitenbau nicht
 * liest (Bestandsbau, Sammler unter `data/`), genügt der gleiche Abdruck (`abdruck` in `version.json`, tools/bau-eingaben.mjs, 17.10.2026).
 * Weicht beides ab, fehlt der Lauf, ist der Lauf nicht grün, das Artefakt abgelaufen oder hat der PR unter `.github/` mehr als fremde
 * Workflows geändert (`githubUnbedenklich`), bleibt der Treffer aus und der Deploy baut wie bisher.
 * Aufruf im Workflow `deploy.yml` (Job `herkunft`): schreibt bei Treffer `treffer=1` nach $GITHUB_OUTPUT und `artifact.tar` ins Arbeitsverzeichnis.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abdruckAusGit } from './bau-eingaben.mjs'

const KETTE = 'pr-pruefung.yml'
const SAMMEL = 'PR-Prüfkette'

/** Der PR, dessen Squash-Commit genau `sha` ist (Zusammenführung nach main), sonst null. */
export function waehlePR(prs, sha) {
  const treffer = (prs ?? []).filter((p) => p.merged_at && p.merge_commit_sha === sha && p.base?.ref === 'main')
  return treffer.length === 1 ? { nummer: treffer[0].number, kopf: treffer[0].head.sha } : null
}

/** Ist der Pflicht-Check "PR-Prüfkette" (Sammeljob) in diesen Jobs erfolgreich? Der Lauf selbst zählt nicht: das unverbindliche PR-Aussehen kann noch laufen. */
export function sammelGruen(jobs) {
  return jobs.some((j) => j.name === SAMMEL && j.conclusion === 'success')
}

/** Neuester Lauf der PR-Prüfkette für den Kopf-Commit des PR aus diesem Repo (kein Fork: dessen Bau liefe unter anderem Env), dessen Sammeljob grün ist (höchstens die drei neuesten werden gefragt), sonst null. */
export function waehleLauf(laeufe, kopf, jobsVon, repo) {
  const meiner = (l) => l.event === 'pull_request' && l.head_sha === kopf && l.head_repository?.full_name === repo
  const kandidaten = (laeufe ?? []).filter(meiner).sort((a, b) => b.id - a.id)
  return kandidaten.slice(0, 3).find((l) => sammelGruen(jobsVon(l.id))) ?? null
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

/** Stimmt der Abdruck aus `version.json` des Baus mit dem Abdruck des gemergten Stands (`git` wie `w.git`, tools/bau-eingaben.mjs) überein? Fehlt er oder scheitert Git: nein. */
export function abdruckPasst(versionJson, git) {
  try {
    return JSON.parse(versionJson).abdruck === abdruckAusGit(git)
  } catch {
    return false
  }
}

/** Workflows, die den geholten Bau erzeugen (die Kette) oder ihn ausliefern (Bau-Env des Deploys muss dem der Kette gleichen). */
export const KETTEN_WORKFLOWS = [`.github/workflows/${KETTE}`, '.github/workflows/deploy.yml']

/**
 * Die im PR geänderten Pfade unter `.github/` dürfen weder Kette noch Deploy verändern: sonst hätte der PR die Prüfung selbst verfälschen können.
 * Unbedenklich sind nur andere Workflow-Dateien (Sammler, Prüfer-Agent), denn sie laufen in keiner der beiden; Actions und alles Übrige zählen immer.
 */
export function githubUnbedenklich(geaendert) {
  return geaendert.every((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p) && !KETTEN_WORKFLOWS.includes(p))
}

const ausfuehren = (befehl, args, optionen = {}) => execFileSync(befehl, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...optionen }).trim()

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

/** Die echten Aufrufe (git, gh, tar); `holeBau` bekommt im Test ein Kulissen-Werkzeug mit denselben vier Funktionen. */
const ECHT = {
  git: (args) => ausfuehren('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }),
  api: (pfad) => JSON.parse(ausfuehren('gh', ['api', pfad])),
  laden: (repo, laufId) => {
    const ordner = mkdtempSync(join(tmpdir(), 'bau-'))
    ausfuehren('gh', ['run', 'download', String(laufId), '--repo', repo, '-n', 'github-pages', '-D', ordner], { stdio: ['ignore', 'pipe', 'pipe'] })
    return join(ordner, 'artifact.tar')
  },
  version: versionAusTar,
  kopieren: copyFileSync,
}

/** Prüft und holt den Bau; Rückgabe `{ treffer, grund }`. Wirft nie bei erwartbaren Abweichungen. */
export function holeBau({ repo, sha, ziel }, w = ECHT) {
  const baum = w.git(['rev-parse', 'HEAD^{tree}'])
  let geaendert = []
  try {
    // --no-renames: Umbenennungserkennung bräuchte Blobs, der Checkout holt nur Bäume (blob:none).
    geaendert = w.git(['diff', '--no-renames', '--name-only', 'HEAD~1', 'HEAD', '--', '.github']).split('\n').filter(Boolean)
  } catch {
    return { treffer: false, grund: 'kein Elterncommit zum Vergleich von .github/' }
  }
  if (!githubUnbedenklich(geaendert)) return { treffer: false, grund: `.github/ im PR geändert (Kette, Deploy oder Action): ${geaendert.join(', ')}` }
  const pr = waehlePR(w.api(`repos/${repo}/commits/${sha}/pulls`), sha)
  if (!pr) return { treffer: false, grund: 'kein gemergter PR mit diesem Squash-Commit' }
  const laeufe = w.api(`repos/${repo}/actions/workflows/${KETTE}/runs?head_sha=${pr.kopf}&event=pull_request&per_page=20`).workflow_runs
  const lauf = waehleLauf(laeufe, pr.kopf, (id) => w.api(`repos/${repo}/actions/runs/${id}/jobs`).jobs, repo)
  if (!lauf) return { treffer: false, grund: `kein grüner Lauf der PR-Prüfkette für ${pr.kopf.slice(0, 8)}` }
  let tar = ''
  try {
    tar = w.laden(repo, lauf.id)
  } catch {
    return { treffer: false, grund: `Artefakt von Lauf ${lauf.id} nicht abrufbar (abgelaufen?)` }
  }
  const version = w.version(tar)
  const nurDaten = !baumPasst(version, baum)
  if (nurDaten && !abdruckPasst(version, w.git)) {
    return { treffer: false, grund: `Baum und Abdruck des Baus aus Lauf ${lauf.id} weichen ab (main ist mit Code oder Bau-Eingaben weitergewandert)` }
  }
  w.kopieren(tar, ziel)
  return { treffer: true, grund: `PR #${pr.nummer}, Lauf ${lauf.id}${nurDaten ? ', main seither nur mit Dateien weitergewandert, die der Bau nicht liest' : ''}` }
}

/** Aufrufweg des Workflows: holt den Bau, meldet das Ergebnis im Log und setzt bei Treffer (nur dann) den Job-Ausgang `treffer=1`. */
export function laufe({ env, ziel }, w = ECHT, schreibe = appendFileSync, log = console.log) {
  const { treffer, grund } = holeBau({ repo: env.GITHUB_REPOSITORY, sha: env.GITHUB_SHA, ziel }, w)
  log(treffer ? `Deploy aus geprüftem Bau: ${grund}` : `Deploy baut neu: ${grund}`)
  if (treffer && env.GITHUB_OUTPUT) schreibe(env.GITHUB_OUTPUT, 'treffer=1\n')
  return treffer
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  laufe({ env: process.env, ziel: process.argv[2] ?? 'artifact.tar' })
}
