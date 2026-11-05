/** Test für `tools/claude-global/hooks/md-links-relativ.js`: file:///-Links in Daniels .md-Dateien werden relativ. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'md-links-relativ.js')
const { relativ, umschreiben, betroffen } = createRequire(import.meta.url)(hook)

const W = 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten'
const JETZT = W + '/jetzt/e36.md'

// Ziel außerhalb des Repos, mit Leerzeichen und Zeilenanker
assert.equal(relativ(JETZT, 'C:/code/ai/ai%20helper%20files/my_secrets.md#L250'), '../../../ai%20helper%20files/my_secrets.md#L250')
// anderer Zweig des Laufwerks
assert.equal(relativ(JETZT, 'C:/Users/ih/.claude/rules/95-privat.md'), '../../../../../Users/ih/.claude/rules/95-privat.md')
// Ordner behält den Schrägstrich, Klammern werden kodiert
assert.equal(relativ(JETZT, 'C:/code/ai/ai%20helper%20files/'), '../../../ai%20helper%20files/')
assert.equal(relativ(JETZT, 'C:/x/a%20(b).md'), '../../../../../x/a%20%28b%29.md')
// Umlaut bleibt lesbar kodiert und auflösbar
assert.equal(decodeURIComponent(relativ(JETZT, W + '/berichte/l%C3%A4ufe.md')), '../berichte/läufe.md')

const { text, n } = umschreiben(JETZT, 'a [x](file:///C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/b.md) b [y](https://e.de) [z](../c.md)')
assert.equal(n, 1)
assert.equal(text, 'a [x](../berichte/b.md) b [y](https://e.de) [z](../c.md)')

assert.equal(betroffen(JETZT), true)
assert.equal(betroffen(W + '/stand.md'), false, 'stand.md liest die Mod, bleibt file:///')
assert.equal(betroffen(W + '/listen/stand.md'), true)
assert.equal(betroffen('C:/code/ai/anime-kalender-de/docs/x.md'), false)
assert.equal(betroffen(W + '/mockups/index.html'), false)
assert.equal(betroffen(W.replace(/\//g, '\\') + '\\jetzt\\e.md'), true)

// Prozess: Write-Ereignis schreibt um und meldet, stand.md bleibt
const tmp = mkdtempSync(join(tmpdir(), 'mdlinks-')).replace(/\\/g, '/')
try {
  mkdirSync(tmp + '/jetzt')
  const ziel = tmp + '/jetzt/e.md'
  writeFileSync(ziel, `[s](file:///${tmp}/berichte/x.md#L3)\n`)
  writeFileSync(tmp + '/stand.md', `[s](file:///${tmp}/berichte/x.md)\n`)
  const lauf = (ein) => spawnSync(process.execPath, [hook], { input: JSON.stringify(ein), env: { ...process.env, DANIEL_ORDNER: tmp }, encoding: 'utf8', timeout: 15000 })
  const r = lauf({ tool_name: 'Write', tool_input: { file_path: ziel } })
  assert.equal(r.status, 0)
  assert.equal(readFileSync(ziel, 'utf8'), '[s](../berichte/x.md#L3)\n')
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /e\.md: 1/)
  const b = lauf({ tool_name: 'Bash', tool_input: { command: 'node x' } })
  assert.equal(b.status, 0)
  assert.equal(b.stdout, '', 'nichts mehr umzuschreiben, stand.md ausgenommen')
  assert.match(readFileSync(tmp + '/stand.md', 'utf8'), /file:\/\/\//)
  writeFileSync(ziel, `[t](file:///${tmp}/a.md)\n`)
  lauf({ tool_name: 'Bash', tool_input: { command: 'node x' } })
  assert.equal(readFileSync(ziel, 'utf8'), '[t](../a.md)\n', 'Bash-Ereignis erfasst frisch geänderte Dateien')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log('md-links-relativ-hook.test: ok (relativ, Anker, Ordner, Klammern, Umlaut, nur file:, Ausnahme stand.md, Write- und Bash-Ereignis)')
