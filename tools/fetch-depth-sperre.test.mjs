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
const HEIM_ALT = process.env.HOME
process.env.HOME = 'C:/Users/ih' // feste Heimat nur für die Fälle, damit `$HOME/../..` überall gleich aufgelöst wird; der Verteiler weiter unten schreibt unter HOME

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
  ['git --git-dir=C:/code/ai/anime-kalender-de/.git fetch --depth=1', TMP],
  ['git --git-dir C:/code/ai/anime-kalender-de/.git fetch --depth=1', TMP],
  ['git --git-dir=/c/code/ai/anime-kalender-de/.git/worktrees/thema pull --depth=1', TMP],
  ['git --git-dir=C:/code/_worktrees/anime-kalender-de/thema/.git fetch --depth=1', TMP],
  ['git --git-dir=.git fetch --depth=1', WT],
  ['git --git-dir=.git --work-tree=. fetch --depth=1', HAUPT],
  ['git --work-tree=C:/code/ai/anime-kalender-de fetch --depth=1', TMP],
  ['git --git-dir=C:/Users/ih/AppData/Local/Temp/probe/.git --work-tree=C:/code/ai/anime-kalender-de fetch --depth=1', TMP],
  ['GIT_DIR=C:/code/ai/anime-kalender-de/.git git fetch --depth=1', TMP],
  ['GIT_DIR=/c/code/ai/anime-kalender-de/.git GIT_WORK_TREE=/c/code/ai/anime-kalender-de git pull --depth=1', TMP],
  ['GIT_WORK_TREE=C:/code/_worktrees/anime-kalender-de/thema git fetch --depth=1', TMP],
  ['env GIT_DIR=C:/code/ai/anime-kalender-de/.git git fetch --depth=1', TMP],
  ['export GIT_DIR=C:/code/ai/anime-kalender-de/.git && git fetch --depth=1', TMP],
  // A1: Präfix-Zuweisung gilt nur für den eigenen Befehl; danach zählt das Startverzeichnis
  [`GIT_DIR=${TMP}/.git true; git fetch --depth=1`, HAUPT],
  [`GIT_DIR=${TMP}/.git git status; git fetch --depth=1`, HAUPT],
  [`GIT_DIR=${TMP}/.git git status && git fetch --depth=1`, WT],
  // allein stehende Zuweisung bleibt (vorsichtig) für Folgebefehle
  ['GIT_DIR=C:/code/ai/anime-kalender-de/.git; git fetch --depth=1', TMP],
  // A2: Pfadformen
  ['git --git-dir=/mnt/c/code/ai/anime-kalender-de/.git fetch --depth=1', TMP],
  ['git --git-dir=C:/PROGRA~1/../code/ai/anime-kalender-de/.git fetch --depth=1', TMP],
  ['git --git-dir=$HOME/../../code/ai/anime-kalender-de/.git fetch --depth=1', TMP],
  ['git -C /mnt/c/code/_worktrees/anime-kalender-de/thema fetch --depth=1', TMP],
  ['git -C C:/Users/ih/../../code/ai/anime-kalender-de fetch --depth=1', TMP],
  // A3: Mischformen
  ['git -c k=v --git-dir=C:/code/ai/anime-kalender-de/.git fetch --depth=1', TMP],
  ['git --git-dir=C:/code/ai/anime-kalender-de/.git -c k=v fetch --depth=1', TMP],
  ['GIT_DIR=C:/code/ai/anime-kalender-de/.git git -C C:/Users/ih/AppData/Local/Temp/probe fetch --depth=1', TMP],
  [`GIT_DIR=${TMP}/.git git -C C:/code/ai/anime-kalender-de --git-dir=C:/code/ai/anime-kalender-de/.git fetch --depth=1`, TMP],
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
  ['git --git-dir=C:/Users/ih/AppData/Local/Temp/probe/.git fetch --depth=1', WT],
  ['git --git-dir C:/Users/ih/AppData/Local/Temp/probe/.git --work-tree C:/Users/ih/AppData/Local/Temp/probe fetch --depth=1', HAUPT],
  ['git --git-dir=C:/code/ai/anime-kalender-de/.git fetch origin', TMP],
  ['git --git-dir=C:/code/ai/anime-kalender-de/.git log --depth=1', TMP],
  ['GIT_DIR=C:/Users/ih/AppData/Local/Temp/probe/.git git fetch --depth=1', WT],
  ['GIT_DIR=C:/code/ai/anime-kalender-de/.git git fetch origin', TMP],
  ['GIT_DIR=C:/code/ai/anime-kalender-de/.git echo git fetch --depth=1', TMP],
  ['git --git-dir=C:/code/ai/anime-kalender-de-anderes/.git fetch --depth=1', TMP],
  ['npm run check', WT],
  ['', WT],
  // A1: export bleibt für Folgebefehle, Präfix nicht in die Gegenrichtung
  [`export GIT_DIR=${TMP}/.git; git fetch --depth=1`, HAUPT],
  [`GIT_DIR=${TMP}/.git; git fetch --depth=1`, HAUPT],
  ['GIT_DIR=C:/code/ai/anime-kalender-de/.git git status; git fetch --depth=1', TMP],
  // A3: Mischformen frei; `--git-dir` hinter dem Unterbefehl ist kein gültiges Git (dokumentierte Grenze)
  [`GIT_DIR=${TMP}/.git git -C C:/code/ai/anime-kalender-de fetch --depth=1`, TMP],
  [`git -c k=v --git-dir=${TMP}/.git fetch --depth=1`, WT],
  ['git fetch --depth=1 --git-dir=C:/code/ai/anime-kalender-de/.git', TMP],
  ['git --git-dir=C:/PROGRA~1/../Users/ih/probe/.git fetch --depth=1', WT],
]) frei(c, cwd)

if (HEIM_ALT === undefined) delete process.env.HOME
else process.env.HOME = HEIM_ALT

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

console.log('fetch-depth-sperre.test: ok (fetch/pull/clone, Abkürzung, -C, --git-dir, --work-tree, GIT_DIR, cd, bash -c, Ketten; frei: Wegwerf-Ordner, normaler Fetch, Text, Heredoc, Prozess, Verteiler)')
