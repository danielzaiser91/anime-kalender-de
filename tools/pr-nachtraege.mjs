/**
 * Holt die Nachträge und die Commit-Liste eines PR für den CI-Prüfer (16.10.2026).
 *
 *   node tools/pr-nachtraege.mjs <PR> <autor> <datei>     (hängt beides an <datei>; bei Fehler bleibt der Teil weg, Exit 0)
 *
 * Beschreibungen sind unveränderlich; spätere Runden stehen als Kommentar, dessen Text mit `Nachtrag` oder
 * `Nachbesserung` beginnt, mit oder ohne Marke (`**`, `#`), beliebige Schreibweise, führender Leerraum erlaubt.
 * Es zählen der PR-Autor (REST-Login, bei Apps `name[bot]`) und Konten mit Schreibrecht am Repo: PRs der
 * Claude-App kommentiert der Inhaber (17.10.2026, PR 1394: drei Nachträge nie beim Prüfer angekommen).
 * Die Commit-Liste mit Dateien je Commit braucht der Prüfer für „Umbau und Verhaltensänderung nie im selben Commit“.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const NACHTRAG = /^\s*(\*\*|#+ *)?(Nachtrag|Nachbesserung)/i
const AUTOR = /^[A-Za-z0-9][A-Za-z0-9-]*(\[bot\])?$/
const VERTRAUT = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const KOPF = '\n\n## Nachträge (gelten als Teil der Beschreibung, spätere gehen vor)'
export const COMMITS = '\n\n## Commits des PR (älteste zuerst, je Commit die geänderten Dateien)'
export const HINWEIS_NACHTRAEGE = '\n- Hinweis: Nachträge nicht lesbar, Beschreibung unvollständig'
// Grenzen der GitHub-API: `pulls/<n>/commits` liefert höchstens 250 Commits, `commits/<sha>` höchstens 300 Dateien.
const MAX_COMMITS = 250
const MAX_DATEIEN = 300

/** Kommentare der GitHub-API -> Texte der Nachträge von Autor und Repo-Berechtigten, in Reihenfolge. */
export function waehleNachtraege(kommentare, autor) {
  const zaehlt = (k) => k.user?.login === autor || VERTRAUT.has(k.author_association)
  return kommentare.filter((k) => zaehlt(k) && NACHTRAG.test(k.body ?? '')).map((k) => k.body)
}

/** Beschreibung plus Nachträge; ohne Treffer genau der Eingabetext. */
export function ergaenzeBeschreibung(text, kommentare, autor) {
  const texte = waehleNachtraege(kommentare, autor)
  return texte.length === 0 ? text : text + KOPF + texte.map((t) => '\n\n' + t).join('')
}

/** `[{sha, betreff, dateien}]` -> Abschnitt für die Beschreibung; leer ohne Commits. Nennt die Kappung der API. */
export function commitAbschnitt(commits) {
  if (commits.length === 0) return ''
  const gekappt = (c) => (c.dateien.length >= MAX_DATEIEN ? ` (Liste bei ${MAX_DATEIEN} Dateien gekappt)` : '')
  const zeile = (c) => `\n- ${c.sha.slice(0, 9)} ${c.betreff} — ${c.dateien.join(', ') || '(keine Datei)'}${gekappt(c)}`
  const hinweis = commits.length >= MAX_COMMITS ? `\n- Hinweis: Liste bei ${MAX_COMMITS} Commits gekappt, spätere fehlen` : ''
  return COMMITS + commits.map(zeile).join('') + hinweis
}

function gh(args) {
  const r = spawnSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout)
}

/** `--slurp` fasst die Seiten von `--paginate` zu einem Array von Arrays zusammen. */
function holeKommentare(api, repo, pr) {
  return api(['--paginate', '--slurp', `repos/${repo}/issues/${pr}/comments`]).flat()
}

function holeCommits(api, repo, pr) {
  const liste = api(['--paginate', '--slurp', `repos/${repo}/pulls/${pr}/commits`]).flat()
  return liste.map((c) => ({
    sha: c.sha,
    betreff: c.commit.message.split('\n')[0],
    dateien: api([`repos/${repo}/commits/${c.sha}`]).files.map((f) => f.filename),
  }))
}

/** Jeder Teil für sich fail-soft: fehlen die Commits, kommen die Nachträge trotzdem an. Liefert, ob der Teil gelang. */
function haenge(datei, name, teil) {
  try {
    const alt = readFileSync(datei, 'utf8')
    const neu = teil(alt)
    if (neu !== alt) writeFileSync(datei, neu)
    return true
  } catch (e) {
    console.error(`${name} nicht lesbar, Beschreibung ohne sie: ${e.message}`)
    return false
  }
}

/** Hängt Nachträge und Commit-Liste an <datei>; `api(args)` liefert das JSON von `gh api <args>`. */
export function ergaenzeDatei(datei, { api, repo, pr, autor }) {
  const nachtraegeOk = haenge(datei, 'Nachträge', (alt) => ergaenzeBeschreibung(alt, holeKommentare(api, repo, pr), autor))
  haenge(datei, 'Commits', (alt) => alt + commitAbschnitt(holeCommits(api, repo, pr)))
  // Letzte Zeile ist dann nicht der Kopf-Commit: die Sperre in pr-eingang.mjs meldet „unvollstaendig“.
  if (!nachtraegeOk) haenge(datei, 'Hinweis', (alt) => alt + HINWEIS_NACHTRAEGE)
}

function main() {
  const [pr, autor, datei] = process.argv.slice(2)
  if (!/^\d+$/.test(pr ?? '') || !AUTOR.test(autor ?? '') || !datei) return console.error('Aufruf: pr-nachtraege.mjs <PR> <autor> <datei>')
  ergaenzeDatei(datei, { api: gh, repo: process.env.GITHUB_REPOSITORY, pr, autor })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
