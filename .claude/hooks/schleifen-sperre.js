// PreToolUse (Bash): blockiert Wartschleifen (until/while ... do) ohne Grenze. Anlass 10.10.2026: vier bash-Schleifen
// `until grep -q Marke log; do sleep 5; done` liefen Stunden bei ~50 % eines Kerns. Skill: hintergrundprozesse.
// Zusätzlich: `python -` (Stdin-Skript) ohne `timeout`.
// Erlaubt: `timeout <s>` im Befehl, ein Zähler (((...)), let, i++, -lt/-le/-gt/-ge, seq) oder `while read` (Eingabe endet).
// Ausgabe wie guard.js: permissionDecision "deny"; ohne Ausgabe läuft der normale Weg weiter.

const SCHLEIFE = /(^|[;&|('"\s])(until|while)\b[^\n]*?;\s*do\b|(^|[;&|('"\s])(until|while)\b[^\n]*\n\s*do\b/
// `((` zählt nur als Zähler (`((i++))`, `for ((…))`), nicht als `$((…))`-Rechnung irgendwo im Befehl (Lücke 10.10.2026).
const BEGRENZT = [/\btimeout\s+\d/, /(^|[^$])\(\(/, /\blet\s/, /\+\+|\+=\s*1/, /\s-(lt|le|gt|ge)\s/, /\bseq\b/, /\b(until|while)\s+(IFS=\S*\s+)?read\b/]

// `python -` liest das Skript von Stdin; bei kaputtem Heredoc dreht es sich im Leerlauf (Anlass 10.10.2026, 1 Kern dauerhaft).
const STDIN_PYTHON = /(^|[;&|('"\s/])python[\d.]*(\.exe)?\s+(-[A-Za-z]\s+)*-(\s|$)/
const GRUND_PYTHON =
  '`python -` (Skript über Stdin/Heredoc) ohne `timeout` gesperrt: Bei kaputtem Heredoc blockiert es endlos und frisst einen Kern (10.10.2026). ' +
  'Stattdessen `timeout 60 python - …` oder das Skript als Datei im Scratchpad ausführen. Skill hintergrundprozesse.'

const GRUND =
  'Wartschleife (until/while ... do) ohne Grenze gesperrt: Sie läuft bei Marke, die nie kommt, stundenlang und frisst CPU (10.10.2026). ' +
  'Stattdessen: ScheduleWakeup, Monitor mit Grenze, `timeout <s> bash -c "…"` oder `node C:/code/ai/__assets/tools/prozess-register.mjs start --zweck … --agent … --frist-min <N> -- <Befehl>`. ' +
  'Zähler (`for i in $(seq 1 60)`) oder `timeout` im Befehl erlaubt die Schleife. Skill hintergrundprozesse.'

function pruefe(eingabe) {
  if (eingabe.tool_name !== 'Bash') return null
  const cmd = String((eingabe.tool_input || {}).command || '')
  if (STDIN_PYTHON.test(cmd) && !BEGRENZT[0].test(cmd)) return GRUND_PYTHON
  if (!SCHLEIFE.test(cmd)) return null
  return BEGRENZT.some((r) => r.test(cmd)) ? null : GRUND
}

module.exports = { pruefe }

if (require.main === module) {
  let roh = ''
  process.stdin.on('data', (d) => (roh += d))
  process.stdin.on('end', () => {
    try {
      const grund = pruefe(JSON.parse(roh))
      if (grund) {
        process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
      }
    } catch {
      // Ein Fehler im Wächter darf nie die Arbeit blockieren.
    }
  })
}
