// PreToolUse(Write|Edit|MultiEdit|NotebookEdit): ein Subagent (Bauer, Prüfer, Analyst) schreibt nie im Hauptordner
// C:/code/ai/anime-kalender-de; gearbeitet wird im Worktree unter C:/code/_worktrees/anime-kalender-de/<thema>. Anlass: Regel
// „Worktree vor dem ersten Write“ in bauer.md, trotzdem Verstöße (2454, 2687).
// Erkennung: Der Hook-Eingabe-Block trägt `agent_id` und `agent_type` nur, wenn der Aufruf aus einem Subagenten kommt; in der
// Hauptsitzung fehlen beide (Claude-Code-Hooks-Doku „Common input fields“; gleiche Annahme in ~/.claude/hooks/befehlsregister.js
// und log-instructions.js). Die Hauptsitzung (Dirigent) bleibt frei.
// Gesperrt sind nur die Typen bauer, pruefer, analyst (im Befehlsregister als `typ` belegt); general-purpose, claude u. a. bleiben frei.
// Ausnahmen: daniel-zum-abarbeiten/berichte/ und /listen/ (Analyst-Berichte), daniel-zum-abarbeiten/mockups/ (Mockup-Bauer). Ein Worktree liegt
// außerhalb des Hauptordners und ist damit frei.
// Leitplanke, offene Formen (nicht erkannt, also nicht gesperrt): /mnt/c/…, 8.3-Kurznamen (ANIME~1), Pfade mit ~ oder $ (null,
// nicht statisch bekannt). Normiert werden Backslash, Git-Bash /c/…, UNC //?/c:/… und /cygdrive/c/….
// Einbindung ohne Änderung an settings.json: in ~/.claude/hooks/dispatch-pretooluse.js ins Feld PRUEFER eine Zeile
//   ['subagent-schreibsperre.js', (i) => { const g = require(path.join(H, 'subagent-schreibsperre.js')).pruefe(i); return g ? { permissionDecision: 'deny', permissionDecisionReason: g } : null }],
const path = require('node:path')

const HAUPT = 'c:/code/ai/anime-kalender-de'
const WERKZEUGE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const TYPEN = new Set(['bauer', 'pruefer', 'analyst'])
const ERLAUBT = ['daniel-zum-abarbeiten/berichte/', 'daniel-zum-abarbeiten/listen/', 'daniel-zum-abarbeiten/mockups/'].map((u) => `${HAUPT}/${u}`)

/** Pfad in Kleinschreibung mit Schrägstrichen und aufgelösten `..`; null, wenn nicht statisch bekannt. */
function normiere(cwd, ziel) {
  if (!ziel || /[$`~]/.test(ziel)) return null
  const t = ziel
    .replace(/\\/g, '/')
    .replace(/^\/\/\?\//, '')
    .replace(/^\/(?:cygdrive\/)?([a-z])\//i, '$1:/')
    .toLowerCase()
  const basis = (cwd || '').replace(/\\/g, '/').toLowerCase()
  const absolut = /^[a-z]:\//.test(t) ? t : basis && path.posix.join(basis, t)
  return absolut ? path.posix.normalize(absolut) : null
}

/** Grund (Text) für einen Subagenten-Schreibzugriff im Hauptordner, sonst null. */
function pruefe(eingabe) {
  if (!WERKZEUGE.has(eingabe.tool_name) || !eingabe.agent_id || !TYPEN.has(eingabe.agent_type)) return null
  const ti = eingabe.tool_input || {}
  const p = normiere(eingabe.cwd, ti.file_path || ti.notebook_path)
  if (p === null || !(p === HAUPT || p.startsWith(`${HAUPT}/`))) return null
  if (ERLAUBT.some((e) => p.startsWith(e))) return null
  return `Schreiben im Hauptordner gesperrt (${ti.file_path || ti.notebook_path}): ein Subagent arbeitet nur im Worktree. Lege ihn an (git worktree add C:/code/_worktrees/anime-kalender-de/<thema> -b <zweig> origin/main), setze die node_modules-Junction und schreibe dort; erlaubt bleibt im Hauptordner nur daniel-zum-abarbeiten/berichte/, daniel-zum-abarbeiten/listen/ und daniel-zum-abarbeiten/mockups/.`
}

module.exports = { pruefe }
