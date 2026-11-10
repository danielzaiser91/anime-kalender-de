// Test für schleifen-sperre.js: node .claude/hooks/schleifen-sperre-test.mjs
import { createRequire } from 'node:module'
const { pruefe } = createRequire(import.meta.url)('./schleifen-sperre.js')

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } })
const FAELLE = [
  ['until grep ohne Grenze', bash("eval 'until grep -q \"FERTIG\" /tmp/x.log; do sleep 5; done'"), true],
  ['while true ohne Grenze', bash('while true; do sleep 2; done'), true],
  ['until mehrzeilig', bash('until test -f x\ndo\n  sleep 1\ndone'), true],
  ['until mit timeout', bash('timeout 120 bash -c \'until test -f x; do sleep 1; done\''), false],
  ['Schleife mit Zähler', bash('i=0; while [ $i -lt 60 ]; do i=$((i+1)); sleep 1; done'), false],
  ['until grep mit $((…)) irgendwo (Lücke 10.10.)', bash('until grep -q "^exit" /tmp/bv.log; do sleep 20; done; echo $(( $(date +%s) - 5 ))'), true],
  ['$((…)) allein ist kein Zähler', bash('while true; do x=$((x+1)); sleep 1; done'), true],
  ['((i++)) bleibt Zähler', bash('i=0; while true; do ((i++)); [ $i -gt 5 ] && break; sleep 1; done'), false],
  ['for ((…)) ist begrenzt', bash('for ((i=0;i<30;i++)); do test -f x && break; sleep 1; done; until test -f y; do sleep 1; done'), false],
  ['for mit seq', bash('for i in $(seq 1 30); do test -f x && break; sleep 1; done'), false],
  ['while read', bash('while read -r l; do echo "$l"; done < datei.txt'), false],
  ['normaler Befehl', bash('git status && echo until later'), false],
  ['python - Heredoc ohne timeout', bash("cd x; python - <<'X' 2>/dev/null || node -e 1\nprint(1)\nX"), true],
  ['python - ohne Heredoc', bash('python -'), true],
  ['python.exe - ohne timeout', bash('C:/Python314/python.exe -'), true],
  ['python - mit timeout', bash("timeout 60 python - <<'X'\nprint(1)\nX"), false],
  ['python -c', bash('python -c "print(1)"'), false],
  ['python Datei', bash('python tool.py --x - y'), false],
  ['python -m', bash('python -m http.server'), false],
  ['anderes Werkzeug', { tool_name: 'Edit', tool_input: { command: 'while true; do :; done' } }, false],
]

let fehler = 0
for (const [name, eingabe, soll] of FAELLE) {
  const ist = pruefe(eingabe) !== null
  if (ist !== soll) fehler++
  console.log(`${ist === soll ? 'ok  ' : 'FEHLER'} ${name} (gesperrt: ${ist}, erwartet: ${soll})`)
}
process.exit(fehler ? 1 : 0)
