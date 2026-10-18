// PreToolUse(Bash): im Hauptordner C:/code/ai/anime-kalender-de sind nur lesende Git-Befehle und `git pull --ff-only` erlaubt;
// gearbeitet wird in Worktrees (C:/code/ai/_wt-*). Anlass 18.10.2026: Ein Prüfer kettete `git worktree add … ; cd … ; git checkout …`
// mit `;` — als `worktree add` scheiterte, liefen checkout und Folgebefehle im Hauptordner.
// Wirksames Arbeitsverzeichnis eines Git-Aufrufs: Bash-cwd, `cd <pfad>` in der Kette, `git -C <pfad>`, `--work-tree`. Ein `cd`, nach dem
// kein `&&` folgt, kann scheitern; dann bleibt das alte Verzeichnis — beide Möglichkeiten werden geprüft. Nicht auflösbare Pfade
// (`$VAR`, `~`, `$(…)`) lassen den Aufruf durch (Sperre aus Versehen ist schlimmer; Untergrenze: kein Shell-Interpreter).
// Einbindung ohne Änderung an settings.json: in ~/.claude/hooks/dispatch-pretooluse.js ins Feld PRUEFER eine Zeile
//   ['hauptordner-sperre.js', (i) => { const g = require(path.join(H, 'hauptordner-sperre.js')).pruefe(i); return g ? { permissionDecision: 'deny', permissionDecisionReason: g } : null }],
// Alternativ als eigener Eintrag in ~/.claude/settings.json unter hooks.PreToolUse:
//   { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/hauptordner-sperre.js"], "timeout": 10 }] }
const path = require('node:path')

const HAUPT = 'c:/code/ai/anime-kalender-de'
const VORSATZ = new Set(['rtk', 'command', 'env', 'time', 'sudo', 'do', 'then', 'else', 'if', 'while', 'until', '!', '{', '('])
const LESEN = new Set(['status', 'log', 'diff', 'show', 'fetch', 'rev-parse', 'ls-files', 'blame', 'grep', 'check-ignore', 'rev-list', 'cat-file', 'merge-base', 'describe', 'ls-tree', 'for-each-ref', 'show-ref', 'version'])
const WORKTREE_OK = new Set(['add', 'list', 'remove', 'prune'])
const BRANCH_LESEN = new Set(['--list', '-l', '-a', '-r', '-v', '-vv', '--show-current', '--merged', '--no-merged', '--contains'])

/** Pfad in Kleinschreibung mit Schrägstrichen und Laufwerk `c:/`; null, wenn er nicht statisch bekannt ist. */
function loese(basis, ziel) {
  if (!ziel || /[$`~*?]/.test(ziel)) return null
  const t = ziel.replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').toLowerCase()
  const absolut = /^[a-z]:\//.test(t) ? t : basis && path.posix.join(basis, t)
  return absolut ? path.posix.normalize(absolut).replace(/\/+$/, '') : null
}

const imHaupt = (p) => p === HAUPT || p.startsWith(`${HAUPT}/`)

/** Zeilen ohne Heredoc-Rümpfe (`<<EOF` … `EOF`). */
function ohneHeredoc(befehl) {
  const aus = []
  let ende = null
  for (const zeile of befehl.split('\n')) {
    if (ende !== null) {
      if (zeile.trim() === ende) ende = null
      continue
    }
    aus.push(zeile)
    const m = /<<-?\s*(?:'([^']+)'|"([^"]+)"|(\w+))/.exec(zeile)
    if (m) ende = m[1] || m[2] || m[3]
  }
  return aus.join('\n')
}

/** Zerlegt in Segmente { tokens, op }; `op` ist der Verknüpfer nach dem Segment (`&&`, `||`, `;`, `|`, '' am Ende). */
function zerlege(befehl) {
  const segmente = []
  let tokens = []
  let wort = null
  let quote = null
  const wortEnde = () => {
    if (wort !== null) tokens.push(wort)
    wort = null
  }
  const segEnde = (op) => {
    wortEnde()
    if (tokens.length) segmente.push({ tokens, op })
    else if (segmente.length) segmente[segmente.length - 1].op = op
    tokens = []
  }
  for (let i = 0; i < befehl.length; i++) {
    const c = befehl[i]
    const n = befehl[i + 1]
    if (quote) {
      if (c === quote) quote = null
      else if (quote === '"' && c === '\\' && n === '"') wort += befehl[++i]
      else wort += c
    } else if (c === "'" || c === '"') {
      quote = c
      wort = wort ?? ''
    } else if (c === ';' || c === '\n') segEnde(';')
    else if (c === '&' && n === '&') {
      segEnde('&&')
      i++
    } else if (c === '|') segEnde('|')
    else if (c === '&' && befehl[i - 1] !== '>' && befehl[i - 1] !== '<' && n !== '>') segEnde(';')
    else if (/\s/.test(c)) wortEnde()
    else wort = (wort ?? '') + c
  }
  segEnde('')
  return segmente
}

/** Optionen vor dem Unterbefehl: { wirksam: Verzeichnisse, unter: Unterbefehl, args } oder null. */
function liesGit(tokens, verzeichnisse) {
  let wirksam = verzeichnisse
  let i = 1
  for (; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '-C' || t === '--work-tree') {
      const ziel = tokens[++i]
      wirksam = wirksam.map((v) => loese(v, ziel)).filter(Boolean)
    } else if (t.startsWith('--work-tree=')) wirksam = wirksam.map((v) => loese(v, t.slice(12))).filter(Boolean)
    else if (t === '-c' || t === '--git-dir' || t === '--namespace') i++
    else if (!t.startsWith('-')) break
  }
  return { wirksam, unter: tokens[i], args: tokens.slice(i + 1) }
}

/** Grund (Text), wenn der Unterbefehl im Hauptordner nicht erlaubt ist, sonst null. */
function verbotenerUnterbefehl(unter, args) {
  if (!unter || LESEN.has(unter)) return null
  if (unter === 'pull') return args.includes('--ff-only') ? null : 'git pull ohne --ff-only'
  if (unter === 'worktree') return WORKTREE_OK.has(args[0]) ? null : `git worktree ${args[0] ?? ''}`.trim()
  if (unter === 'config') {
    const liest = args.some((a) => /^--(get|list)/.test(a) || a === '-l')
    return liest ? null : 'git config (schreibend)'
  }
  if (unter === 'remote') return !args[0] || ['get-url', '-v', 'show'].includes(args[0]) ? null : `git remote ${args[0]}`
  if (unter === 'branch') {
    const nurLesen = args.every((a) => BRANCH_LESEN.has(a) || !a.startsWith('-')) && (!args.length || args.some((a) => BRANCH_LESEN.has(a)))
    return nurLesen ? null : 'git branch (legt an oder ändert)'
  }
  return `git ${unter}`
}

/** Prüft einen Befehl ab Startverzeichnis `cwd`; liefert den Grund oder null. */
function pruefeBefehl(befehl, cwd, tiefe = 0) {
  let moegliche = [loese(null, cwd)].filter(Boolean)
  for (const { tokens: roh, op } of zerlege(ohneHeredoc(befehl))) {
    const tokens = [...roh]
    while (tokens.length && (VORSATZ.has(tokens[0]) || /^\w+=/.test(tokens[0]))) tokens.shift()
    const programm = (tokens[0] ?? '').replace(/\\/g, '/').split('/').pop().toLowerCase()
    if (programm === 'cd' || programm === 'pushd') {
      const ziele = moegliche.map((v) => loese(v, tokens[1])).filter(Boolean)
      moegliche = op === '&&' ? ziele : [...new Set([...moegliche, ...ziele])]
    } else if (/^(ba|z)?sh(\.exe)?$/.test(programm) && tokens[1] === '-c' && tiefe < 3) {
      for (const v of moegliche) {
        const grund = pruefeBefehl(tokens[2] ?? '', v, tiefe + 1)
        if (grund) return grund
      }
    } else if (programm === 'git' || programm === 'git.exe') {
      const { wirksam, unter, args } = liesGit(tokens, moegliche)
      const grund = verbotenerUnterbefehl(unter, args)
      if (grund && wirksam.some(imHaupt)) return grund
    }
  }
  return null
}

/** Grund der Verweigerung (Text) oder null — Schnittstelle wie die Module des Verteilers. */
function pruefe(eingabe) {
  if (eingabe.tool_name !== 'Bash') return null
  const grund = pruefeBefehl(String(eingabe.tool_input?.command ?? ''), eingabe.cwd ?? '')
  if (!grund) return null
  return `Hauptordner anime-kalender-de: „${grund}“ gesperrt (dort nur Lesen und git pull --ff-only). Arbeite in einem Worktree: git worktree add C:/code/ai/_wt-<name> -b <zweig> origin/main, danach „cd C:/code/ai/_wt-<name> && …“ mit && (nie mit ;, sonst läuft der Rest im Hauptordner, falls cd scheitert) oder git -C C:/code/ai/_wt-<name> …`
}

module.exports = { pruefe, pruefeBefehl }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    try {
      const grund = pruefe(JSON.parse(roh || '{}'))
      if (grund) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
    } catch (err) {
      process.stderr.write(`hauptordner-sperre: ${err.message}\n`)
    }
    process.exit(0)
  })
}
