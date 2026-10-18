/**
 * Test für `tools/claude-global/hooks/hauptordner-sperre.js` (PreToolUse auf Bash): im Hauptordner nur Lesen und `git pull --ff-only`.
 * Befehlsformen wie in echten Sitzungen: Ketten mit `;` und `&&`, `cd` mit Windows- und /c/-Pfad, `git -C`, Unterordner, Worktrees.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'hauptordner-sperre.js')
const { pruefe } = createRequire(import.meta.url)(hook)

const HAUPT = 'C:\\code\\ai\\anime-kalender-de'
const WT = 'C:/code/ai/_wt-x'
const lauf = (command, cwd = HAUPT, tool_name = 'Bash') => pruefe({ tool_name, cwd, tool_input: { command } })
const gesperrt = (command, cwd, was) => assert.match(lauf(command, cwd), /^Hauptordner anime-kalender-de: „/, `${was ?? command} gesperrt`)
const frei = (command, cwd, was) => assert.equal(lauf(command, cwd), null, `${was ?? command} frei`)

// Jeder gesperrte Unterbefehl im Bash-cwd = Hauptordner, mit dem lesenden Nachbarn davor und danach (Treffer in der Mitte).
for (const u of ['checkout main', 'switch -c x', 'merge origin/main', 'rebase origin/main', 'commit -m x', 'reset --hard', 'cherry-pick abc', 'revert abc', 'stash', 'restore .', 'am x.patch', 'pull', 'pull --rebase', 'push origin main', 'add -A', 'clean -fd', 'worktree move a b', 'branch neu', 'branch -D x', 'config user.name x', 'config --unset user.name', 'remote add o u', 'tag v1']) {
  gesperrt(`git status && git ${u} && git log`, HAUPT, u)
}
for (const u of ['status', 'log --oneline', 'diff HEAD', 'show HEAD', 'fetch origin', 'pull --ff-only', 'pull --ff-only origin main', 'worktree add C:/code/ai/_wt-x -b y origin/main', 'worktree list', 'worktree remove C:/code/ai/_wt-x', 'worktree prune', 'rev-parse HEAD', 'branch --list', 'branch -a', 'branch', 'check-ignore -v x', 'config --get user.name', 'remote get-url origin', 'ls-files', 'blame x.ts', 'grep -n foo']) {
  frei(`git ${u}`, HAUPT, u)
}

// Wirksames Verzeichnis.
gesperrt('cd "C:\\code\\ai\\anime-kalender-de" && git checkout main', WT)
gesperrt('cd /c/code/ai/anime-kalender-de && git commit -m x', WT)
gesperrt('cd C:/code/ai/anime-kalender-de/web/src && git reset --hard', WT, 'Unterordner')
gesperrt('git -C /c/code/ai/anime-kalender-de checkout x', WT)
gesperrt('git -C "C:\\code\\ai\\anime-kalender-de" push', WT)
gesperrt('git -C C:/code/ai/anime-kalender-de/web checkout x', WT, 'Unterordner mit -C')
gesperrt('git --work-tree=C:/code/ai/anime-kalender-de checkout x', WT, '--work-tree')
gesperrt('git -c core.x=1 checkout x', HAUPT, '-c vor dem Unterbefehl')
gesperrt('cd web && git checkout x', HAUPT, 'relativer Unterordner')
gesperrt('cd .. ; cd anime-kalender-de ; git checkout x', 'C:/code/ai/_wt-x', 'relativ über ..')
gesperrt('"/c/Program Files/Git/cmd/git.exe" checkout x', HAUPT, 'git.exe mit Pfad')
gesperrt('bash -c "git checkout x"', HAUPT, 'bash -c')
gesperrt('FOO=1 git checkout x', HAUPT, 'Variablenvorsatz')
gesperrt('rtk git checkout x', HAUPT, 'rtk-Vorsatz')
gesperrt('for b in a b; do git checkout $b; done', HAUPT, 'Schleife')
gesperrt('git status\ngit checkout x', HAUPT, 'Zeilenumbruch')
gesperrt('git worktree add C:/code/ai/_wt-x -b y origin/main 2>&1; git checkout x', HAUPT, 'Umleitung 2>&1')

// Der Anlass: scheitert `worktree add`, bleibt ein mit ; angehängtes cd ohne Wirkung — der Rest läuft im Hauptordner.
gesperrt('git worktree add C:/code/ai/_wt-x -b y origin/main ; cd C:/code/ai/_wt-x ; git checkout y', HAUPT, 'Anlass mit ;')
gesperrt('git worktree add C:/code/ai/_wt-x -b y origin/main ; cd C:/code/ai/_wt-x || git checkout y', HAUPT, 'cd mit ||')
frei('git worktree add C:/code/ai/_wt-x -b y origin/main && cd C:/code/ai/_wt-x && git checkout y', HAUPT, 'Anlass mit &&')

// Frei: Worktrees, Geschwisterordner mit gleichem Präfix, andere Projekte, kein Git, Lesen.
frei('git checkout x', WT)
frei('cd C:/code/ai/_wt-x && git commit -m x', HAUPT, 'cd in Worktree mit &&')
frei('git -C C:/code/ai/_wt-x checkout y', HAUPT, '-C Worktree')
frei('git -C /c/code/ai/_wt-hauptordner-sperre commit -m x', HAUPT, '-C /c/-Worktree')
frei('cd C:/code/ai/_wt-x/web && git reset --hard', HAUPT, 'Unterordner im Worktree')
frei('cd C:/code/ai/anime-kalender-de-x && git checkout x', HAUPT, 'Geschwister mit Präfix')
frei('git -C C:/code/ai/anime-kalender-de-x commit -m x', HAUPT, '-C Geschwister')
frei('git -C C:/code/ai/my\\ website checkout x', HAUPT, 'anderes Projekt')
frei('git checkout x', 'C:/code/ai/anime-kalender-de-x', 'cwd Geschwister')
frei('git checkout x', 'C:/code/ai/anime-kalender-de-x/web', 'cwd Unterordner Geschwister')
frei('git checkout $(cat x)', WT)
frei('cd "$X" && git checkout x', WT, 'unauflösbares cd')
frei('echo git checkout x', HAUPT, 'nur Text')
frei("git commit -F - <<'EOF'\ngit checkout x\nEOF", WT, 'Heredoc-Rumpf im Worktree')
frei('cat <<EOF\ngit checkout x\nEOF\ngit status', HAUPT, 'Heredoc-Rumpf im Hauptordner')
frei('git log --format="a;b && git checkout x"', HAUPT, 'Operatoren in Anführungszeichen')
frei('git', HAUPT, 'git ohne Unterbefehl')
frei('git remote', HAUPT, 'remote ohne Argument')
frei('git config -l', HAUPT, 'config -l')
frei("git branch --list 'f*'", HAUPT, 'branch --list mit Muster')
gesperrt('git branch -a -D x', HAUPT, 'lesendes Flag neben Löschen')
frei('cd "$X" && git checkout x', HAUPT, 'unauflösbares cd im Hauptordner')
gesperrt('git --work-tree C:/code/ai/anime-kalender-de checkout x', WT, '--work-tree mit Leerzeichen')
frei('cd C:/code/ai/_wt-x 2>&1 && git checkout y', HAUPT, 'cd mit 2>&1 vor &&')
gesperrt('pushd C:/code/ai/anime-kalender-de && git checkout x', WT, 'pushd')
frei('bash run.sh "git checkout x"', HAUPT, 'bash ohne -c')
frei('git log --grep="a\\"; git checkout x"', HAUPT, 'maskiertes Anführungszeichen')
assert.equal(lauf('git checkout x', HAUPT, 'Edit'), null, 'anderes Werkzeug')
assert.equal(lauf('git checkout x', ''), null, 'ohne cwd, ohne cd')
gesperrt('git checkout x', 'c:/code/ai/ANIME-KALENDER-DE', 'Groß-/Kleinschreibung')

// Verweigerung nennt Grund und Ausweg; Prozess liefert deny-JSON, sonst nichts.
const grund = lauf('git checkout x')
assert.match(grund, /„git checkout“/)
assert.match(grund, /Worktree/)
const ruf = (command) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: 'Bash', cwd: HAUPT, tool_input: { command } }), encoding: 'utf8' })
const nein = ruf('git checkout x')
assert.equal(nein.status, 0)
assert.equal(JSON.parse(nein.stdout).hookSpecificOutput.permissionDecision, 'deny')
assert.equal(ruf('git status').stdout, '')

console.log('hauptordner-sperre.test: ok (Unterbefehle, cd/-C/--work-tree, ;-Kette, Worktrees, Geschwister, Heredoc, Prozess)')
