/**
 * Test für `.claude/hooks/cd-unterordner-sperre.js`: in der Hauptsitzung kein `cd` in einen Unterordner des Hauptordners
 * außerhalb einer Subshell. Eingaben wie der Hook sie bekommt (JSON auf stdin, Prozess), Subagenten tragen agent_id/agent_type.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const hook = join(import.meta.dirname, '..', '.claude', 'hooks', 'hauptordner-sperre.js')
const HAUPT = 'C:/code/ai/anime-kalender-de'
const WT = 'C:/code/_worktrees/anime-kalender-de/x'

function lauf(command, cwd = HAUPT, extra = {}) {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command }, ...extra }), encoding: 'utf8', timeout: 20000 })
  assert.equal(r.status, 0, `Exit 0: ${r.stderr}`)
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null
}
const gesperrt = (c, cwd, was) => {
  const o = lauf(c, cwd)
  assert.equal(o?.permissionDecision, 'deny', `${was ?? c} gesperrt`)
  assert.match(o.permissionDecisionReason, /Subshell/, 'Meldung nennt den sicheren Weg')
}
const frei = (c, cwd, was, extra) => assert.equal(lauf(c, cwd, extra), null, `${was ?? c} frei`)

gesperrt(`cd /c/code/ai/anime-kalender-de/daniel-zum-abarbeiten && sed -n 1p stand.md`, HAUPT, 'Git-Bash-Pfad mit &&')
gesperrt('cd C:/code/ai/anime-kalender-de/tools; ls', HAUPT, 'Windows-Pfad mit ;')
gesperrt('cd daniel-zum-abarbeiten && ls', HAUPT, 'relativ bei cwd = Hauptordner')
gesperrt('cd C:\\code\\ai\\anime-kalender-de\\tools && ls', HAUPT, 'Backslashes')
gesperrt('cd C:/CODE/AI/Anime-Kalender-DE/tools && ls', HAUPT, 'Groß-/Kleinschreibung')
gesperrt('pushd tools && ls', HAUPT, 'pushd')
gesperrt('builtin cd tools && ls', HAUPT, 'builtin cd')
frei('cd .claude/worktrees/noch-nicht-da-xyz && ls', HAUPT, 'noch nicht angelegter Arbeitsbaum unter .claude/worktrees')
gesperrt('cd -P tools && ls', HAUPT, 'cd mit Option')
gesperrt('cd tools && cd ../pipeline && ls', HAUPT, 'zweites cd relativ zum ersten')
gesperrt('ls; cd tools', HAUPT, 'cd am Ende')
gesperrt('cd "C:/code/ai/anime-kalender-de/tools" && ls', HAUPT, 'in Anführungszeichen')
gesperrt('cd tools && ls', 'C:/code/ai/anime-kalender-de/docs', 'cwd selbst im Unterordner: tools liegt dort darunter')
gesperrt('echo x\ncd tools', HAUPT, 'in zweiter Zeile')
gesperrt('(cd tools && ls); cd pipeline', HAUPT, 'Subshell davor, cd danach außerhalb')

frei('cd /c/code/ai/anime-kalender-de && ls', HAUPT, 'Hauptordner selbst')
frei(`cd ${WT} && ls`, HAUPT, 'Worktree')
frei('cd C:/code/_worktrees/anime-kalender-de/x/tools && ls', HAUPT, 'Unterordner im Worktree')
frei('( cd tools && ls )', HAUPT, 'Subshell')
frei('(cd C:/code/ai/anime-kalender-de/tools && ls)', HAUPT, 'Subshell absolut')
frei('x=$(cd tools && pwd); echo $x', HAUPT, 'Befehlsersetzung')
frei('git -C C:/code/ai/anime-kalender-de/tools status', HAUPT, 'git -C')
frei('ls tools && sed -n 1p daniel-zum-abarbeiten/stand.md', HAUPT, 'kein cd')
frei('echo cd tools', HAUPT, 'cd nur als Text')
frei('cd $X && ls', HAUPT, 'nicht bestimmbar')
frei('cd ~ && ls', HAUPT, 'Home')
frei('cd - && ls', HAUPT, 'cd -')
frei('cd', HAUPT, 'cd ohne Ziel')
frei('cd .. && ls', 'C:/code/ai/anime-kalender-de/tools', 'aus Unterordner zurück zum Hauptordner')
frei('cd tools && ls', 'C:/code/_worktrees/anime-kalender-de/x', 'cwd im Worktree, relatives Ziel dort')
frei('cd tools && ls', 'C:/tmp', 'cwd anderswo')
frei('cd C:/code/ai/anime-kalender-de-anderes/tools && ls', HAUPT, 'Nachbarordner mit gleichem Präfix')

// Subagenten bleiben frei.
frei('cd /c/code/ai/anime-kalender-de/tools && ls', HAUPT, 'Subagent (agent_id, agent_type)', { agent_id: 'a1', agent_type: 'bauer' })
frei('cd tools && ls', HAUPT, 'Subagent nur agent_id', { agent_id: 'a1' })
frei('cd tools && ls', HAUPT, 'Subagent nur agent_type', { agent_type: 'general-purpose' })

// Anderes Werkzeug bleibt unberührt.
const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: 'Read', cwd: HAUPT, tool_input: { command: 'cd tools' } }), encoding: 'utf8', timeout: 20000 })
assert.equal(r.status, 0)
assert.equal(r.stdout, '', 'Read ungeprüft')

// Git-Sperre hat Vorrang vor der cd-Meldung (bestehende Meldung bleibt).
assert.match(lauf('cd tools && git commit -m x').permissionDecisionReason, /^Hauptordner anime-kalender-de: „/)

console.log('cd-unterordner-sperre.test: ok (Hauptsitzung gesperrt: absolut/relativ/pushd/Kette; frei: Hauptordner, Worktree, Subshell, git -C, Subagent)')
