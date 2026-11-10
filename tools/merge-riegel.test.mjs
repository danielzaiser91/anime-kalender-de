/**
 * Test für `.claude/hooks/merge-riegel.js` (PreToolUse auf Bash): `gh pr merge <N>` nur nach
 * `node tools/pr-nachrechnen.mjs <N> &&` im selben Befehl; Lesen, Text in echo/Heredoc und merge-reihe.sh bleiben frei.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, '..', '.claude', 'hooks', 'merge-riegel.js')
const { pruefe } = createRequire(import.meta.url)(hook)

const lauf = (command, tool_name = 'Bash') => pruefe({ tool_name, tool_input: { command } })
const gesperrt = (command, n) => {
  const g = lauf(command)
  assert.ok(g, `${command} gesperrt`)
  assert.ok(g.includes(`node tools/pr-nachrechnen.mjs ${n} && t=$(gh pr view ${n} --json title -q .title) && gh pr merge ${n} --squash --subject "$t (#${n})"`), `${command}: erlaubter Befehl wörtlich`)
}
const frei = (command) => assert.equal(lauf(command), null, `${command} frei`)

gesperrt('gh pr merge 3123 --squash', '3123')
gesperrt('gh pr merge 3123 --squash --delete-branch', '3123')
gesperrt('gh pr merge --squash 3123', '3123')
gesperrt('cd /c/x && gh pr merge 5 --squash', '5')
gesperrt('gh -R danielzaiser91/anime-kalender-de pr merge 5 --squash', '5')
gesperrt('gh pr merge 5 --auto --squash', '5')
gesperrt('gh pr merge 5 --squash --repo danielzaiser91/anime-kalender-de', '5') // eigenes Repo hinter dem Unterbefehl
gesperrt('gh pr merge 5 --repo=danielzaiser91/anime-kalender-de', '5')
gesperrt('gh pr merge 5 -R anime-kalender-de', '5')
frei('gh pr merge 4 --repo danielzaiser91/anime-kalender-nativ --squash') // anderes Repo: pr-nachrechnen kennt es nicht
frei('gh -R danielzaiser91/anime-kalender-nativ pr merge 4 --squash')
frei('gh pr merge 4 --repo=danielzaiser91/anime-kalender-delta')
gesperrt('"/c/Program Files/GitHub CLI/gh.exe" pr merge 7 --squash', '7')
gesperrt('node tools/pr-nachrechnen.mjs 4 && gh pr merge 5 --squash', '5') // andere Nummer
gesperrt('node tools/pr-nachrechnen.mjs 5; gh pr merge 5 --squash', '5') // `;`: Exit-Code bremst nicht
gesperrt('node tools/pr-nachrechnen.mjs 5 || gh pr merge 5 --squash', '5')
gesperrt('node tools/pr-nachrechnen.mjs 5 | gh pr merge 5 --squash', '5')
gesperrt('gh pr merge 5 --squash && node tools/pr-nachrechnen.mjs 5', '5') // Riegel muss davor stehen
gesperrt('node tools/pr-nachrechnen.mjs 55 && gh pr merge 5 --squash', '5') // Nummern sind ganze Tokens
gesperrt("bash -c 'gh pr merge 5 --squash'", '5')
gesperrt('node tools/pr-nachrechnen.mjs 5 && bash -c "gh pr merge 9"', '9')
gesperrt('eval "gh pr merge 5"', '5')
gesperrt('echo ok\ngh pr merge 5 --squash', '5')
gesperrt('gh pr merge --squash', 'N') // ohne Nummer (aktueller Zweig)
gesperrt('node tools/pr-nachrechnen.mjs 5 && gh pr merge --squash', 'N')

for (const c of [
  'node tools/pr-nachrechnen.mjs 5 && gh pr merge 5 --squash',
  'node tools/pr-nachrechnen.mjs 3123 && t=$(gh pr view 3123 --json title -q .title) && gh pr merge 3123 --squash --subject "$t (#3123)"',
  'cd /c/x && node tools/pr-nachrechnen.mjs 5 && gh pr merge 5 --squash --delete-branch',
  'node C:/code/x/tools/pr-nachrechnen.mjs 5 && gh pr merge 5 --squash',
  'node tools/pr-nachrechnen.mjs 5 && gh pr view 5 --json title && gh pr merge 5 --squash',
  'node tools/pr-nachrechnen.mjs 5 && node tools/pr-nachrechnen.mjs 6 && gh pr merge 5 --squash && gh pr merge 6 --squash',
  // Lesen und anderes bleibt frei
  'gh pr view 5 --json title',
  'gh pr view 5 --json mergeStateStatus',
  'gh pr list --state open',
  'gh pr checks 5',
  'gh pr comment 5 --body-file x.md',
  'gh pr create --body-file x.md',
  'gh pr update-branch 5',
  'gh run list',
  'git merge origin/main',
  'git log --grep="gh pr merge"',
  // Aufruf über das Reihen-Skript enthält den Text nicht
  'bash C:/code/ai/__assets/tools/merge-reihe.sh 3123 3124',
  // Text: echo/printf und Heredoc
  'echo gh pr merge 5 --squash',
  'echo "gh pr merge 5 --squash"',
  "printf 'gh pr merge 5'",
  'git commit -m "gh pr merge 5 nur nach Nachrechnen"',
  "cat > notiz.md <<'EOF'\ngh pr merge 5 --squash\nEOF",
  'cat <<EOF\ngh pr merge 5\nEOF',
  '',
]) {
  frei(c)
}
assert.equal(lauf('gh pr merge 5', 'Write'), null, 'Write frei')
assert.equal(pruefe({ tool_name: 'Bash' }), null, 'ohne tool_input frei')

// Prozess: Verweigerung als JSON auf stdout, Exit 0; freier Befehl und kaputte Eingabe ohne Ausgabe bzw. mit Fehlerzeile.
const prozess = (roh) => spawnSync(process.execPath, [hook], { input: roh, encoding: 'utf8', timeout: 20000 })
const rot = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'gh pr merge 5 --squash' } }))
assert.equal(rot.status, 0)
assert.equal(JSON.parse(rot.stdout).hookSpecificOutput.permissionDecision, 'deny')
const gruen = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'node tools/pr-nachrechnen.mjs 5 && gh pr merge 5 --squash' } }))
assert.equal(gruen.status, 0)
assert.equal(gruen.stdout, '')
const kaputt = prozess('{')
assert.equal(kaputt.status, 0)
assert.match(kaputt.stderr, /^merge-riegel: /)

console.log('merge-riegel.test: ok (ohne Riegel, andere Nummer, ;/||/|, Riegel danach, bash -c, eval, ohne Nummer; frei: Riegel &&, view/list, echo, Heredoc, merge-reihe.sh, Prozess)')
