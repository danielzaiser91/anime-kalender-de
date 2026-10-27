/**
 * Abnahme des Dirigenten gibt frei (F69, 26.10.2026; Anlass 27.10.: PR 2186 blieb trotz Abnahme gesperrt).
 *
 * Ein PR-Kommentar, der wörtlich mit `## Nachtrag (Abnahme Dirigent` beginnt und einen Präfix (>= 9 Zeichen) des aktuellen
 * Kopfs nennt, löst eine APPROVE-Review für genau diesen Kopf aus — auf demselben Weg wie der CI-Prüfer (GITHUB_TOKEN).
 * Workflow: .github/workflows/abnahme-freigabe.yml (issue_comment, Skript aus main, kein PR-Code).
 *
 *   node tools/abnahme-freigabe.mjs      (liest PR, REPO, COMMENT_USER, COMMENT_ASSOC, COMMENT_URL, COMMENT_BODY aus env)
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const PRAEFIX = '## Nachtrag (Abnahme Dirigent'
export const INHABER = 'danielzaiser91'
export const MIN_HASH = 9

/** Reine Entscheidung: 'ignorieren' (nicht für uns), 'hinweis' (Abnahme ohne passenden Hash) oder 'frei'. */
export function entscheide({ autor, assoziation, text, kopf }) {
  if (autor !== INHABER || assoziation !== 'OWNER') return { art: 'ignorieren' }
  if (typeof text !== 'string' || !text.startsWith(PRAEFIX)) return { art: 'ignorieren' }
  const kandidaten = text.match(/\b[0-9a-f]{9,40}\b/g) ?? []
  const treffer = kandidaten.find((h) => kopf.startsWith(h))
  if (treffer) return { art: 'frei', hash: treffer }
  return { art: 'hinweis' }
}

/** Führt die Entscheidung aus; `gh(args)` gibt stdout zurück (im Test eine Attrappe). */
export function lauf(env, gh) {
  if (!/^\d+$/.test(env.PR ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(env.REPO ?? '')) throw new Error('PR oder REPO ungültig')
  const kopf = gh(['pr', 'view', env.PR, '--repo', env.REPO, '--json', 'headRefOid', '-q', '.headRefOid']).trim()
  if (!/^[0-9a-f]{40}$/.test(kopf)) throw new Error('Kopf unlesbar')
  const e = entscheide({ autor: env.COMMENT_USER, assoziation: env.COMMENT_ASSOC, text: env.COMMENT_BODY, kopf })
  if (e.art === 'ignorieren') return e
  if (e.art === 'hinweis') {
    gh(['pr', 'comment', env.PR, '--repo', env.REPO, '--body',
      `Abnahme nicht angewandt: Der Kommentar nennt keinen Präfix (mindestens ${MIN_HASH} Zeichen) des aktuellen Kopfs ${kopf.slice(0, 9)}. Keine Freigabe.`])
    return e
  }
  const body = `Freigabe nach Abnahme des Dirigenten für ${kopf.slice(0, 9)} (genannt: ${e.hash}), Kommentar: ${env.COMMENT_URL}`
  gh(['api', '-X', 'POST', `repos/${env.REPO}/pulls/${env.PR}/reviews`, '-f', 'event=APPROVE', '-f', `commit_id=${kopf}`, '-f', `body=${body}`])
  return e
}

function ghEcht(args) {
  return execFileSync('gh', args, { encoding: 'utf8', windowsHide: true })
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const e = lauf(process.env, ghEcht)
  console.log(`Abnahme-Freigabe: ${e.art}${e.hash ? ` (${e.hash})` : ''}`)
}
