/**
 * Test für `.claude/hooks/fetch-depth-sperre.js` (PreToolUse auf Bash): `git fetch|pull|clone` mit `--depth` & Co. im Repo
 * anime-kalender-de oder seinen Worktrees wird abgewiesen; Wegwerf-Repos und normale Fetches bleiben frei.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, '..', '.claude', 'hooks', 'fetch-depth-sperre.js')
const { pruefe } = createRequire(import.meta.url)(hook)

const HAUPT = 'C:/code/ai/anime-kalender-de'
const WT = 'C:/code/_worktrees/anime-kalender-de/thema'
const TMP = 'C:/Users/ih/AppData/Local/Temp/probe'

const lauf = (command, cwd = HAUPT, tool_name = 'Bash') => pruefe({ tool_name, tool_input: { command }, cwd })
const gesperrt = (command, cwd) => assert.match(lauf(command, cwd) ?? '', /^„git (fetch|pull|clone) --depth“ gesperrt.*ohne --depth/s, `${command} @ ${cwd ?? HAUPT} gesperrt`)
const frei = (command, cwd) => assert.equal(lauf(command, cwd), null, `${command} @ ${cwd ?? HAUPT} frei`)

for (const [c, cwd] of [
  ['git fetch --depth=1 origin abc123', HAUPT],
  ['git fetch --depth 1 origin abc123', WT],
  ['git fetch origin main --depth=50', WT],
  ['git pull --depth=1', WT],
  ['git fetch --deepen=5', WT],
  ['git fetch --shallow-since=2026-01-01', WT],
  ['git fetch --shallow-exclude=v1', WT],
  ['git fetch --dep=1', WT],
  ['git -C C:/code/_worktrees/anime-kalender-de/thema fetch --depth=1', TMP],
  ['git -C /c/code/_worktrees/anime-kalender-de/thema fetch --depth=1', TMP],
  ['git -C C:/code/ai/anime-kalender-de fetch --depth=1', TMP],
  ['git -C thema fetch --depth=1', 'C:/code/_worktrees/anime-kalender-de'],
  ['git -C C:/code/_worktrees -C anime-kalender-de/thema fetch --depth=1', TMP],
  ['"/c/Program Files/Git/cmd/git.exe" fetch --depth=1', WT],
  ['cd C:/code/_worktrees/anime-kalender-de/thema && git fetch --depth=1', TMP],
  ['cd /c/code/ai/anime-kalender-de && git fetch --depth=1 origin x', TMP],
  ['cd .. && git fetch --depth=1', 'C:/code/_worktrees/anime-kalender-de/thema/sub'],
  ['cd anime-kalender-de/thema && git fetch --depth=1', 'C:/code/_worktrees'],
  ['pushd C:/code/_worktrees/anime-kalender-de/thema && git fetch --depth=1', TMP],
  ['git clone --depth=1 -b main https://example.org/r.git C:/code/ai/anime-kalender-de/probe', TMP],
  ['git -c user.name=x fetch --depth=1', WT],
  ['git clone --depth=1 https://example.org/r.git C:/code/ai/anime-kalender-de/probe', TMP],
  ['git clone --depth=1 https://example.org/r.git', WT],
  ['git clone --depth=1 -b main https://example.org/r.git', HAUPT],
  ["bash -c 'git fetch --depth=1'", WT],
  ['bash -lc "cd C:/code/ai/anime-kalender-de && git fetch --depth=1"', TMP],
  ['eval "git fetch --depth=1"', WT],
  ['git status && git fetch --depth=1 origin x', WT],
  ['git status; git pull --depth=1', WT],
  ['timeout 20 git fetch --depth=1', WT],
  ['git fetch \\\n  --depth=1', WT],
]) gesperrt(c, cwd)

for (const [c, cwd] of [
  ['git fetch origin', WT],
  ['git fetch origin main', HAUPT],
  ['git fetch --unshallow', WT],
  ['git pull --ff-only', HAUPT],
  ['git fetch --prune', WT],
  ['git fetch --show-forced-updates', WT],
  ['git fetch --de=1', WT],
  ['git log --depth=1', WT],
  ['git rev-list --max-count=1 HEAD', WT],
  ['git fetch --depth=1 origin x', TMP],
  ['git -C C:/Users/ih/AppData/Local/Temp/probe fetch --depth=1', WT],
  ['cd C:/Users/ih/AppData/Local/Temp/probe && git fetch --depth=1', WT],
  ['git clone --depth=1 https://example.org/r.git C:/Users/ih/AppData/Local/Temp/probe', WT],
  ['git clone --depth=1 https://example.org/r.git C:/Users/ih/AppData/Local/Temp/probe', HAUPT],
  ['git clone --depth=1 -b main https://example.org/r.git probe', TMP],
  ['git clone https://example.org/r.git', WT],
  ['git clone --depth=1 https://example.org/r.git x', 'C:/code/ai/anime-kalender-de-anderes'],
  ['git commit -m "git fetch --depth=1"', WT],
  ['echo git fetch --depth=1', WT],
  ["printf 'git fetch --depth=1'", WT],
  ['git commit -m x\ncat > f <<EOF\ngit fetch --depth=1\nEOF', WT],
  ['git fetch --depth', 'C:/code/ai/anime-kalender-de-anderes'],
  ['npm run check', WT],
  ['', WT],
]) frei(c, cwd)

assert.equal(lauf('git fetch --depth=1', WT, 'Write'), null, 'Write frei')
assert.equal(pruefe({ tool_name: 'Bash' }), null, 'ohne tool_input frei')

// Prozess: Verweigerung als JSON auf stdout, Exit 0; freier Befehl ohne Ausgabe, kaputte Eingabe mit Fehlerzeile.
const prozess = (roh) => spawnSync(process.execPath, [hook], { input: roh, encoding: 'utf8', timeout: 20000 })
const rot = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git fetch --depth=1 origin x' }, cwd: WT }))
assert.equal(rot.status, 0)
assert.equal(JSON.parse(rot.stdout).hookSpecificOutput.permissionDecision, 'deny')
const gruen = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git fetch origin' }, cwd: WT }))
assert.equal(gruen.status, 0)
assert.equal(gruen.stdout, '')
const kaputt = prozess('{')
assert.equal(kaputt.status, 0)
assert.match(kaputt.stderr, /^fetch-depth-sperre: /)

// Verdrahtung: der Verteiler lehnt den Befehl ab.
const { entscheide } = createRequire(import.meta.url)(join(import.meta.dirname, '..', '.claude', 'hooks', 'dispatch-pretooluse.js'))
const d = entscheide({ tool_name: 'Bash', tool_input: { command: 'git fetch --depth=1 origin x' }, cwd: WT })
assert.equal(d?.permissionDecision, 'deny')
assert.match(d.permissionDecisionReason, /git fetch --depth/)

console.log('fetch-depth-sperre.test: ok (fetch/pull/clone, Abkürzung, -C, cd, bash -c, Ketten; frei: Wegwerf-Ordner, normaler Fetch, Text, Heredoc, Prozess, Verteiler)')
