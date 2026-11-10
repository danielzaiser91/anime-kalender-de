// Test für daniel-dateien.mjs (Windows-Pfade ohne Backticks). Aufruf: node daniel-dateien-test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'dd-test-'))
mkdirSync(join(wurzel, 'fragen'))
process.env.DANIEL_ORDNER = wurzel
process.env.USERPROFILE = wurzel
process.env.HOME = wurzel
process.env.DANIEL_DATEIEN_STAND = join(wurzel, 'merker.json')
process.env.PATH = '' // kein gh: offenePrs liefert leer
const { pfadeOhneBackticks, sammleFunde } = await import('./daniel-dateien.mjs')

const echt = 'Ordner [C:\\code\\ai\\__assets\\updates](../x/) öffnen'
const f1 = pfadeOhneBackticks(echt, 'x.md')
assert.equal(f1.length, 1, 'der Anlassfall (Linktext ohne Backticks) muss melden')
assert.match(f1[0], /1 Windows-Pfade ohne Backticks \(C:\\code\\ai\\__assets\\updates\)/)
assert.equal(pfadeOhneBackticks('Ordner [`C:\\code\\ai\\__assets\\updates`](../x/)', 'x.md').length, 0, 'Code-Span ist ok')
assert.equal(pfadeOhneBackticks('```\nC:\\code\\ai\n```\n', 'x.md').length, 0, 'Code-Block ist ok')
assert.equal(pfadeOhneBackticks('[a](file:///C:/code/ai/x.md)', 'x.md').length, 0, 'file-Link ohne Rückstrich ist ok')
assert.equal(pfadeOhneBackticks('', 'x.md').length, 0)
assert.equal(pfadeOhneBackticks('`a` und D:\\x und C:\\y', 'x.md')[0].match(/2 Windows/)?.length, 1, 'zwei Pfade, zählt beide')
assert.equal(pfadeOhneBackticks('```\nC:\\a\n```\nC:\\b', 'x.md')[0].match(/1 Windows/)?.length, 1, 'nach dem Block zählt wieder')

// Verdrahtung: sammleFunde liest stand.md und fragen/*.md
const alle = () => sammleFunde().filter((f) => f.includes('Backticks'))
writeFileSync(join(wurzel, 'stand.md'), '# Stand\n')
assert.deepEqual(alle(), [])
writeFileSync(join(wurzel, 'stand.md'), '# Stand\n[C:\\a\\__b](x)\n')
assert.equal(alle().length, 1)
assert.match(alle()[0], /^stand\.md:/)
writeFileSync(join(wurzel, 'stand.md'), '# Stand\n')
writeFileSync(join(wurzel, 'fragen', 'e1.md'), 'C:\\a\\__b')
assert.match(alle()[0], /^fragen\/e1\.md:/)
writeFileSync(join(wurzel, 'fragen', 'e1.md'), '`C:\\a\\__b`')
assert.deepEqual(alle(), [])

rmSync(wurzel, { recursive: true, force: true })
console.log('daniel-dateien-test: ok')
