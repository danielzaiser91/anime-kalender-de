// PreToolUse(Bash): `git commit`/`git push` mit `--no-verify` (bei `commit` auch `-n`) wird abgewiesen — überall, auch in Worktrees.
// Anlass: Die Regel „nie --no-verify“ stand nur als Vorsatz im Bauer-Auftrag und wurde zweimal gebrochen (30.10. und 01.11.2026).
// Der Befehl wird mit dem Zerleger aus hauptordner-sperre.js in Segmente geteilt (Heredocs weg, Ketten, Klammern, `bash -c`/`eval`
// rekursiv); Text in `-m "… --no-verify …"` ist ein Token-Wert und zählt nicht. `echo`/`printf` sind ausgenommen.
// Gesperrt ist auch `-c core.hooksPath=…`/`--config-env core.hooksPath=…` vor commit/push (biegt die Hooks um).
// Bekannte Grenzen (nicht allgemein lösbar): Git-Alias (`git config alias.x …`), Programm aus Variable (`$g commit`),
// `--no-verify` aus `$(echo …)`/Backticks, `git config core.hooksPath` als eigener Vorlauf, Umgebung `GIT_CONFIG_*`.
// Einbindung in ~/.claude/hooks/dispatch-pretooluse.js ins Feld PRUEFER (macht der Dirigent über einrichten.mjs):
//   ['no-verify-sperre.js', (i) => { const g = require(path.join(H, 'no-verify-sperre.js')).pruefe(i); return g ? { permissionDecision: 'deny', permissionDecisionReason: g } : null }],
const { zerlege, ohneHeredoc, eingebetteterBefehl, programmName } = require('./hauptordner-sperre.js')

/** Globale Git-Optionen mit eigenem Wert (`git -C pfad …`). */
const MIT_WERT = new Set(['-C', '-c', '--config-env', '--git-dir', '--work-tree', '--namespace', '--exec-path'])
/** `-c core.hooksPath=…` bzw. `--config-env[=| ]core.hooksPath=…` biegt das Hook-Verzeichnis um und wirkt wie `--no-verify`. */
const HOOKS_PFAD = /^core\.hookspath=/i
/** Kurze `commit`-Optionen, die den Rest des Bündels bzw. das nächste Token als Wert nehmen. */
const KURZ_MIT_WERT = new Set(['m', 'F', 'C', 'c', 't'])
/** Lange `commit`-Optionen mit Wert im nächsten Token. */
const LANG_MIT_WERT = new Set(['--message', '--file', '--reuse-message', '--reedit-message', '--template', '--author', '--date', '--fixup', '--squash'])

const istNoVerify = (a) => a.length >= 6 && a.startsWith('--no-v') && '--no-verify'.startsWith(a)

/** Trifft eines der Argumente `--no-verify` (bei commit auch `-n`, auch im Bündel wie `-nm`)? Optionswerte werden übersprungen. */
function hatNoVerify(unter, args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--') return false
    if (istNoVerify(a)) return true
    if (LANG_MIT_WERT.has(a)) i++
    else if (unter === 'commit' && /^-[A-Za-z]+$/.test(a)) {
      for (const [k, z] of [...a.slice(1)].entries()) {
        if (z === 'n') return true
        if (KURZ_MIT_WERT.has(z)) {
          if (k === a.length - 2) i++
          break
        }
      }
    }
  }
  return false
}

/** Unterbefehl, Argumente und ob die globalen Optionen das Hook-Verzeichnis umbiegen, ab dem `git`-Token `von`. */
function liesGit(tokens, von) {
  let i = von + 1
  let hooksPfad = false
  for (; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.startsWith('--config-env=') && HOOKS_PFAD.test(t.slice(13))) hooksPfad = true
    if ((t === '-c' || t === '--config-env') && HOOKS_PFAD.test(tokens[i + 1] ?? '')) hooksPfad = true
    if (MIT_WERT.has(t)) i++
    else if (!t.startsWith('-')) break
  }
  return { unter: tokens[i], args: tokens.slice(i + 1), hooksPfad }
}

/** Befehl mit `$(…)` und `` `…` `` durch `X` ersetzt: Der Zerleger schneidet sonst ein `--no-verify` hinter einer Ersetzung vom `git commit` ab. */
function ohneErsetzung(befehl) {
  let tiefe = 0
  let backtick = false
  let aus = ''
  for (let i = 0; i < befehl.length; i++) {
    const c = befehl[i]
    if (c === '$' && befehl[i + 1] === '(') {
      if (tiefe++ === 0) aus += 'X'
      i++
    } else if (tiefe > 0) {
      if (c === '(') tiefe++
      else if (c === ')') tiefe--
    } else if (c === '`') {
      if (!backtick) aus += 'X'
      backtick = !backtick
    } else if (!backtick) aus += c
  }
  return aus
}

/** Grund (Text) für einen Befehl oder null; Ersetzungen werden einmal als eigene Segmente und einmal als Platzhalter geprüft. */
function pruefeBefehl(befehl) {
  const roh = pruefeSegmente(befehl)
  return roh ?? pruefeSegmente(ohneErsetzung(befehl))
}

function pruefeSegmente(befehl) {
  for (const { tokens } of zerlege(ohneHeredoc(befehl))) {
    if (!tokens) continue
    for (let i = 0; i < tokens.length; i++) {
      const p = programmName(tokens[i])
      if (p === 'echo' || p === 'printf') break
      const skript = eingebetteterBefehl(tokens, i)
      if (skript) {
        const grund = pruefeBefehl(skript)
        if (grund) return grund
      } else if (p === 'git' || p === 'git.exe') {
        const { unter, args, hooksPfad } = liesGit(tokens, i)
        const hook = unter === 'commit' || unter === 'push'
        if (hook && hooksPfad) return `git ${unter} mit core.hooksPath`
        if (hook && hatNoVerify(unter, args)) return `git ${unter} mit --no-verify`
      }
    }
  }
  return null
}

/** Grund der Verweigerung (Text) oder null — Schnittstelle wie die Module des Verteilers. */
function pruefe(eingabe) {
  if (eingabe.tool_name !== 'Bash') return null
  const grund = pruefeBefehl(String(eingabe.tool_input?.command ?? ''))
  if (!grund) return null
  return `„${grund}“ gesperrt: die Hooks (Umfang, Tests) sind Pflicht. Schlägt der Hook fehl, den Fehler beheben statt umgehen; ein Zwischenstand geht mit einem normalen Commit, sobald der Hook grün ist.`
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
      process.stderr.write(`no-verify-sperre: ${err.message}\n`)
    }
    process.exit(0)
  })
}
