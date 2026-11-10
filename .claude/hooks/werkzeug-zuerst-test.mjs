import { createRequire } from 'node:module'
const { pruefe } = createRequire(import.meta.url)('./werkzeug-zuerst.js')
const b = (command) => pruefe({ tool_name: 'Bash', tool_input: { command } })
const faelle = [
  ['grep -rl laufstatus /c/code/ai', true],
  ['find "C:/code/ai" -name "*.html"', true],
  ['rg -l lauf C:\\code\\ai\\', true],
  ['grep -rn x /c/code/ai/anime-kalender-de/worker', false],
  ['grep -n -i lauf "C:/code/ai/ai helper files/ai_agent_tools.md"', false],
  ['find /c/code/ai -name x # werkzeugkasten-gelesen', false],
  ['ls /c/code/ai', false],
  ['cat /c/code/ai/CLAUDE.md', false],
]
let fehler = 0
for (const [c, soll] of faelle) { const ist = !!b(c); if (ist !== soll) { fehler++; console.log('FALSCH', soll, c) } }
console.log(fehler ? `${fehler} Fehler` : `alle ${faelle.length} Fälle ok`)
process.exit(fehler ? 1 : 0)
