/**
 * Test für `tools/claude-global/hooks/hauptordner-sperre.js` (PreToolUse auf Bash): im Hauptordner nur Lesen und `git pull --ff-only`.
 * Befehlsformen wie in echten Sitzungen: Ketten mit `;` und `&&`, `cd` mit Windows- und /c/-Pfad, `git -C`, Unterordner, Worktrees.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'hauptordner-sperre.js')
const { pruefe, pruefeBefehl, loese } = createRequire(import.meta.url)(hook)

const HAUPT = 'C:\\code\\ai\\anime-kalender-de'
const WT = 'C:/code/_worktrees/anime-kalender-de/x'
const lauf = (command, cwd = HAUPT, tool_name = 'Bash') => pruefe({ tool_name, cwd, tool_input: { command } })
const gesperrt = (command, cwd, was) => assert.match(lauf(command, cwd), /^Hauptordner anime-kalender-de: „/, `${was ?? command} gesperrt`)
const frei = (command, cwd, was) => assert.equal(lauf(command, cwd), null, `${was ?? command} frei`)

// Jeder gesperrte Unterbefehl im Bash-cwd = Hauptordner, mit dem lesenden Nachbarn davor und danach (Treffer in der Mitte).
for (const u of ['checkout main', 'switch -c x', 'merge origin/main', 'rebase origin/main', 'commit -m x', 'reset --hard', 'cherry-pick abc', 'revert abc', 'stash', 'restore .', 'am x.patch', 'pull', 'pull --rebase', 'push origin main', 'add -A', 'clean -fd', 'worktree move a b', 'branch neu', 'branch -D x', 'config user.name x', 'config --unset user.name', 'remote add o u', 'tag v1']) {
  gesperrt(`git status && git ${u} && git log`, HAUPT, u)
}
for (const u of ['status', 'log --oneline', 'diff HEAD', 'show HEAD', 'fetch origin', 'pull --ff-only', 'pull --ff-only origin main', 'worktree add C:/code/_worktrees/anime-kalender-de/x -b y origin/main', 'worktree list', 'worktree remove C:/code/_worktrees/anime-kalender-de/x', 'worktree prune', 'rev-parse HEAD', 'branch --list', 'branch -a', 'branch', 'check-ignore -v x', 'config --get user.name', 'remote get-url origin', 'ls-files', 'blame x.ts', 'grep -n foo']) {
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
gesperrt('git \\\ncheckout x', HAUPT, 'Zeilenfortsetzung vor dem Unterbefehl')
gesperrt('git status && git \\\r\n  commit -m x', HAUPT, 'Zeilenfortsetzung CRLF')
frei('git status \\\n  --short', HAUPT, 'Zeilenfortsetzung bei lesendem Befehl')
gesperrt('cd .. ; cd anime-kalender-de ; git checkout x', 'C:/code/ai/x', 'relativ über ..')
gesperrt('"/c/Program Files/Git/cmd/git.exe" checkout x', HAUPT, 'git.exe mit Pfad')
gesperrt('bash -c "git checkout x"', HAUPT, 'bash -c')
gesperrt('FOO=1 git checkout x', HAUPT, 'Variablenvorsatz')
gesperrt('rtk git checkout x', HAUPT, 'rtk-Vorsatz')
gesperrt('for b in a b; do git checkout $b; done', HAUPT, 'Schleife')
gesperrt('git status\ngit checkout x', HAUPT, 'Zeilenumbruch')
gesperrt('git worktree add C:/code/_worktrees/anime-kalender-de/x -b y origin/main 2>&1; git checkout x', HAUPT, 'Umleitung 2>&1')

// Der Anlass: scheitert `worktree add`, bleibt ein mit ; angehängtes cd ohne Wirkung — der Rest läuft im Hauptordner.
gesperrt('git worktree add C:/code/_worktrees/anime-kalender-de/x -b y origin/main ; cd C:/code/_worktrees/anime-kalender-de/x ; git checkout y', HAUPT, 'Anlass mit ;')
gesperrt('git worktree add C:/code/_worktrees/anime-kalender-de/x -b y origin/main ; cd C:/code/_worktrees/anime-kalender-de/x || git checkout y', HAUPT, 'cd mit ||')
frei('git worktree add C:/code/_worktrees/anime-kalender-de/x -b y origin/main && cd C:/code/_worktrees/anime-kalender-de/x && git checkout y', HAUPT, 'Anlass mit &&')

// Frei: Worktrees, Geschwisterordner mit gleichem Präfix, andere Projekte, kein Git, Lesen.
frei('git checkout x', WT)
frei('cd C:/code/_worktrees/anime-kalender-de/x && git commit -m x', HAUPT, 'cd in Worktree mit &&')
frei('git -C C:/code/_worktrees/anime-kalender-de/x checkout y', HAUPT, '-C Worktree')
frei('git -C /c/code/_worktrees/anime-kalender-de/hauptordner-sperre commit -m x', HAUPT, '-C /c/-Worktree')
frei('cd C:/code/_worktrees/anime-kalender-de/x/web && git reset --hard', HAUPT, 'Unterordner im Worktree')
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
gesperrt('cd "$X" && git checkout x', HAUPT, 'unauflösbares cd im Hauptordner: das cwd entscheidet')
gesperrt('git --work-tree C:/code/ai/anime-kalender-de checkout x', WT, '--work-tree mit Leerzeichen')
frei('cd C:/code/_worktrees/anime-kalender-de/x 2>&1 && git checkout y', HAUPT, 'cd mit 2>&1 vor &&')
gesperrt('pushd C:/code/ai/anime-kalender-de && git checkout x', WT, 'pushd')
frei('bash run.sh "git checkout x"', HAUPT, 'bash ohne -c')
frei('git log --grep="a\\"; git checkout x"', HAUPT, 'maskiertes Anführungszeichen')
assert.equal(lauf('git checkout x', HAUPT, 'Edit'), null, 'anderes Werkzeug')
assert.equal(lauf('git checkout x', ''), null, 'ohne cwd, ohne cd')
gesperrt('git checkout x', 'c:/code/ai/ANIME-KALENDER-DE', 'Groß-/Kleinschreibung')

// A1: Agent-Worktrees im Hauptordner (.claude/worktrees/agent-*) sind eigene Arbeitsbäume. Ein `_wt-*` im Hauptordner ist es seit 25.10.2026 nicht mehr.
const IN = 'C:/code/ai/anime-kalender-de'
gesperrt('git commit -m x', `${IN}/_wt-a`, 'ein _wt-Ordner im Hauptordner ist kein Worktree mehr')
gesperrt('git commit -m x', `${IN}/_wt-a/web/src`, 'Unterordner davon')
frei('git commit -m x', `${IN}/.claude/worktrees/agent-x`, 'Agent-Worktree als cwd')
frei('git commit -m x', `${IN}/.claude/worktrees/agent-x/web`, 'Unterordner eines Agent-Worktrees')
frei(`cd ${IN}/.claude/worktrees/agent-x && git commit -m x`, HAUPT, 'cd in Agent-Worktree')
assert.match(lauf(`git worktree add ${IN}/_wt-neu -b n origin/main && cd ${IN}/_wt-neu && git commit -m x`, HAUPT), /^„git worktree add außerhalb/, 'Ziel im Hauptordner abgewiesen')
gesperrt(`git -C ${IN}/_wt-a commit -m x`, HAUPT, '-C auf _wt im Hauptordner')
gesperrt(`cd ${IN}/web && git checkout x`, HAUPT, 'Unterordner ohne eigenen Arbeitsbaum')
gesperrt('git checkout x', `${IN}/_wtx`, '_wtx ohne Bindestrich ist kein Worktree-Name')
gesperrt('git checkout x', `${IN}/.claude/worktrees`, '.claude/worktrees selbst')
gesperrt('git checkout x', `${IN}/.claude/worktrees-neu`, 'worktrees-Präfix ohne Schrägstrich, Ordner nicht vorhanden')
gesperrt('git checkout x', `${IN}/.claude/agent-x`, '.claude ohne worktrees')
gesperrt(`cd ${IN}/ && git checkout x`, WT, 'Hauptordner mit Endstrich')
gesperrt(`cd ${IN}/_wt-a/../web && git checkout x`, WT, '.. im absoluten Pfad')
gesperrt(`cd ${IN}/../anime-kalender-de && git checkout x`, WT, '.. führt zurück in den Hauptordner')

// A1 mit echtem Dateisystem: erster Vorfahr mit .git; Datei = Worktree, anderes Verzeichnis = anderer Arbeitsbaum.
const wurzel = join(tmpdir(), `ak-sperre-${process.pid}`)
const haupt = loese(null, wurzel)
try {
  for (const d of ['.git', 'web', 'wtx/sub', 'nested/.git', 'rest-ohne-git/node_modules', '.claude/worktrees/agent-rest', 'echt-mit-git']) mkdirSync(join(wurzel, d), { recursive: true })
  writeFileSync(join(wurzel, 'wtx', '.git'), 'gitdir: irgendwo')
  writeFileSync(join(wurzel, 'echt-mit-git', '.git'), 'gitdir: irgendwo')
  const pruef = (befehl, cwd) => pruefeBefehl(befehl, cwd, haupt)
  assert.match(pruef('git checkout x', haupt), /^git checkout$/, 'echter Hauptordner')
  assert.match(pruef('git checkout x', `${haupt}/web`), /^git checkout$/, 'Unterordner ohne .git')
  assert.match(pruef('git checkout x', `${haupt}/nicht/da`), /^git checkout$/, 'nicht vorhandener Unterordner')
  assert.equal(pruef('git checkout x', `${haupt}/wtx`), null, '.git-Datei = Worktree')
  assert.equal(pruef('git checkout x', `${haupt}/wtx/sub`), null, 'Unterordner eines Worktrees')
  assert.equal(pruef('git checkout x', `${haupt}/wtx/noch/nicht/da`), null, 'neuer Ordner im Worktree')
  assert.equal(pruef('git checkout x', `${haupt}/nested`), null, 'eigenes Repository im Hauptordner')
  assert.match(pruef(`cd ${haupt}/ && git checkout x`, '/'), /^git checkout$/, 'Endstrich: Hauptordner bleibt Hauptordner')
  assert.equal(pruef(`cd ${haupt}/wtx && git checkout x`, '/'), null, 'cd in Worktree mit Dateisystem')
  assert.match(pruef('bash -c "git checkout x"', haupt), /^git checkout$/, 'Shell prüft gegen denselben Hauptordner')
  assert.equal(pruef('bash -c "git checkout x"', `${haupt}/wtx`), null, 'Shell im Worktree')
  // A10: vorhandener Rest-Ordner ohne .git ist kein Worktree (Git läuft dort im Hauptordner); mit .git oder noch nicht angelegt schon.
  assert.match(pruef('git -C rest-ohne-git checkout main', haupt), /^git checkout$/, 'A10 -C auf Rest-Ordner')
  assert.match(pruef('git commit -m x', `${haupt}/rest-ohne-git`), /^git commit$/, 'A10 cwd im Rest-Ordner')
  assert.match(pruef('git checkout x', `${haupt}/rest-ohne-git/node_modules`), /^git checkout$/, 'A10 Unterordner des Rest-Ordners')
  assert.match(pruef(`cd ${haupt}/rest-ohne-git && git checkout -b foo`, haupt), /^git checkout$/, 'A10 cd in Rest-Ordner')
  assert.match(pruef(`cd ${haupt}/.claude/worktrees/agent-rest && git commit -m x`, haupt), /^git commit$/, 'A10 Agent-Rest-Ordner')
  assert.equal(pruef('git -C echt-mit-git checkout main', haupt), null, 'A10 vorhandener Worktree mit .git')
  assert.match(pruef(`git worktree add ${haupt}/neu -b n origin/main && cd ${haupt}/neu && git commit -m x`, haupt), /^git worktree add außerhalb/, 'A10 noch nicht angelegt: Ziel im Hauptordner abgewiesen')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// A2: Subshell, Befehlsersetzung, Backticks (auch in Anführungszeichen); ein cd im Inneren wirkt nicht nach außen.
gesperrt('(git checkout main)')
gesperrt('echo $(git checkout main)')
gesperrt('echo `git checkout main`')
gesperrt('echo "$(git checkout main)"', HAUPT, 'Ersetzung in Anführungszeichen')
gesperrt('echo "a `git checkout main` b"', HAUPT, 'Backtick in Anführungszeichen')
gesperrt('echo $((1 + 2)) && git checkout main', HAUPT, 'Arithmetik schließt ihre Klammern')
gesperrt('echo a) && git checkout main', HAUPT, 'schließende Klammer ohne öffnende (case-Muster)')
frei('cd C:/code/_worktrees/anime-kalender-de/x <&0 && git commit -m x', HAUPT, '<& ist keine Hintergrund-Ausführung')
frei('cd C:/code/_worktrees/anime-kalender-de/x &>/dev/null && git commit -m x', HAUPT, '&> ist keine Hintergrund-Ausführung')
frei('cd /tmp/x && git commit -m x', HAUPT, 'absoluter Pfad ohne Laufwerk liegt außerhalb')
frei('(cd C:/code/_worktrees/anime-kalender-de/x && git commit -m x)', HAUPT, 'Subshell im Worktree')
frei('echo "$(cd C:/code/_worktrees/anime-kalender-de/x && git commit -m x)"', HAUPT, 'Ersetzung im Worktree')
frei('echo "$(true) ; git checkout x"', HAUPT, 'nach der Ersetzung wieder Text in Anführungszeichen')
gesperrt('(cd C:/code/_worktrees/anime-kalender-de/x) && git checkout x', HAUPT, 'cd in Subshell wirkt nicht nach außen')
gesperrt('echo $(cd C:/code/_worktrees/anime-kalender-de/x && pwd) && git checkout x', HAUPT, 'cd in Ersetzung wirkt nicht nach außen')
gesperrt('echo `cd C:/code/_worktrees/anime-kalender-de/x && pwd` && git checkout x', HAUPT, 'cd in Backticks wirkt nicht nach außen')
frei('cd C:/code/_worktrees/anime-kalender-de/x && (git commit -m x)', HAUPT, 'cd vor der Subshell gilt darin')
gesperrt('cd C:/code/_worktrees/anime-kalender-de/x && (cd C:/code/ai/anime-kalender-de && git checkout x)', HAUPT, 'cd in der Subshell gilt darin')

// A3: leere oder unbekannte Verzeichnismenge verschluckt absolute Ziele nicht.
gesperrt('cd C:/code/ai/anime-kalender-de && git checkout main', '', 'cwd leer, cd absolut')
gesperrt('git -C C:/code/ai/anime-kalender-de checkout main', '', 'cwd leer, -C absolut')
gesperrt('cd ~ && cd C:/code/ai/anime-kalender-de && git checkout main', WT, 'cd ~ davor')
gesperrt('cd && cd C:/code/ai/anime-kalender-de && git checkout main', WT, 'cd ohne Ziel davor')
gesperrt('cd "$X" && git -C C:/code/ai/anime-kalender-de checkout main', WT, '$X davor, dann -C')
for (const z of ['../$X', '../a*', '../a?', '../~x', '../${X}']) {
  gesperrt(`cd ${z} && git checkout x`, HAUPT, `cd ${z}: nicht statisch, also entscheidet das cwd`)
  gesperrt(`git -C ${z} checkout x`, HAUPT, `-C ${z}`)
}
gesperrt('git -C "$X" checkout x', HAUPT, '-C unbekannt: cwd entscheidet')
frei('git -C "$X" checkout x', WT, '-C unbekannt im Worktree')
frei('cd ~ && git checkout x', '', 'cwd unbekannt und cd unbekannt')

// Shell-Variablen aus der Kette (W=…; git -C $W …) werden eingesetzt.
frei('W=C:/code/_worktrees/anime-kalender-de/x; git -C $W commit -m x', HAUPT, 'W Worktree')
frei('W=C:/code/_worktrees/anime-kalender-de/x; git -C ${W} commit -m x', HAUPT, '${W}')
frei('W=../../_worktrees/anime-kalender-de/x; git -C $W commit -m x', HAUPT, 'relatives W')
frei('A=C:/code/_worktrees; B=anime-kalender-de/x; cd $A/$B && git commit -m x', HAUPT, 'zwei Variablen')
gesperrt('W=C:/code/ai/anime-kalender-de; git -C $W checkout x', WT, 'W Hauptordner')
gesperrt('W=C:/code/_worktrees/anime-kalender-de/x; W=C:/code/ai/anime-kalender-de; git -C $W checkout x', WT, 'W überschrieben')
gesperrt('W=$(pwd); git -C $W checkout x', HAUPT, 'W aus Befehlsersetzung ist unbekannt')
gesperrt('W=C:/code/_worktrees/anime-kalender-de/x; W=$(pwd); git -C $W checkout x', HAUPT, 'W danach unbekannt')
gesperrt('git -C $W checkout x', HAUPT, 'W nie gesetzt')
gesperrt('W=$(pwd); cd $W/web && git checkout x', HAUPT, 'leeres W macht $W/web nicht zu /web')
frei('w=C:/code/_worktrees/anime-kalender-de/x; git -C $w commit -m x', HAUPT, 'kleingeschriebene Variable')
frei('_w=C:/code/_worktrees/anime-kalender-de/x; git -C $_w commit -m x', HAUPT, 'Variable mit Unterstrich')

// A4: Git-Aufruf an jeder Stelle des Segments, gleich was davor steht.
for (const v of ['timeout 60 ', 'nice ', 'exec ', 'env -i ', 'env FOO=1 ', 'time ', 'command ', 'sudo ', 'rtk ', 'cat f | xargs ', 'xargs -n1 ', 'if true; then ', 'while true; do ', '! ', '{ ', '( ', 'FOO=1 ']) {
  gesperrt(`${v}git checkout main`, HAUPT, v)
}
for (const s of ['bash', 'sh', 'zsh', 'dash', 'bash.exe', '/bin/bash', '"C:\\Program Files\\Git\\bin\\bash.exe"']) {
  gesperrt(`${s} -c "git checkout main"`, HAUPT, s)
}
for (const f of ['-lc', '-e -c', '-ec', '-cx', '--norc -c', '-l -e -c']) {
  gesperrt(`bash ${f} "git checkout main"`, HAUPT, f)
}
gesperrt('timeout 5 bash -c "git checkout main"', HAUPT, 'Vorsatz vor Shell')
gesperrt('bash -c "bash -c \'git checkout main\'"', HAUPT, 'Shell in Shell')
gesperrt('eval "git checkout main"', HAUPT, 'eval')
gesperrt('eval git checkout main', HAUPT, 'eval ohne Anführungszeichen')
frei('eval git status', HAUPT, 'eval lesend')
frei('bash run.sh -c "git checkout x"', HAUPT, 'Skriptdatei vor -c')
frei('bash -x run.sh "git checkout x"', HAUPT, 'Option, dann Skriptdatei')
frei('bash -c', HAUPT, '-c ohne Skript')
frei('bash', HAUPT, 'Shell ohne Argumente')
frei('printf git checkout x', HAUPT, 'printf')
gesperrt('GIT.EXE checkout x', HAUPT, 'Programmname in Großbuchstaben')
gesperrt('"C:\\Program Files\\Git\\cmd\\Git.exe" checkout x', HAUPT, 'Git.exe mit Großbuchstaben')
frei('echo git checkout x', HAUPT, 'echo')
frei('timeout 5 echo git checkout x', HAUPT, 'echo nach Vorsatz')
frei('grep -n "git checkout" x.md', HAUPT, 'grep nach Text')
frei('which git', HAUPT, 'git ohne Unterbefehl in der Mitte')
frei('ls .git', HAUPT, '.git ist kein git')
frei('git-lfs checkout x', HAUPT, 'git-lfs ist ein anderes Programm')
gesperrt('bash -c "cd C:/code/ai/anime-kalender-de && git checkout x"', WT, 'cd innerhalb der Shell')
frei('bash -c "cd C:/code/_worktrees/anime-kalender-de/x && git checkout x"', HAUPT, 'cd in Worktree innerhalb der Shell')
// A9: beide Möglichkeiten des Verzeichnisses (cd ohne &&) erreichen die Shell, erste wie zweite.
gesperrt('cd C:/code/ai/anime-kalender-de ; bash -c "git checkout x"', WT, 'Shell: zweite Möglichkeit')
gesperrt('cd C:/code/_worktrees/anime-kalender-de/x ; bash -c "git checkout x"', HAUPT, 'Shell: erste Möglichkeit')
gesperrt('cd C:/code/ai/anime-kalender-de ; git -C web checkout x', WT, '-C: zweite Möglichkeit')
gesperrt('cd C:/code/_worktrees/anime-kalender-de/x ; git -C web checkout x', HAUPT, '-C: erste Möglichkeit')
gesperrt('cd x ; git -C ../anime-kalender-de checkout x', 'C:/code/ai', '-C relativ aus beiden Möglichkeiten')

// A5: gh pr checkout wechselt den Zweig.
gesperrt('gh pr checkout 1492', HAUPT)
gesperrt('gh pr co 1492', HAUPT, 'gh pr co')
gesperrt('"/c/Program Files/GitHub CLI/gh.exe" pr checkout 1492', HAUPT, 'gh.exe mit Pfad')
gesperrt('gh pr checkout 1492', `${IN}/web`, 'gh im Unterordner')
gesperrt('cd C:/code/ai/anime-kalender-de && gh pr checkout 1492', WT, 'gh nach cd')
gesperrt('cd C:/code/_worktrees/anime-kalender-de/x ; gh pr checkout 1492', HAUPT, 'gh: eine der beiden Möglichkeiten ist der Hauptordner')
frei('gh repo checkout x', HAUPT, 'nur gh pr checkout wechselt')
frei('gh pr checkout 1492', WT, 'gh im Worktree')
frei('cd C:/code/_worktrees/anime-kalender-de/x && gh pr checkout 1492', HAUPT, 'gh nach cd in Worktree')
frei('gh pr merge 1492 --squash && git pull --ff-only', HAUPT, 'gh pr merge')
frei('gh pr view 1492', HAUPT, 'gh pr view')
frei('gh pr list', HAUPT, 'gh pr list')

// A6: && am Zeilenende bleibt &&; ohne && gilt ein cd als unsicher.
frei('cd C:/code/_worktrees/anime-kalender-de/x &&\n  git commit -m x', HAUPT, '&& am Zeilenende')
frei('cd C:/code/_worktrees/anime-kalender-de/x &&\n\n  git commit -m x', HAUPT, '&& am Zeilenende mit Leerzeile')
gesperrt('cd C:/code/_worktrees/anime-kalender-de/x\ngit commit -m x', HAUPT, 'Zeilenumbruch statt &&')
gesperrt('cd C:/code/_worktrees/anime-kalender-de/x ||\n  git commit -m x', HAUPT, '|| am Zeilenende')

// A7: Heredoc-Erkennung.
const LT = '<<'
gesperrt(`cat ${LT}< "x"\ngit checkout main`, HAUPT, 'Here-String')
gesperrt(`echo $((1${LT}2))\ngit checkout main`, HAUPT, 'Linksschieben')
gesperrt(`cat ${LT}1\ngit checkout main`, HAUPT, 'Ziffer ist kein Heredoc-Ende')
frei(`cat ${LT}'EOF'\ngit checkout x\nEOF\ngit status`, HAUPT, 'quotierter Heredoc')
frei(`cat ${LT}"EOF"\ngit checkout x\nEOF\ngit status`, HAUPT, 'Heredoc in doppelten Anführungszeichen')
frei(`cat ${LT}EOF\ngit checkout x\nEOF\ngit status`, HAUPT, 'einfacher Heredoc')
frei(`cat ${LT}-EOF\n\tgit checkout x\n\tEOF\ngit status`, HAUPT, 'Heredoc mit Bindestrich und Tab')
gesperrt(`cat ${LT}EOF\nx\nEOF\ngit checkout main`, HAUPT, 'Befehl nach dem Heredoc')
frei(`cat ${LT} EOF\ngit checkout x\nEOF\ngit status`, HAUPT, 'Heredoc mit Leerzeichen nach dem Operator')
gesperrt(`cat ${LT}'EOF'\nx\nEOF\ngit checkout main`, HAUPT, 'Befehl nach quotiertem Heredoc')
gesperrt(`cat ${LT}"EOF"\nx\nEOF\ngit checkout main`, HAUPT, 'Befehl nach Heredoc in doppelten Anführungszeichen')
gesperrt(`cat ${LT}-EOF\n\tx\n\tEOF\ngit checkout main`, HAUPT, 'Befehl nach Heredoc mit Tab-Ende')
gesperrt(`cat ${LT}EOF\nx\n  EOF\ngit checkout main`, HAUPT, 'eingerücktes Ende beendet auch')
gesperrt(`cat ${LT}EOF\ngit status\nEOFX\ngit checkout main\nEOF\ngit commit -m x`, HAUPT, 'EOFX beendet nicht')

// A8: lesende Unterbefehle bleiben frei, schreibende Formen derselben Unterbefehle nicht.
for (const u of ['merge-tree --write-tree origin/main HEAD', 'ls-remote origin main', 'reflog', 'reflog -5', 'reflog show', 'stash list', 'stash show -p', 'tag', 'tag -l', "tag --list 'v*'", 'tag -n', 'tag --points-at HEAD', 'tag --contains abc', 'tag --no-contains abc', 'tag --merged HEAD', 'tag --no-merged HEAD', 'tag --sort=-v:refname', 'tag --format=x', 'shortlog -sn', 'config user.name', 'config --global user.name x', 'config --system a b', 'config --get a b', 'config --list a b', 'config -l a b', 'config --get-regexp x', 'config --list', 'branch --format=x', 'branch --sort=-committerdate', 'branch --color', 'branch --no-color', 'branch --column', 'branch --no-column', 'branch -i --list x', 'branch --ignore-case --list x', 'branch --show-current', 'branch -a', 'branch --all', 'branch -r', 'branch --remotes', 'branch -v', 'branch -vv', 'branch --merged', 'branch --no-merged', 'branch --contains abc', 'branch --no-contains abc', 'branch --points-at HEAD', 'branch -l', 'remote', 'remote -v', 'remote show origin', 'remote get-url origin', 'rev-list --count HEAD', 'cat-file -t HEAD', 'merge-base HEAD origin/main', 'describe --tags', 'ls-tree HEAD', 'for-each-ref', 'show-ref', 'version', 'whatchanged', 'worktree list']) {
  frei(`git ${u}`, HAUPT, u)
}
for (const u of ['reflog expire --all', 'reflog delete x', 'stash', 'stash push', 'stash pop', 'stash drop', 'tag v1', 'tag -d v1', 'tag -a v1 -m x', 'config user.name x', 'config --unset a', 'config --unset-all a', 'config --add a', 'config --replace-all a', 'config --edit', 'config -e', 'config --rename-section a', 'config --remove-section a', 'branch --format=x neu', 'branch neu', 'branch -D x', 'branch -m a b', 'remote add o u', 'remote remove o', 'worktree move a b', 'worktree lock x', 'rm x', 'mv a b', 'apply x.patch', 'update-ref refs/heads/x HEAD', 'update-index --assume-unchanged x', 'symbolic-ref HEAD refs/heads/x', 'read-tree HEAD', 'sparse-checkout set x', 'filter-branch x', 'bisect start']) {
  gesperrt(`git ${u}`, HAUPT, u)
}
// Grundtext nennt den Unterbefehl.
assert.match(lauf('git reflog expire --all'), /„git reflog expire“/)
assert.match(lauf('git worktree move a b'), /„git worktree move“/)
assert.match(lauf('git worktree'), /„git worktree“/)
assert.match(lauf('git pull'), /„git pull ohne --ff-only“/)
assert.match(lauf('gh pr checkout 1'), /„gh pr checkout“/)

// A9: einzelne Weichen.
gesperrt('git status & git checkout main', HAUPT, 'Hintergrund-&')
frei('git status 2>&1 | head', HAUPT, '2>&1')
frei('git status &> /dev/null', HAUPT, '&>')
frei('git -c core.x=1 status', HAUPT, '-c mit Wert, lesend')
frei('git --git-dir x status', HAUPT, '--git-dir mit Wert, lesend')
frei('git --namespace x status', HAUPT, '--namespace mit Wert, lesend')
gesperrt('git --git-dir x checkout y', HAUPT, '--git-dir mit Wert, schreibend')
gesperrt('git --namespace x checkout y', HAUPT, '--namespace mit Wert, schreibend')
gesperrt('git --work-tree=C:/code/ai/anime-kalender-de checkout x', WT, '--work-tree=')
gesperrt('git -C C:/code/_worktrees/anime-kalender-de/x -C C:/code/ai/anime-kalender-de checkout x', WT, 'zweites -C gewinnt')
frei('git -C C:/code/ai/anime-kalender-de -C C:/code/_worktrees/anime-kalender-de/x checkout x', HAUPT, 'zweites -C gewinnt, Worktree')
frei('git status\n\n\ngit log', HAUPT, 'Leerzeilen')
frei('git status;', HAUPT, 'Strichpunkt am Ende')
frei('git toString', HAUPT, 'Unterbefehl heißt wie ein Objekt-Schlüssel')
frei('git constructor', HAUPT, 'Unterbefehl constructor')
assert.equal(pruefe({ tool_name: 'Bash', cwd: HAUPT }), null, 'ohne tool_input')
frei('', HAUPT, 'leerer Befehl')
frei('   ', HAUPT, 'nur Leerraum')

// Kaputtes JSON auf stdin: Prozess endet 0 ohne Ausgabe (fail-open).
const kaputt = spawnSync(process.execPath, [hook], { input: '{kaputt', encoding: 'utf8' })
assert.equal(kaputt.status, 0)
assert.equal(kaputt.stdout, '')
assert.match(kaputt.stderr, /^hauptordner-sperre: /)
assert.equal(spawnSync(process.execPath, [hook], { input: '', encoding: 'utf8' }).stdout, '', 'leere Eingabe')

// Verweigerung nennt Grund und Ausweg; Prozess liefert deny-JSON, sonst nichts.
const grund = lauf('git checkout x')
assert.match(grund, /„git checkout“/)
assert.match(grund, /Worktree/)
const ruf = (command) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: 'Bash', cwd: HAUPT, tool_input: { command } }), encoding: 'utf8' })
const nein = ruf('git checkout x')
assert.equal(nein.status, 0)
assert.equal(JSON.parse(nein.stdout).hookSpecificOutput.permissionDecision, 'deny')
assert.equal(ruf('git status').stdout, '')

console.log('hauptordner-sperre.test: ok (Unterbefehle, cd/-C/--work-tree, Variablen, Subshell/Ersetzung, Vorsätze, Shell-c, gh, Heredoc, Zeilenfortsetzung, Dateisystem-Worktrees, Prozess)')
