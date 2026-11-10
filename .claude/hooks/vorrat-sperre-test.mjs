// Aufruf: node .claude/hooks/vorrat-sperre-test.mjs — Exit 1 bei einem Fehlschlag.
import { createRequire } from 'node:module'
const { pruefe } = createRequire(import.meta.url)('./vorrat-sperre.js')

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } })
const faelle = [
  ['rm direkt', bash('rm vorrat/00-schrift-e.md'), true],
  ['rm nach cd', bash('cd C:/x/daniel-zum-abarbeiten && rm vorrat/00-a-pr26.md && sed -i s/a/b/ stand.md'), true],
  ['mv absolut', bash('mv C:/x/daniel-zum-abarbeiten/vorrat/01-nativ.md C:/x/archiv/'), true],
  ['git rm', bash('git rm daniel-zum-abarbeiten/vorrat/z-1.md'), true],
  ['mit Marke', bash('rm vorrat/00-schrift-e.md # nach-bericht'), false],
  ['Datei anlegen', bash('cat > vorrat/02-x.md <<EOF\nx\nEOF'), false],
  ['ls', bash('ls vorrat'), false],
  ['rm anderswo, vorrat nur gelesen', bash('rm _s.txt; cat vorrat/01.md'), false],
  ['Auftrag ohne Vorab', { tool_name: 'Write', tool_input: { file_path: 'daniel-zum-abarbeiten/vorrat/a-1.md', content: "# x" } }, true],
  ['Auftrag ohne PR-Suche', { tool_name: 'Write', tool_input: { file_path: 'daniel-zum-abarbeiten/vorrat/a-1.md', content: "# x\n\nVorab geprüft: grep → nichts" } }, true],
  ['Auftrag mit PR-Suche', { tool_name: 'Write', tool_input: { file_path: 'daniel-zum-abarbeiten/vorrat/a-1.md', content: "# x\n\nVorab geprüft: grep → nichts; gh pr list --search liegegut → kein PR" } }, false],
  ['anderes Werkzeug', { tool_name: 'Write', tool_input: { file_path: 'vorrat/x.md' } }, false],
]
let rot = 0
for (const [name, eingabe, gesperrt] of faelle) {
  const ist = Boolean(pruefe(eingabe))
  if (ist !== gesperrt) { rot++; console.log(`FEHLER ${name}: erwartet ${gesperrt}, ist ${ist}`) }
}
console.log(rot ? `${rot} von ${faelle.length} rot` : `${faelle.length} Fälle grün`)
process.exit(rot ? 1 : 0)
