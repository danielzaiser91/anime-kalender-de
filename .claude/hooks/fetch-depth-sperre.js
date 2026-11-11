// PreToolUse(Bash): `git fetch|pull|clone` mit `--depth`/`--deepen`/`--shallow-*` im Repo anime-kalender-de oder einem seiner Worktrees
// wird abgewiesen. Anlass (11.11.2026): `git fetch --depth=1` in einem Worktree schrieb die gemeinsame `.git/shallow`; origin/main wurde
// Wurzel, `git pull --ff-only` im Hauptordner scheiterte. Wegwerf-Repos (z. B. unter Temp) bleiben frei.
// Ziel: Startverzeichnis (`cwd` der Eingabe), `cd`/`pushd` vor dem Befehl, `git -C <pfad>`; bei `clone` das Zielverzeichnis. Nicht
// bestimmbare Pfade (`$X`, `~`) fallen auf das aktuelle Verzeichnis zurück. Bekannte Grenzen wie bei no-verify-sperre.js (Alias, Variable als Programm).
const { zerlege, ohneHeredoc, eingebetteterBefehl, programmName, loese } = require('./hauptordner-sperre.js')

const REPO = ['c:/code/ai/anime-kalender-de', 'c:/code/_worktrees/anime-kalender-de']
const MIT_WERT = new Set(['-c', '--config-env', '--git-dir', '--work-tree', '--namespace', '--exec-path'])
const TIEF = ['--depth', '--deepen', '--shallow-since', '--shallow-exclude']
/** Optionen von clone, die ein weiteres Token als Wert nehmen (für die Suche nach dem Zielverzeichnis). */
const CLONE_MIT_WERT = new Set(['-b', '--branch', '-o', '--origin', '-c', '--config', '--reference', '--template', '-j', '--jobs', '--filter', '--separate-git-dir', '--upload-pack', '-u', '--server-option', '--bundle-uri'])

const imRepo = (pfad) => !!pfad && REPO.some((r) => pfad === r || pfad.startsWith(`${r}/`))

/** Tiefe Option (auch eindeutige Abkürzung ab 5 Zeichen wie `--dep`)? */
function istTief(a) {
  const name = a.split('=')[0]
  return name.length >= 5 && TIEF.some((voll) => voll.startsWith(name))
}

/** Verzeichnis, in dem git arbeitet: `-C` wirkt relativ zum Startverzeichnis und aufeinanderfolgend. */
function liesGit(tokens, von, verzeichnis) {
  let dir = verzeichnis
  let i = von + 1
  for (; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '-C') dir = loese(dir, tokens[++i]) ?? dir
    else if (MIT_WERT.has(t)) i++
    else if (!t.startsWith('-')) break
  }
  return { dir, unter: tokens[i], args: tokens.slice(i + 1) }
}

/** Zielverzeichnis von `git clone <url> [<ziel>]`; ohne Ziel das Verzeichnis, in dem geklont wird. */
function cloneZiel(args, dir) {
  const frei = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue
    if (CLONE_MIT_WERT.has(args[i])) i++
    else if (!args[i].startsWith('-')) frei.push(args[i])
  }
  return frei.length >= 2 ? (loese(dir, frei[1]) ?? dir) : dir
}

function pruefeGit(tokens, i, verzeichnis) {
  const { dir, unter, args } = liesGit(tokens, i, verzeichnis)
  if (!['fetch', 'pull', 'clone'].includes(unter) || !args.some(istTief)) return null
  const ziel = unter === 'clone' ? cloneZiel(args, dir) : dir
  return imRepo(ziel) ? `git ${unter} --depth` : null
}

/** Grund (Text) für einen Befehl ab Startverzeichnis `cwd` oder null. */
function pruefeBefehl(befehl, cwd) {
  let verzeichnis = loese(null, cwd)
  for (const { tokens } of zerlege(ohneHeredoc(befehl))) {
    if (!tokens) continue
    for (let i = 0; i < tokens.length; i++) {
      const p = programmName(tokens[i])
      if (p === 'echo' || p === 'printf') break
      if (p === 'cd' || p === 'pushd') {
        verzeichnis = loese(verzeichnis, tokens[i + 1]) ?? verzeichnis
        break
      }
      const skript = eingebetteterBefehl(tokens, i)
      if (skript) {
        const grund = pruefeBefehl(skript, verzeichnis)
        if (grund) return grund
      } else if (p === 'git' || p === 'git.exe') {
        const grund = pruefeGit(tokens, i, verzeichnis)
        if (grund) return grund
      }
    }
  }
  return null
}

/** Grund der Verweigerung (Text) oder null — Schnittstelle wie die Module des Verteilers. */
function pruefe(eingabe) {
  if (eingabe.tool_name !== 'Bash') return null
  const grund = pruefeBefehl(String(eingabe.tool_input?.command ?? ''), eingabe.cwd)
  if (!grund) return null
  return `„${grund}“ gesperrt: Worktrees teilen .git mit dem Hauptordner, ein flacher Fetch macht dort origin/main zur Wurzel und bricht pull und Vorfahrenmessungen. Nimm einen vollen Fetch ohne --depth (git fetch origin); flache Klone nur in einem Wegwerf-Ordner außerhalb des Repos.`
}

module.exports = { pruefe, pruefeBefehl }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    try {
      const grund = pruefe(JSON.parse(roh))
      if (grund) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
    } catch (err) {
      process.stderr.write(`fetch-depth-sperre: ${err.message}\n`)
    }
    process.exit(0)
  })
}
