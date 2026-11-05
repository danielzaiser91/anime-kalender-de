/**
 * Test für `tools/claude-global/hooks/subagent-schreibsperre.js`: Subagenten (Hook-Eingabe mit agent_id) schreiben nicht im Hauptordner.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { pruefe } = require(join(import.meta.dirname, 'claude-global', 'hooks', 'subagent-schreibsperre.js'))

const HAUPT = 'C:/code/ai/anime-kalender-de'
const WT = 'C:/code/_worktrees/anime-kalender-de/thema'
const sub = (tool_name, file_path, cwd = HAUPT) => ({ tool_name, cwd, agent_id: 'agent123', agent_type: 'bauer', tool_input: { file_path } })
const haupt = (tool_name, file_path, cwd = HAUPT) => ({ tool_name, cwd, tool_input: { file_path } })

for (const werkzeug of ['Write', 'Edit', 'MultiEdit']) {
  assert.match(pruefe(sub(werkzeug, `${HAUPT}/pipeline/x.ts`)) ?? '', /Hauptordner gesperrt.*git worktree add C:\/code\/_worktrees\/anime-kalender-de\/<thema>/, `${werkzeug} im Hauptordner`)
}
assert.match(pruefe({ ...sub('NotebookEdit', ''), tool_input: { notebook_path: `${HAUPT}/a.ipynb` } }) ?? '', /gesperrt/, 'Notebook')
assert.match(pruefe(sub('Write', 'C:\\Code\\AI\\Anime-Kalender-DE\\tools\\x.mjs')) ?? '', /gesperrt/, 'Backslash und Großschreibung')
assert.match(pruefe(sub('Write', '/c/code/ai/anime-kalender-de/x.md')) ?? '', /gesperrt/, 'Git-Bash-Pfad')
assert.match(pruefe(sub('Write', 'tools/x.mjs')) ?? '', /gesperrt/, 'relativ im Hauptordner')
assert.match(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/vorrat/x.md`)) ?? '', /gesperrt/, 'vorrat gehört dem Dirigenten')
assert.match(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/berichte/../stand.md`)) ?? '', /gesperrt/, '.. aus berichte/ heraus')
assert.match(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/berichte-x/a.md`)) ?? '', /gesperrt/, 'Nachbarordner mit gleichem Präfix')

assert.match(pruefe(sub('Write', HAUPT)) ?? '', /gesperrt/, 'genau der Hauptordnerpfad')
assert.match(pruefe(sub('Write', '/c/code/ai/anime-kalender-de/x.md', WT)) ?? '', /gesperrt/, 'Git-Bash-Pfad, cwd im Worktree')
assert.match(pruefe(sub('Write', '//?/C:/code/ai/anime-kalender-de/x.md', WT)) ?? '', /gesperrt/, 'UNC-Langform')
assert.match(pruefe(sub('Write', '/cygdrive/c/code/ai/anime-kalender-de/x.md', WT)) ?? '', /gesperrt/, 'cygdrive')
for (const typ of ['bauer', 'pruefer', 'analyst']) {
  assert.match(pruefe({ ...sub('Write', `${HAUPT}/x.md`), agent_type: typ }) ?? '', /gesperrt/, `Typ ${typ}`)
}
for (const typ of ['general-purpose', 'claude', 'claude-code-guide', '', undefined]) {
  assert.equal(pruefe({ ...sub('Write', `${HAUPT}/x.md`), agent_type: typ }), null, `Typ ${typ} frei`)
}
assert.equal(pruefe({ tool_name: 'Write', agent_id: 'a1', agent_type: 'bauer', tool_input: {} }), null, 'Subagent ohne Pfad und ohne cwd')
assert.equal(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/mockups/a.html`)), null, 'daniel-zum-abarbeiten/mockups/ frei')
assert.match(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/mockups-x/a.html`)) ?? '', /gesperrt/, 'mockups-x gesperrt')
assert.equal(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/listen/a.md`)), null, 'listen/ frei')
assert.match(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/listen-x/a.md`)) ?? '', /gesperrt/, 'listen-x gesperrt')
assert.equal(pruefe(sub('Write', `${WT}/pipeline/x.ts`)), null, 'Worktree frei')
assert.equal(pruefe(sub('Edit', `${WT}/x.ts`, WT)), null, 'Worktree, cwd im Worktree')
assert.equal(pruefe(sub('Write', 'pipeline/x.ts', WT)), null, 'relativ im Worktree')
assert.equal(pruefe(sub('Write', `${HAUPT}/daniel-zum-abarbeiten/berichte/a.md`)), null, 'berichte/ frei')
assert.equal(pruefe(sub('Write', 'C:/code/ai/anime-kalender-de-x/a.md')), null, 'Nachbar mit gleichem Namenspräfix')
assert.equal(pruefe(sub('Write', 'C:/code/ai/andere/a.md')), null, 'anderes Projekt (nicht Aufgabe dieses Hooks)')
assert.equal(pruefe(sub('Read', `${HAUPT}/x.ts`)), null, 'Lesen frei')
assert.equal(pruefe(haupt('Write', `${HAUPT}/daniel-zum-abarbeiten/stand.md`)), null, 'Hauptsitzung frei')
assert.equal(pruefe(haupt('Edit', `${HAUPT}/tools/x.mjs`)), null, 'Hauptsitzung Edit frei')
assert.equal(pruefe({ tool_name: 'Write', tool_input: {} }), null, 'ohne Pfad')

console.log('subagent-schreibsperre: Fälle grün')
