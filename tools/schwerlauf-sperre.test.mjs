/**
 * Test für `.claude/hooks/schwerlauf-sperre.js` (PreToolUse auf Bash): Vollläufe der Prüfkette direkt gestartet werden abgewiesen,
 * derselbe Lauf hinter `node tools/schwer.mjs` und Einzelprüfungen bleiben frei.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, '..', '.claude', 'hooks', 'schwerlauf-sperre.js')
const { pruefe } = createRequire(import.meta.url)(hook)

const lauf = (command, extra = {}, tool_name = 'Bash') => pruefe({ tool_name, tool_input: { command, ...extra } })
const gesperrt = (command, extra) => assert.match(lauf(command, extra) ?? '', /gesperrt.*node tools\/schwer\.mjs/s, `${command} gesperrt`)
const frei = (command, extra) => assert.equal(lauf(command, extra), null, `${command} frei`)

const GESPERRT = [
  'node tools/check-logic-alle.mjs',
  'node tools/check-logic-alle.mjs --alle',
  'node tools/check-logic-alle.mjs tools/check-bestand-liste.txt check:bestand',
  'node tools/tests-alle.mjs --teil 1/2',
  'node tools/tests-alle.mjs --alle',
  'node C:/code/_worktrees/anime-kalender-de/x/tools/tests-alle.mjs',
  '"/c/Program Files/nodejs/node.exe" tools/check-logic-alle.mjs',
  'node --require tools/bestand-sperre.cjs tools/tests-alle.mjs',
  'npx tsx tools/check-logic-alle.mjs',
  'tsx tools/tests-alle.mjs',
  'npm run check:vor-commit',
  'npm run check:logic',
  'npm run check:logic -- --alle',
  'npm run check:logic-1',
  'npm run check:logic-2',
  'npm run check:tests-1',
  'npm run check:tests-2',
  'npm run check:bestand',
  'npm run check:bestand-liste',
  'npm run-script check:vor-commit',
  'pnpm run check:vor-commit',
  'yarn check:vor-commit',
  'PATH="/c/Program Files/nodejs:$PATH" npm run check:vor-commit',
  'PATH="/c/Program Files/nodejs:$PATH" npm run check:logic -- --alle',
  'CI=true node tools/tests-alle.mjs',
  'timeout 270 npm run check:vor-commit',
  'env FOO=1 npm run check:vor-commit',
  'env -i npm run check:vor-commit',
  'command npm run check:vor-commit',
  'exec node tools/tests-alle.mjs',
  'nice npm run check:logic',
  'node --import tsx tools/tests-alle.mjs',
  'node --import ./laden.mjs tools/tests-alle.mjs',
  'npx -y tsx tools/tests-alle.mjs',
  'node -r tools/bestand-sperre.cjs tools/tests-alle.mjs',
  'npx -p tsx tsx tools/tests-alle.mjs',
  'npx --package tsx tsx tools/tests-alle.mjs',
  'node tools/check-logic-alle.js',
  'npx tsx pipeline/check-logic-alle.ts',
  'npm --silent run check:vor-commit',
  'time node tools/check-logic-alle.mjs',
  'nohup node tools/check-logic-alle.mjs > log.txt 2>&1',
  'cd C:/code/_worktrees/anime-kalender-de/x && npm run check:vor-commit',
  'git status && node tools/check-logic-alle.mjs --alle',
  'echo start; npm run check:vor-commit',
  'npm run check:vor-commit < /dev/null | tail -5',
  'bash -c "npm run check:vor-commit"',
  "sh -c 'node tools/tests-alle.mjs'",
  'node tools/check-logic-alle.mjs # run_in_background',
  'npm.cmd run check:vor-commit',
  '(node tools/check-logic-alle.mjs)',
  'x=$(npm run check:vor-commit)',
]
for (const c of GESPERRT) gesperrt(c)
assert.match(lauf('PATH=x npm run check:vor-commit -- --alle'), /^„npm run check:vor-commit“ gesperrt/, 'Meldung nennt den Lauf')
assert.match(lauf('node tools/tests-alle.mjs --teil 1/2'), /^„node tools\/tests-alle\.mjs --teil 1\/2“ gesperrt/, 'Meldung nennt Skript und Anfang der Argumente')
// run_in_background ist ein Werkzeugparameter: er macht den Direktlauf nicht erlaubt.
gesperrt('node tools/check-logic-alle.mjs', { run_in_background: true })
gesperrt('npm run check:vor-commit', { run_in_background: true, timeout: 600000 })

const FREI = [
  'node tools/schwer.mjs node tools/check-logic-alle.mjs',
  'node tools/schwer.mjs node tools/tests-alle.mjs --teil 1/2',
  'node tools/schwer.mjs npm run check:vor-commit',
  'node tools/schwer.mjs npm run check:logic -- --alle',
  'PATH="/c/Program Files/nodejs:$PATH" node tools/schwer.mjs npm run check:vor-commit',
  'cd C:/code/_worktrees/anime-kalender-de/x && node tools/schwer.mjs npm run check:bestand',
  'npx tsx pipeline/check-takt.ts',
  'npx tsx tools/dispatch-test.ts',
  'node tools/fetch-depth-sperre.test.mjs',
  'node tools/check-workflows.mjs',
  'node tools/apt-fremdquelle.test.mjs',
  'node tools/umfang-pruefen.mjs',
  'node tools/mutationsanker-alle.test.mjs',
  'node tools/diff-mutanten.mjs',
  'npx tsc --noEmit -p .',
  'npx tsc --noEmit -p tools/tsconfig.worker.json',
  'npm run typecheck',
  'npm run check:handbelege',
  'npm run check:ansichten',
  'npm run data:build',
  'npm run check:logic-hilfe',
  'npm run check:vor-commit-hinweis',
  'npx tsx',
  'node',
  'npm',
  'npm run',
  'npm install',
  'npm ci',
  'npx eslint tools/schwer.mjs',
  'git commit -m "check-logic-alle und npm run check:vor-commit"',
  'git commit -m "tests-alle" && git push',
  'echo node tools/check-logic-alle.mjs',
  'printf "npm run check:vor-commit"',
  'grep -rn tests-alle tools',
  'grep -n node tools/check-logic-alle.mjs',
  'cat tools/check-logic-alle.mjs',
  'ls tools/tests-alle.mjs',
  'node -e "console.log(1)" check-logic-alle',
  'node tools/tests-liste.mjs',
  'node tools/check-logic-alle-hilfe.mjs',
  'bash -c "npx tsx pipeline/check-takt.ts"',
  'git log --oneline -S"check-logic-alle"',
  'cat <<EOF\nnode tools/check-logic-alle.mjs\nEOF',
  '',
]
for (const c of FREI) frei(c)
// schwer.mjs im Vordergrund frei (auch mit false/ohne Parameter/anderem Wert), im Hintergrund gesperrt, andere Hintergrundbefehle frei.
const hintergrundGesperrt = (command) => assert.match(lauf(command, { run_in_background: true }) ?? '', /^„node [^“]*“ im Hintergrund gesperrt: schwere Läufe nur im Vordergrund/, `${command} im Hintergrund gesperrt`)
for (const c of ['node tools/schwer.mjs node tools/check-logic-alle.mjs', 'node tools/schwer.mjs npm run check:vor-commit', 'PATH=x node tools/schwer.mjs npm run check:bestand', 'timeout 250 node tools/schwer.mjs npm run check:logic', 'cd C:/x && node tools/schwer.mjs node tools/tests-alle.mjs', 'bash -c "node tools/schwer.mjs npm run check:logic"', 'node --require a.cjs tools/schwer.mjs x', 'node C:/code/_worktrees/anime-kalender-de/x/tools/schwer.mjs npm run check:logic', 'node tools/schwer.mjs']) hintergrundGesperrt(c)
for (const wert of [false, undefined, null, 'true', 1]) assert.equal(lauf('node tools/schwer.mjs npm run check:vor-commit', { run_in_background: wert }), null, `run_in_background=${wert} zählt nicht als Hintergrund`)
for (const c of ['node tools/bau-vergleich.mjs --katalog', 'npx tsx pipeline/check-takt.ts', 'node tools/umfang-pruefen.mjs', 'node', 'python tools/schwer.mjs x', 'npm run check:handbelege', 'node tools/schwer-bericht.mjs x', 'echo node tools/schwer.mjs x', 'grep -n x tools/schwer.mjs', 'git commit -m "node tools/schwer.mjs"']) frei(c, { run_in_background: true })
// Der Verteiler reicht den Parameter durch.
const dh = createRequire(import.meta.url)(join(import.meta.dirname, '..', '.claude', 'hooks', 'dispatch-pretooluse.js')).entscheide({ tool_name: 'Bash', tool_input: { command: 'node tools/schwer.mjs npm run check:logic', run_in_background: true }, cwd: 'C:/code/_worktrees/anime-kalender-de/x' })
assert.equal(dh?.permissionDecision, 'deny')
assert.equal(pruefe({ tool_name: 'Edit', tool_input: { command: 'npm run check:vor-commit' } }), null, 'andere Werkzeuge frei')
assert.equal(pruefe({ tool_name: 'Bash', tool_input: {} }), null, 'ohne Befehl frei')
assert.equal(pruefe({ tool_name: 'Bash' }), null, 'ohne Eingabe frei')

// Prozess: deny als JSON, frei ohne Ausgabe, kaputte Eingabe ohne Absturz.
const prozess = (eingabe) => spawnSync(process.execPath, [hook], { input: eingabe, encoding: 'utf8', timeout: 30000, windowsHide: true })
const rot = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm run check:vor-commit' } }))
assert.equal(rot.status, 0)
assert.equal(JSON.parse(rot.stdout).hookSpecificOutput.permissionDecision, 'deny')
const gruen = prozess(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'node tools/schwer.mjs npm run check:vor-commit' } }))
assert.equal(gruen.status, 0)
assert.equal(gruen.stdout, '')
const kaputt = prozess('{')
assert.equal(kaputt.status, 0)
assert.match(kaputt.stderr, /^schwerlauf-sperre: /)

// Verdrahtung: der Verteiler lehnt den Befehl ab und lässt den schwer-Weg durch.
const { entscheide } = createRequire(import.meta.url)(join(import.meta.dirname, '..', '.claude', 'hooks', 'dispatch-pretooluse.js'))
const d = entscheide({ tool_name: 'Bash', tool_input: { command: 'node tools/check-logic-alle.mjs' }, cwd: 'C:/code/_worktrees/anime-kalender-de/x' })
assert.equal(d?.permissionDecision, 'deny')
assert.match(d.permissionDecisionReason, /node tools\/schwer\.mjs/)
const ok = entscheide({ tool_name: 'Bash', tool_input: { command: 'node tools/schwer.mjs node tools/check-logic-alle.mjs' }, cwd: 'C:/code/_worktrees/anime-kalender-de/x' })
assert.ok(!ok?.permissionDecisionReason?.includes('Vollläufe'), 'schwer-Weg vom Verteiler nicht abgewiesen')

console.log(`schwerlauf-sperre.test: ok (${GESPERRT.length + 2} gesperrt: Skripte, npm-Ziele, PATH=, timeout, Ketten, bash -c, run_in_background, schwer.mjs im Hintergrund (9); ${FREI.length + 1} frei: schwer.mjs im Vordergrund, Einzelprüfungen, Text; Prozess, Verteiler)`)
