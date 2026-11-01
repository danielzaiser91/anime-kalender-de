/**
 * Test für `tools/claude-global/hooks/no-verify-sperre.js` (PreToolUse auf Bash): `git commit`/`git push` mit `--no-verify`
 * (bei commit auch `-n`) wird abgewiesen, Lesen, Text in Nachrichten und Heredocs bleiben frei.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'no-verify-sperre.js')
const { pruefe } = createRequire(import.meta.url)(hook)

const lauf = (command, tool_name = 'Bash') => pruefe({ tool_name, tool_input: { command } })
const gesperrt = (command) => assert.match(lauf(command), /^„git (commit|push) mit (--no-verify|core\.hooksPath)“ gesperrt/, `${command} gesperrt`)
const frei = (command) => assert.equal(lauf(command), null, `${command} frei`)

for (const c of [
  'git commit --no-verify -m x',
  'git commit -m x --no-verify',
  'git commit -nm x',
  'git commit -n -m x',
  'git commit -anm x',
  'git push --no-verify',
  'git push origin main --no-verify',
  'git push --no-verif',
  'git -C /c/x push --no-verify',
  'git -c core.x=1 -C /c/x commit --no-verify -m x',
  '"/c/Program Files/Git/cmd/git.exe" commit --no-verify -m x',
  "bash -c 'git commit --no-verify'",
  'bash -lc "cd /c/x && git push --no-verify"',
  'eval "git commit -n -m x"',
  'git status && git add a && git commit --no-verify -m x && git push',
  'git add a; git commit -n -m x',
  'echo ok | git commit -F - --no-verify',
  'git commit -m "$(git log -1 --format=%s)" --no-verify',
  'git commit -m "x" -- a.txt && git push --no-verify',
  'timeout 20 git push --no-verify',
  // A1: Zeilenfortsetzung trennt den Befehl nicht
  'git commit -m x \\\n  --no-verify',
  'git commit \\\n-m x \\\n-n',
  'git push \\\r\n--no-verify',
  'git commit -m "a \\\nb" --no-verify',
  // A2: Hook-Verzeichnis umbiegen
  'git -c core.hooksPath=/dev/null commit -m x',
  'git -c core.hookspath=/dev/null push',
  'git -C /c/x -c core.hooksPath=/nix commit -m x',
  'git --config-env=core.hooksPath=LEER commit -m x',
  'git --config-env core.hooksPath=LEER push',
  "bash -c 'git -c core.hooksPath=/dev/null commit -m x'",
]) {
  gesperrt(c)
}

for (const c of [
  'git log -n 5',
  'git log --no-verify',
  'git commit -m "kein --no-verify"',
  'git commit -m "-n"',
  'git commit -m -n',
  'git commit -mn',
  "git commit -m 'fix: --no-verify nicht nutzen'",
  'git commit -F datei.txt',
  'git commit -C HEAD',
  'git commit --message=--no-verify',
  'git push',
  'git push -n',
  'git commit --message --no-verify',
  'git commit -m x -- a.txt --no-verify',
  'git push --dry-run origin main',
  'git status',
  'git diff -n',
  'git -c core.hooksPath=/dev/null status',
  'git -c core.autocrlf=false commit -m x',
  'git commit -m "core.hooksPath"',
  'git -c user.name=hooksPath commit -m x',
  'git config core.hooksPath',
  'git commit -m x \\\n  -a',
  'echo git commit --no-verify',
  "printf 'git push --no-verify'",
  'git commit -m x\ncat > f <<EOF\ngit commit --no-verify\nEOF',
  "bash -c 'git commit -m x'",
  'npm run check',
  '',
]) {
  frei(c)
}
assert.equal(lauf('git commit --no-verify -m x', 'Write'), null, 'Write frei')
assert.equal(pruefe({ tool_name: 'Bash' }), null, 'ohne tool_input frei')

// Prozess: Verweigerung als JSON auf stdout, Exit 0; freier Befehl und kaputte Eingabe ohne Ausgabe bzw. mit Fehlerzeile.
const prozess = (roh) => spawnSync(process.execPath, [hook], { input: roh, encoding: 'utf8', timeout: 20000 })
const rot = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push --no-verify' } }))
assert.equal(rot.status, 0)
assert.equal(JSON.parse(rot.stdout).hookSpecificOutput.permissionDecision, 'deny')
const gruen = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } }))
assert.equal(gruen.status, 0)
assert.equal(gruen.stdout, '')
const kaputt = prozess('{')
assert.equal(kaputt.status, 0)
assert.match(kaputt.stderr, /^no-verify-sperre: /)

console.log('no-verify-sperre.test: ok (commit/push, -n, Bündel, -C, bash -c, eval, Ketten, Abkürzung, Zeilenfortsetzung, core.hooksPath; frei: log -n, Nachrichtentext, Heredoc, echo, Prozess)')
