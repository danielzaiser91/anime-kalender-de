// PreToolUse(Bash): im Hauptordner C:/code/ai/anime-kalender-de sind nur lesende Git-Befehle und `git pull --ff-only` erlaubt;
// gearbeitet wird in Worktrees. Anlass 18.10.2026: Ein Prüfer kettete `git worktree add … ; cd … ; git checkout …` mit `;` —
// als `worktree add` scheiterte, liefen checkout und Folgebefehle im Hauptordner.
// Aufbau: Der Befehl wird in Segmente zerlegt (Trenner `;` `&&` `||` `|` `&`, Zeilenumbruch, Klammern, `$(…)`, Backticks, auch in
// Anführungszeichen). In jedem Segment zählt jedes Token mit Basisname `git` als Aufruf — egal, was davor steht (timeout, env, xargs …);
// Shells (`-c`-Bündel) und `eval` werden rekursiv geprüft, `echo`/`printf` ausgenommen.
// Wirksames Verzeichnis: Bash-cwd, `cd`, `git -C`, `--work-tree`. Ein `cd` ohne folgendes `&&` kann scheitern: dann zählen beide
// Möglichkeiten. Nicht bestimmbare Ziele (`$X`, `~`) fallen auf das Startverzeichnis (cwd) zurück. Klammern halten ihr `cd` im Inneren.
// „Im Hauptordner“ heißt: erster Vorfahr mit `.git` ist der Hauptordner selbst (eine `.git`-Datei oder ein anderer Treffer = eigener
// Arbeitsbaum); noch nicht angelegte `HAUPT/.claude/worktrees/*` gelten vorab als Worktrees (ein vorhandener Ordner ohne `.git` nicht: Git läuft dort im Hauptordner).
// Worktrees selbst liegen seit 25.10.2026 unter C:/code/_worktrees/<repo>/<thema>, außerhalb des Hauptordners. Zwei weitere Prüfungen
// (Ziel von `git worktree add`, Wegwerfdateien per Write in Repo-Wurzeln) stehen in ort-sperre.js und laufen über dieselbe Einbindung.
// Unbekannte Git-Unterbefehle sind frei: gesperrt wird nur, was Zweig oder Stand schreibt (SCHREIBEND und SONDER).
// Einbindung ohne Änderung an settings.json: in ~/.claude/hooks/dispatch-pretooluse.js ins Feld PRUEFER eine Zeile
//   ['hauptordner-sperre.js', (i) => { const g = require(path.join(H, 'hauptordner-sperre.js')).pruefe(i); return g ? { permissionDecision: 'deny', permissionDecisionReason: g } : null }],
// Alternativ als eigener Eintrag in ~/.claude/settings.json unter hooks.PreToolUse: (der Matcher des Verteilers enthält Write; als Einzeleintrag braucht die Write-Sperre "Bash|Write")
//   { "matcher": "Bash|Write", "hooks": [{ "type": "command", "command": "node", "args": ["C:/Users/ih/.claude/hooks/hauptordner-sperre.js"], "timeout": 10 }] }
const fs = require('node:fs')
const path = require('node:path')
const ORT = require('./ort-sperre.js')

const HAUPT = 'c:/code/ai/anime-kalender-de'
const SCHREIBEND = new Set(['checkout', 'switch', 'merge', 'rebase', 'commit', 'reset', 'cherry-pick', 'revert', 'restore', 'am', 'push', 'add', 'rm', 'mv', 'clean', 'apply', 'update-ref', 'update-index', 'symbolic-ref', 'read-tree', 'sparse-checkout', 'filter-branch', 'bisect'])
const WORKTREE_OK = new Set(['add', 'list', 'remove', 'prune'])
const BRANCH_LISTE = new Set(['--list', '-l', '-a', '--all', '-r', '--remotes', '-v', '-vv', '--merged', '--no-merged', '--contains', '--no-contains', '--points-at'])
const BRANCH_ANZEIGE = new Set(['--show-current', '--format', '--sort', '--color', '--no-color', '--column', '--no-column', '-i', '--ignore-case'])
const TAG_LISTE = new Set(['-l', '--list', '-n', '--points-at', '--contains', '--no-contains', '--merged', '--no-merged', '--sort', '--format'])
const optionsName = (a) => a.split('=')[0]

/** Pfad in Kleinschreibung mit Schrägstrichen, ohne Endstrich; null, wenn er nicht statisch bekannt ist (relativ ohne Basis, `$X`, `~`). */
function loese(basis, ziel) {
  if (!ziel || /[$`~*?]/.test(ziel)) return null
  const t = ziel.replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').toLowerCase()
  const absolut = /^([a-z]:)?\//.test(t) ? t : basis && path.posix.join(basis, t)
  return absolut ? path.posix.normalize(absolut).replace(/\/+$/, '') : null
}

/** Liegt `p` unterhalb von `haupt` in einem anderen Arbeitsbaum (erster Vorfahr mit `.git` ist nicht `haupt` selbst)? */
function inEigenemBaum(p, haupt) {
  for (let d = p; d.length > haupt.length; d = path.posix.dirname(d)) {
    if (fs.existsSync(`${d}/.git`)) return true
  }
  return false
}

function imHaupt(p, haupt) {
  if (!p || !(p === haupt || p.startsWith(`${haupt}/`))) return false
  if (!fs.existsSync(p) && /^\.claude\/worktrees\//.test(p.slice(haupt.length + 1))) return false
  return !inEigenemBaum(p, haupt)
}

/** Zeilen ohne Heredoc-Rümpfe (`<<EOF` … `EOF`); Here-Strings (`<<<`) und Arithmetik (`1<<2`) beginnen keinen. */
function ohneHeredoc(befehl) {
  const aus = []
  let ende = null
  for (const zeile of befehl.split('\n')) {
    if (ende !== null) {
      if (zeile.trim() === ende) ende = null
      continue
    }
    aus.push(zeile)
    const m = /(?<!<)<<-?\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_]\w*))/.exec(zeile)
    if (m) ende = m[1] || m[2] || m[3]
  }
  return aus.join('\n')
}

/**
 * Zerlegt in Segmente { tokens, op }; `op` ist der Verknüpfer nach dem Segment (`&&`, `||`, `;`, `|`, '' am Ende).
 * Klammern, `$(` und Backticks liefern zusätzlich { auf } und { zu }, damit ein `cd` im Inneren nicht nach außen wirkt.
 */
function zerlege(befehl) {
  const segmente = []
  const gemerkt = []
  let tokens = []
  let wort = null
  let quote = null
  let backtick = false
  const wortEnde = () => {
    if (wort !== null) tokens.push(wort)
    wort = null
  }
  const segEnde = (op) => {
    wortEnde()
    segmente.push({ tokens, op })
    tokens = []
  }
  const auf = () => {
    segEnde(';')
    gemerkt.push(quote)
    quote = null
    segmente.push({ auf: true })
  }
  const zu = () => {
    segEnde(';')
    quote = gemerkt.pop() ?? null
    segmente.push({ zu: true })
  }
  for (let i = 0; i < befehl.length; i++) {
    const c = befehl[i]
    const n = befehl[i + 1]
    if (quote === "'") {
      if (c === "'") quote = null
      else wort += c
    } else if (c === '`') {
      if (backtick) zu()
      else auf()
      backtick = !backtick
    } else if (c === '$' && n === '(') {
      auf()
      i++
    } else if (quote === '"') {
      if (c === '"') quote = null
      else if (c === '\\' && n === '"') wort += befehl[++i]
      else wort += c
    } else if (c === "'" || c === '"') {
      quote = c
      wort = wort ?? ''
    } else if (c === '(') auf()
    else if (c === ')') zu()
    else if (c === ';' || c === '\n') segEnde(';')
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

const programmName = (t) => t.replace(/\\/g, '/').split('/').pop().toLowerCase()

/** Setzt bekannte Shell-Variablen (`W=…;` weiter vorn in der Kette) in ein Ziel ein; unbekannte bleiben stehen. */
const mitVariablen = (ziel, vars) => ziel?.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => vars[a ?? b] ?? m)

/** Wirksame Verzeichnisse nach `-C`/`--work-tree` ab Token `von`, Unterbefehl und Argumente. */
function liesGit(tokens, von, z) {
  let wirksam = z.moegliche
  const neu = (ziel) => wirksam.map((v) => loese(v, mitVariablen(ziel, z.vars)) ?? z.start)
  let i = von + 1
  for (; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '-C' || t === '--work-tree') wirksam = neu(tokens[++i])
    else if (t.startsWith('--work-tree=')) wirksam = neu(t.slice(12))
    else if (t === '-c' || t === '--git-dir' || t === '--namespace') i++
    else if (!t.startsWith('-')) break
  }
  return { wirksam, unter: tokens[i], args: tokens.slice(i + 1) }
}

function configSchreibt(a) {
  if (a.some((x) => /^--(get|list|global|system)/.test(x) || x === '-l')) return null
  const schreibFlag = a.some((x) => /^--(unset|add|replace-all|edit|rename-section|remove-section)/.test(x) || x === '-e')
  return schreibFlag || a.filter((x) => !x.startsWith('-')).length >= 2 ? 'git config (schreibend)' : null
}

function branchSchreibt(a) {
  const optionen = a.filter((x) => x.startsWith('-')).map(optionsName)
  const nurLesen = optionen.every((o) => BRANCH_LISTE.has(o) || BRANCH_ANZEIGE.has(o)) && (optionen.length === a.length || optionen.some((o) => BRANCH_LISTE.has(o)))
  return nurLesen ? null : 'git branch (legt an oder ändert)'
}

/** Unterbefehle, die nur mit bestimmten Argumenten schreiben: Argumente → Grund oder null. */
const SONDER = {
  pull: (a) => (a.includes('--ff-only') ? null : 'git pull ohne --ff-only'),
  worktree: (a) => (WORKTREE_OK.has(a[0]) ? null : `git worktree ${a[0] ?? ''}`.trim()),
  remote: (a) => (!a[0] || ['get-url', '-v', 'show'].includes(a[0]) ? null : `git remote ${a[0]}`),
  stash: (a) => (['list', 'show'].includes(a[0]) ? null : 'git stash'),
  reflog: (a) => (['expire', 'delete'].includes(a[0]) ? `git reflog ${a[0]}` : null),
  tag: (a) => (!a.length || a.some((x) => TAG_LISTE.has(optionsName(x))) ? null : 'git tag (legt an oder ändert)'),
  config: configSchreibt,
  branch: branchSchreibt,
}

/** Grund (Text), wenn der Unterbefehl im Hauptordner nicht erlaubt ist, sonst null. */
function verbotenerUnterbefehl(unter, args) {
  if (Object.hasOwn(SONDER, unter)) return SONDER[unter](args)
  return SCHREIBEND.has(unter) ? `git ${unter}` : null
}

/** Skriptteil einer Shell (`-c`-Bündel wie `-lc`, `-e -c`) oder von `eval`; nichts (undefined oder leer), wenn das Token keins von beiden ist oder kein Skript folgt. */
function eingebetteterBefehl(tokens, i) {
  const p = programmName(tokens[i])
  if (p === 'eval') return tokens.slice(i + 1).join(' ')
  if (!/^(ba|z|da)?sh(\.exe)?$/.test(p)) return undefined
  for (let j = i + 1; j < tokens.length && tokens[j].startsWith('-'); j++) {
    if (/^-[A-Za-z]*c[A-Za-z]*$/.test(tokens[j])) return tokens[j + 1]
  }
  return undefined
}

/** Prüft ein Segment; setzt bei `cd` z.moegliche. Grund oder null. */
function pruefeSegment({ tokens, op }, z, haupt) {
  const zuweisung = tokens.map((t) => /^([A-Za-z_]\w*)=(.*)$/s.exec(t))
  if (zuweisung.every(Boolean)) {
    for (const [, name, wert] of zuweisung) z.vars[name] = wert || undefined
    return null
  }
  for (let i = 0; i < tokens.length; i++) {
    const p = programmName(tokens[i])
    if (p === 'echo' || p === 'printf') return null
    if (p === 'cd' || p === 'pushd') {
      const ziele = z.moegliche.map((v) => loese(v, mitVariablen(tokens[i + 1], z.vars)) ?? z.start)
      z.moegliche = op === '&&' ? ziele : [...new Set([...z.moegliche, ...ziele])]
      return null
    }
    if ((p === 'gh' || p === 'gh.exe') && tokens[i + 1] === 'pr' && ['checkout', 'co'].includes(tokens[i + 2])) {
      return z.moegliche.some((v) => imHaupt(v, haupt)) ? 'gh pr checkout' : null
    }
    const skript = eingebetteterBefehl(tokens, i)
    if (skript) {
      for (const v of z.moegliche) {
        const grund = pruefeBefehl(skript, v, haupt)
        if (grund) return grund
      }
      return null
    }
    if (p === 'git' || p === 'git.exe') {
      const { wirksam, unter, args } = liesGit(tokens, i, z)
      const ortGrund = unter === 'worktree' ? ORT.worktreeZielGrund(args, wirksam, (v, p) => loese(v, mitVariablen(p, z.vars))) : null
      if (ortGrund) return ortGrund
      const grund = verbotenerUnterbefehl(unter, args)
      return wirksam.some((v) => imHaupt(v, haupt)) ? grund : null
    }
  }
  return null
}

/** Prüft einen Befehl ab Startverzeichnis `cwd`; liefert den Grund oder null. */
function pruefeBefehl(befehl, cwd, haupt = HAUPT) {
  const start = loese(null, cwd)
  const z = { moegliche: [start], start, vars: {} }
  const aussen = []
  for (const seg of zerlege(ohneHeredoc(befehl))) {
    if (seg.auf) aussen.push(z.moegliche)
    else if (seg.zu) z.moegliche = aussen.pop() ?? z.moegliche
    else {
      const grund = pruefeSegment(seg, z, haupt)
      if (grund) return grund
    }
  }
  return null
}

/** Grund der Verweigerung (Text) oder null — Schnittstelle wie die Module des Verteilers. */
function pruefe(eingabe, existiert) {
  if (eingabe.tool_name === 'Write') return ORT.schreibGrund(eingabe, existiert)
  if (eingabe.tool_name !== 'Bash') return null
  const grund = pruefeBefehl(String(eingabe.tool_input?.command ?? ''), eingabe.cwd)
  if (!grund) return null
  if (grund.startsWith('git worktree add außerhalb')) return `„${grund}“ gesperrt. ${ORT.ZIEL_TEXT}`
  return `Hauptordner anime-kalender-de: „${grund}“ gesperrt (dort nur Lesen und git pull --ff-only). Arbeite in einem Worktree: git worktree add C:/code/_worktrees/anime-kalender-de/<thema> -b <zweig> origin/main, danach „cd C:/code/_worktrees/anime-kalender-de/<thema> && …“ mit && (nie mit ;, sonst läuft der Rest im Hauptordner, falls cd scheitert) oder git -C C:/code/_worktrees/anime-kalender-de/<thema> …`
}

module.exports = { pruefe, pruefeBefehl, loese, zerlege, ohneHeredoc, eingebetteterBefehl, programmName }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    try {
      const grund = pruefe(JSON.parse(roh))
      if (grund) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
    } catch (err) {
      process.stderr.write(`hauptordner-sperre: ${err.message}\n`)
    }
    process.exit(0)
  })
}
