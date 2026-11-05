// PreToolUse(Write|Edit|MultiEdit|NotebookEdit): ein Subagent (Bauer, Prüfer, Analyst) schreibt nie im Hauptordner
// C:/code/ai/anime-kalender-de; gearbeitet wird im Worktree unter C:/code/_worktrees/anime-kalender-de/<thema>. Anlass: Regel
// „Worktree vor dem ersten Write“ in bauer.md, trotzdem Verstöße (2454, 2687).
// Erkennung: Der Hook-Eingabe-Block trägt `agent_id` und `agent_type` nur, wenn der Aufruf aus einem Subagenten kommt; in der
// Hauptsitzung fehlen beide (Claude-Code-Hooks-Doku „Common input fields“; gleiche Annahme in ~/.claude/hooks/befehlsregister.js
// und log-instructions.js). Die Hauptsitzung (Dirigent) bleibt frei.
// Ausnahme: daniel-zum-abarbeiten/berichte/ (Analyst-Berichte). Ein Worktree liegt außerhalb des Hauptordners und ist damit frei.
// Einbindung ohne Änderung an settings.json: in ~/.claude/hooks/dispatch-pretooluse.js ins Feld PRUEFER eine Zeile
//   ['subagent-schreibsperre.js', (i) => { const g = require(path.join(H, 'subagent-schreibsperre.js')).pruefe(i); return g ? { permissionDecision: 'deny', permissionDecisionReason: g } : null }],
const path = require('node:path')

const HAUPT = 'c:/code/ai/anime-kalender-de'
const WERKZEUGE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const ERLAUBT = `${HAUPT}/daniel-zum-abarbeiten/berichte/`

/** Pfad in Kleinschreibung mit Schrägstrichen und aufgelösten `..`; null, wenn nicht statisch bekannt. */
function normiere(cwd, ziel) {
  if (!ziel || /[$`~]/.test(ziel)) return null
  const t = ziel.replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').toLowerCase()
  const basis = (cwd || '').replace(/\\/g, '/').toLowerCase()
  const absolut = /^[a-z]:\//.test(t) ? t : basis && path.posix.join(basis, t)
  return absolut ? path.posix.normalize(absolut) : null
}

/** Grund (Text) für einen Subagenten-Schreibzugriff im Hauptordner, sonst null. */
function pruefe(eingabe) {
  if (!WERKZEUGE.has(eingabe.tool_name) || !eingabe.agent_id) return null
  const ti = eingabe.tool_input || {}
  const p = normiere(eingabe.cwd, ti.file_path || ti.notebook_path)
  if (p === null || !(p === HAUPT || p.startsWith(`${HAUPT}/`))) return null
  if (p.startsWith(ERLAUBT)) return null
  return `Schreiben im Hauptordner gesperrt (${ti.file_path || ti.notebook_path}): ein Subagent arbeitet nur im Worktree. Lege ihn an (git worktree add C:/code/_worktrees/anime-kalender-de/<thema> -b <zweig> origin/main), setze die node_modules-Junction und schreibe dort; erlaubt bleibt im Hauptordner nur daniel-zum-abarbeiten/berichte/.`
}

module.exports = { pruefe }
