/**
 * Test für `tools/claude-global/hooks/ort-sperre.js` (über `pruefe` aus hauptordner-sperre.js, dem eingebundenen Hook):
 * `git worktree add` nur unter C:/code/_worktrees/<repo>/<thema>; Write neuer Wegwerfdateien in Repo-Wurzeln unter C:/code verweigert.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hookDatei = join(import.meta.dirname, 'claude-global', 'hooks', 'hauptordner-sperre.js')
const require = createRequire(import.meta.url)
const { pruefe } = require(hookDatei)
const ORT = require(join(import.meta.dirname, 'claude-global', 'hooks', 'ort-sperre.js'))

const HAUPT = 'C:/code/ai/anime-kalender-de'
const WT = 'C:/code/_worktrees/anime-kalender-de'
const bash = (command, cwd = HAUPT) => pruefe({ tool_name: 'Bash', cwd, tool_input: { command } })
const falsch = (command, cwd, was) => assert.match(bash(command, cwd) ?? '', /^„git worktree add außerhalb von C:\/code\/_worktrees .*gesperrt\. Worktrees liegen nur unter C:\/code\/_worktrees\/<repo>\/<thema>/, `${was ?? command} verweigert`)
const richtig = (command, cwd, was) => assert.equal(bash(command, cwd), null, `${was ?? command} erlaubt`)

// Ziel innerhalb: erlaubt, in jeder Schreibweise und Optionsfolge.
richtig(`git worktree add ${WT}/foo -b fix/foo origin/main`, HAUPT, 'Standardbefehl')
richtig('git worktree add /c/code/_worktrees/andere-repo/x origin/main', HAUPT, 'Git-Bash-Pfad, anderes Repo')
richtig('git worktree add C:\\code\\_worktrees\\anime-kalender-de\\foo -b y origin/main', HAUPT, 'Backslashes')
richtig('git worktree add C:/CODE/_Worktrees/anime-kalender-de/foo', HAUPT, 'Groß-/Kleinschreibung')
richtig('git worktree add -b zweig-x C:/code/_worktrees/r/t', HAUPT, '-b vor dem Ziel')
richtig('git worktree add -B zweig-x C:/code/_worktrees/r/t', HAUPT, '-B vor dem Ziel')
richtig('git worktree add --detach --quiet C:/code/_worktrees/r/t origin/main', HAUPT, 'Flags ohne Wert')
richtig('git worktree add ../../_worktrees/anime-kalender-de/rel -b y origin/main', HAUPT, 'relativ vom Hauptordner')
richtig('git -C C:/code/ai/anime-kalender-de worktree add C:/code/_worktrees/anime-kalender-de/foo', 'C:/tmp', 'mit -C')
richtig('git worktree add "C:/code/_worktrees/anime-kalender-de/mit anf" -b y', HAUPT, 'in Anführungszeichen')
richtig('W=C:/code/_worktrees/r/t; git worktree add $W -b y', HAUPT, 'Variable mit Ziel innerhalb')
richtig('git -C C:/code/_worktrees/anime-kalender-de worktree add rel -b y', 'C:/tmp', 'relatives Ziel gilt ab -C')
richtig('git worktree add $UNBEKANNT -b y', HAUPT, 'nicht bestimmbares Ziel bleibt frei')
richtig('git worktree add "$dir/main" --detach', 'C:/tmp', 'Skript mit Variable')

// Ziel außerhalb: verweigert.
falsch('git worktree add C:/code/ai/_wt-x -b y origin/main', HAUPT, 'alter Ort')
falsch('git worktree add C:/code/ai/anime-kalender-de/_wt-x -b y origin/main', HAUPT, 'im Hauptordner')
falsch('git worktree add C:/code/_worktrees/nur-eine-ebene -b y', HAUPT, 'nur Repo-Ebene')
falsch('git worktree add C:/code/_worktrees -b y', HAUPT, 'Wurzel selbst')
falsch('git worktree add C:/code/_worktrees-neu/r/t -b y', HAUPT, 'Präfix ohne Schrägstrich')
falsch('git worktree add C:/code/_worktrees/../ai/r/t -b y', HAUPT, '.. führt hinaus')
falsch('git worktree add ../x -b y', HAUPT, 'relativ aus dem Hauptordner')
falsch('git worktree add _wt-x -b y', HAUPT, 'relativer Name')
falsch('git worktree add -b C:/code/_worktrees/r/t C:/code/ai/x', HAUPT, 'Wert von -b ist nicht das Ziel')
falsch('git worktree add -B y C:/code/ai/x origin/main', HAUPT, 'Wert von -B ist nicht das Ziel')
falsch('git worktree add --detach C:/code/ai/x', HAUPT, 'Flag ohne Wert, Ziel außerhalb')
falsch('git status ; git worktree add C:/code/ai/_wt-x -b y', HAUPT, 'nach ;')
falsch('git fetch && git worktree add C:/code/ai/_wt-x', HAUPT, 'nach &&')
falsch('bash -c "git worktree add C:/code/ai/_wt-x"', HAUPT, 'in bash -c')
falsch('git worktree add C:/tmp/probe', 'C:/code/ai/anderes-repo', 'anderes Repo, Ziel außerhalb')
falsch('git -C C:/code/ai/ticket-board worktree add C:/code/ai/ticket-board/_wt-x', 'C:/tmp', 'mit -C')
falsch('W=C:/code/ai/_wt-x; git worktree add $W -b y', HAUPT, 'Variable mit Ziel außerhalb')
falsch('cd C:/code/ai/anime-kalender-de ; git worktree add _wt-x', 'C:/code/_worktrees/anime-kalender-de/a', 'cd mit ; gilt beide Möglichkeiten')
richtig('git worktree add', HAUPT, 'ohne Ziel (git meldet den Fehler selbst)')
richtig('git worktree list', HAUPT, 'list')
richtig('git worktree remove C:/code/ai/_wt-alt', HAUPT, 'remove darf auch alte Orte aufräumen')
richtig('git worktree prune', HAUPT, 'prune')

// Write: nur neue Wegwerfdateien direkt in einer Repo-Wurzel (Ordner mit .git) unter C:/code.
const vorhanden = new Set(['C:/Users/ih/AppData/Local/Temp/claude/x/scratchpad/.git', 'D:/code/ai/anime-kalender-de/.git', `${HAUPT}/.git`, `${WT}/foo/.git`, `${HAUPT}/_alt.log`, 'C:/code/ai/neu/x'])
const existiert = (p) => [...vorhanden].some((v) => v.toLowerCase() === p.toLowerCase())
const schreibe = (file_path, tool_name = 'Write') => pruefe({ tool_name, tool_input: { file_path } }, existiert)
const verweigert = (file_path, was) => assert.match(schreibe(file_path) ?? '', /^Wegwerfdatei „[^“]+“ direkt in der Repo-Wurzel .*Scratchpad/, `${was ?? file_path} verweigert`)
const erlaubt = (file_path, was, tool_name) => assert.equal(schreibe(file_path, tool_name), null, `${was ?? file_path} erlaubt`)

for (const n of ['_q.mjs', '_vc-handbelege.log', '_wt-x.txt', '.liste1397.txt', '.a.bak', '.tmp_x', 'probe.log', 'GROSS.LOG', 'x.bak', 'y.tmp', '_']) {
  verweigert(`${HAUPT}/${n}`, `Hauptordner ${n}`)
  verweigert(`${WT}/foo/${n}`, `Worktree-Wurzel ${n}`)
}
verweigert(`${HAUPT.replace(/\//g, '\\')}\\_q.mjs`, 'Backslash-Pfad')
verweigert('c:/CODE/ai/anime-kalender-de/_q.mjs', 'Schreibweise')
for (const n of ['eslint.config.mjs', 'robots.txt', '.gitignore', '.env.example', '.gitattributes', 'README.md', 'package.json', 'neu.ts', 'CLAUDE.md', 'nicht_log.txt']) {
  erlaubt(`${HAUPT}/${n}`, `legitim ${n}`)
}
erlaubt(`${HAUPT}/_alt.log`, 'vorhandene Datei überschreiben')
erlaubt(`${HAUPT}/web/_q.mjs`, 'Unterordner ohne .git')
erlaubt(`${WT}/foo/web/src/_q.mjs`, 'Unterordner im Worktree')
erlaubt('C:/code/ai/neu/_q.mjs', 'Ordner ohne .git (neues Projekt)')
erlaubt('C:/Users/ih/AppData/Local/Temp/claude/x/scratchpad/_q.mjs', 'Scratchpad außerhalb von C:/code')
erlaubt('D:/code/ai/anime-kalender-de/_q.mjs', 'anderes Laufwerk')
erlaubt(`${HAUPT}/_q.mjs`, 'Edit ist kein Write', 'Edit')
assert.equal(schreibe(undefined), null, 'ohne Pfad')

// Einzelne Bausteine mit festen Werten (nicht aus dem Modul abgeleitet).
assert.equal(ORT.zielArgument(['add', '-b', 'zweig', 'ziel', 'origin/main']), 'ziel')
assert.equal(ORT.zielArgument(['add', '--reason', 'grund', 'ziel']), 'ziel')
assert.equal(ORT.zielArgument(['add', '-f', '--detach', 'ziel']), 'ziel')
assert.equal(ORT.zielArgument(['add']), undefined)
assert.equal(ORT.imWorktreeOrdner('c:/code/_worktrees/r/t'), true)
assert.equal(ORT.imWorktreeOrdner('c:/code/_worktrees/r'), false)
assert.equal(ORT.imWorktreeOrdner('c:/code/_worktrees'), false)

// Prozess: der Hook als eigener Prozess liefert die Verweigerung auf stdout und Exit 0.
const lauf = (eingabe) => spawnSync(process.execPath, [hookDatei], { input: JSON.stringify(eingabe), encoding: 'utf8', windowsHide: true })
const aus = lauf({ tool_name: 'Bash', cwd: HAUPT, tool_input: { command: 'git worktree add C:/code/ai/_wt-x -b y origin/main' } })
assert.equal(aus.status, 0)
assert.match(JSON.parse(aus.stdout).hookSpecificOutput.permissionDecisionReason, /^„git worktree add außerhalb von C:\/code\/_worktrees/)
const ok = lauf({ tool_name: 'Bash', cwd: HAUPT, tool_input: { command: `git worktree add ${WT}/foo -b y origin/main` } })
assert.equal(ok.status, 0)
assert.equal(ok.stdout, '', 'Ziel innerhalb: keine Ausgabe')

console.log('ort-sperre.test: ok (worktree add nur unter _worktrees/<repo>/<thema>, Wegwerfdateien in Repo-Wurzeln, Prozess)')
