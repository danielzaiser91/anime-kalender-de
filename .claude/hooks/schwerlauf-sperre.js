// PreToolUse(Bash): Vollläufe der Prüfkette (`check-logic-alle`, `tests-alle`, `npm run check:vor-commit|check:logic|check:logic-1|check:logic-2|check:tests-1|check:tests-2|
// check:bestand|check:bestand-liste`) werden abgewiesen, wenn sie direkt starten. Erlaubt bleibt derselbe Lauf hinter `node tools/schwer.mjs …`
// (eine Schlange, `tools/schwerer-lauf.mjs`). Anlass (15.11.2026, 20:19): ein Bauer startete `node tools/check-logic-alle.mjs` im Hintergrund,
// ~20 Node/esbuild-Prozesse, 3,2 GB RAM; die Regel F40 (bauer.md) stand nur als Vorsatz da.
// Geprüft wird je Segment (Zerleger aus hauptordner-sperre.js): vorn nur Zuweisungen und Vorsatzwörter (`PATH=… npm`, `timeout 60 node`, `time`),
// dann das Programm; Text in Argumenten (`grep`, `echo`, `-m "…"`) zählt nicht. `bash -c`/`eval` rekursiv. Wirkt nur lokal: CI führt keine Hooks aus.
// Bekannte Grenzen wie bei no-verify-sperre.js: Programm aus Variable, Alias, Skript, das den Vollauf selbst startet.
const { zerlege, ohneHeredoc, eingebetteterBefehl, programmName } = require('./hauptordner-sperre.js')

const SKRIPTE = new Set(['check-logic-alle', 'tests-alle'])
const NPM_ZIELE = new Set(['check:vor-commit', 'check:logic', 'check:logic-1', 'check:logic-2', 'check:tests-1', 'check:tests-2', 'check:bestand', 'check:bestand-liste'])
const VORSATZ = new Set(['env', 'nohup', 'time', 'command', 'exec', 'nice', 'timeout'])
/** Node-/npx-Optionen, die das nächste Token als Wert nehmen. */
const MIT_WERT = new Set(['--require', '-r', '--import', '-p', '--package'])

const name = (t) => programmName(t).replace(/\.(cmd|exe|ps1)$/, '')
const ohneEndung = (t) => programmName(t).replace(/\.(mjs|js|ts)$/, '')
const istVorsatz = (t) => /^\w+=/.test(t) || VORSATZ.has(name(t)) || t.startsWith('-') || /^\d+[smhd]?$/.test(t)

/** Positionsargumente (ohne Optionen und deren Werte). */
function positionsArgumente(args) {
  const frei = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (MIT_WERT.has(a)) i++
    else if (!a.startsWith('-')) frei.push(a)
  }
  return frei
}

/** `node|tsx|npx [tsx|node] <skript>`: ist das Skript ein Volllauf? */
function laeuftSkript(args) {
  const [erstes, zweites] = positionsArgumente(args)
  const ziel = ['tsx', 'node'].includes(name(erstes ?? '')) ? zweites : erstes
  return !!ziel && SKRIPTE.has(ohneEndung(ziel))
}

/** `npm|pnpm|yarn|bun [run|run-script] <ziel>`: ist das Ziel ein Volllauf? */
function laeuftNpmZiel(args) {
  const frei = positionsArgumente(args)
  const ziel = ['run', 'run-script'].includes(frei[0]) ? frei[1] : frei[0]
  return NPM_ZIELE.has(ziel)
}

const RUNNER = new Set(['node', 'tsx', 'npx'])
const PAKET = new Set(['npm', 'pnpm', 'yarn', 'bun'])

/** `node tools/schwer.mjs …`: startet das Segment die Schlange selbst? */
const startetSchwer = (args) => ohneEndung(positionsArgumente(args)[0] ?? '') === 'schwer'

function pruefeSegment(tokens, hintergrund) {
  let i = 0
  while (i < tokens.length && istVorsatz(tokens[i])) i++
  if (i >= tokens.length) return null
  const skript = eingebetteterBefehl(tokens, i)
  if (skript) return pruefeBefehl(skript, hintergrund)
  const p = name(tokens[i])
  const args = tokens.slice(i + 1)
  if (hintergrund && p === 'node' && startetSchwer(args)) return { lauf: tokens.slice(i, i + 3).join(' '), schwer: true }
  if (RUNNER.has(p) && laeuftSkript(args)) return { lauf: tokens.slice(i, i + 4).join(' ') }
  if (PAKET.has(p) && laeuftNpmZiel(args)) return { lauf: tokens.slice(i, i + 3).join(' ') }
  return null
}

/** Fund { lauf, schwer? } (Volllauf bzw. Schlange im Hintergrund) oder null. */
function pruefeBefehl(befehl, hintergrund = false) {
  for (const { tokens } of zerlege(ohneHeredoc(befehl))) {
    if (!tokens) continue
    const treffer = pruefeSegment(tokens, hintergrund)
    if (treffer) return treffer
  }
  return null
}

/** Grund der Verweigerung (Text) oder null — Schnittstelle wie die Module des Verteilers. */
function pruefe(eingabe) {
  if (eingabe.tool_name !== 'Bash') return null
  const fund = pruefeBefehl(String(eingabe.tool_input?.command ?? ''), eingabe.tool_input?.run_in_background === true)
  if (!fund) return null
  if (fund.schwer) return `„${fund.lauf}“ im Hintergrund gesperrt: schwere Läufe nur im Vordergrund (ein Lauf zugleich, Daniels Rechner bleibt benutzbar). Ohne run_in_background starten, mit timeout unter 270 s.`
  const lauf = fund.lauf
  return `„${lauf}“ gesperrt: Vollläufe der Prüfkette laufen in der PR-Kette, nicht auf Daniels Rechner (F40; 15.11.2026: ~20 Prozesse, 3,2 GB RAM). Lokal nur berührte Tests (npx tsx <test>) und npx tsc --noEmit -p .; muss es sein, dann ohne run_in_background als: node tools/schwer.mjs <derselbe Befehl>.`
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
      process.stderr.write(`schwerlauf-sperre: ${err.message}\n`)
    }
    process.exit(0)
  })
}
