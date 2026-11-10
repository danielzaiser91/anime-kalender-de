// Ordnung unter C:/code (Daniel, 25.10.2026): Worktrees liegen nur unter C:/code/_worktrees/<repo>/<thema>, Wegwerfdateien nie in einem
// Repo-Ordner. Zwei Prüfungen, vom PreToolUse-Hook hauptordner-sperre.js aufgerufen (dessen Eintrag im Verteiler genügt):
//   worktreeZielGrund  — `git worktree add` mit Ziel außerhalb von C:/code/_worktrees/<repo>/<thema> (Ziel nicht bestimmbar, z. B. `$X`: frei)
//   schreibGrund       — Write einer NEUEN Datei direkt in einer Repo-Wurzel unter C:/code (Hauptordner oder Worktree) mit Wegwerf-Namen.
// Grenze der zweiten: Namen mit `_`-Präfix, Endung .log/.bak/.tmp, oder Punkt-Präfix mit .txt/.tmp_-Anfang. Gemessen am 25.10.2026 an den
// versionierten Wurzeldateien von 22 Repos unter C:/code/ai: keine einzige passt (nur .gitignore, .env.example, robots.txt …);
// alle losen Dateien im Hauptordner-Status vom 25.10.2026 (_q.mjs, _vc-*.log, .liste1397.txt, .a.bak, .tmp_x) passen. Pauschal *.txt/*.mjs/.-Dateien wären
// Fehlalarme (robots.txt, eslint.config.mjs, .gitignore); ein Wurzel-Ordner ohne .git (neues Projekt) bleibt frei.
const fs = require('node:fs')
const path = require('node:path')

const WURZEL = 'c:/code/_worktrees'
const OPTIONEN_MIT_WERT = new Set(['-b', '-B', '--reason'])
const WEGWERF = [/^_/, /\.(log|bak|tmp)$/i, /^\.[^/]*\.txt$/i, /^\.tmp/i]

/** Erstes Nicht-Options-Argument von `git worktree add` (Ziel), `args` ohne `worktree`; undefined, wenn keins folgt. */
function zielArgument(args) {
  for (let i = 1; i < args.length; i++) {
    if (OPTIONEN_MIT_WERT.has(args[i])) i++
    else if (!args[i].startsWith('-')) return args[i]
  }
  return undefined
}

/** Liegt der Pfad (klein, Schrägstriche) unter `_worktrees/<repo>/<thema>` — mindestens zwei Ebenen unter der Wurzel? */
const imWorktreeOrdner = (p) => p.startsWith(`${WURZEL}/`) && p.slice(WURZEL.length + 1).split('/').filter(Boolean).length >= 2

/**
 * Grund (Text) für `git worktree add` mit falschem Ziel, sonst null. `args` ab `worktree`-Unterbefehl, `cwds` mögliche Arbeitsverzeichnisse,
 * `loese(basis, pfad)` der Pfadauflöser des Hooks (null = nicht bestimmbar).
 */
function worktreeZielGrund(args, cwds, loese) {
  if (args[0] !== 'add') return null
  const ziel = zielArgument(args)
  if (ziel === undefined) return null
  for (const cwd of cwds) {
    const abs = loese(cwd, ziel)
    if (abs !== null && !imWorktreeOrdner(abs)) return `git worktree add außerhalb von C:/code/_worktrees (${ziel})`
  }
  return null
}

const ZIEL_TEXT = 'Worktrees liegen nur unter C:/code/_worktrees/<repo>/<thema> (Daniel, 25.10.2026): git worktree add C:/code/_worktrees/<repo>/<thema> -b <zweig> origin/main, danach „cd C:/code/_worktrees/<repo>/<thema> && …“.'

/** Ist `name` ein Wegwerf-Name im Sinn der Grenze oben? */
const istWegwerfName = (name) => WEGWERF.some((r) => r.test(name))

/** Grund (Text) für Write einer neuen Wegwerfdatei in eine Repo-Wurzel unter C:/code, sonst null. `existiert` nur für den Test ersetzbar. */
function schreibGrund(eingabe, existiert = fs.existsSync) {
  if (eingabe.tool_name !== 'Write') return null
  const datei = String(eingabe.tool_input?.file_path ?? '').replace(/\\/g, '/')
  const ordner = path.posix.dirname(datei)
  if (!/^c:\/code\//i.test(ordner) || !istWegwerfName(path.posix.basename(datei))) return null
  if (existiert(datei) || !existiert(`${ordner}/.git`)) return null
  return `Wegwerfdatei „${path.posix.basename(datei)}“ direkt in der Repo-Wurzel ${ordner} (Daniel, 25.10.2026: unter C:/code bleibt es sauber). Logs, Probeskripte und PR-Texte gehören ins Scratchpad der Sitzung, nie in einen Repo- oder Projektordner.`
}

module.exports = { WURZEL, ZIEL_TEXT, zielArgument, imWorktreeOrdner, worktreeZielGrund, istWegwerfName, schreibGrund }
