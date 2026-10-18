/**
 * Test für `tools/claude-global/hooks/prioritaet-niedrig.js` (SessionStart): Auswahl des Claude-Code-Vorfahren, nie die Desktop-App,
 * und als Prozess still mit Exit 0, wenn kein Claude-Code-Vorfahr da ist (hier: der Testprozess selbst ist node).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'prioritaet-niedrig.js')
const { claudeCodeVorfahr } = createRequire(import.meta.url)(hook)

const CLI = 'C:\\Users\\ih\\AppData\\Roaming\\Claude\\claude-code\\2.1.299\\f0584be0fbaf\\claude.exe'
const APP = 'C:\\Program Files\\WindowsApps\\Claude_2.42304.0.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe'
const t = (zeilen) => new Map(zeilen.map(([pid, ppid, pfad]) => [pid, { ppid, pfad }]))

// Hook direkt unter der CLI, die CLI unter der Desktop-App: gewählt wird die CLI.
assert.equal(claudeCodeVorfahr(t([[10, 1, APP], [20, 10, CLI], [30, 20, 'C:\\Program Files\\nodejs\\node.exe']]), 20), 20)
// Über eine Shell dazwischen: die CLI zwei Stufen höher.
assert.equal(claudeCodeVorfahr(t([[10, 1, APP], [20, 10, CLI], [25, 20, 'C:\\Program Files\\Git\\usr\\bin\\bash.exe']]), 25), 20)
// Nur die Desktop-App als Vorfahr (gleicher Programmname Claude.exe): nichts setzen.
assert.equal(claudeCodeVorfahr(t([[10, 1, APP], [25, 10, 'C:\\x\\bash.exe']]), 25), undefined)
// Kette reißt ab oder ist länger als fünf Stufen: nichts setzen.
assert.equal(claudeCodeVorfahr(t([[25, 99, 'C:\\x\\bash.exe']]), 25), undefined)
const lang = t([[1, 0, CLI], [2, 1, 'a'], [3, 2, 'b'], [4, 3, 'c'], [5, 4, 'd'], [6, 5, 'e']])
assert.equal(claudeCodeVorfahr(lang, 5), 1, 'fünfte Stufe wird noch gefunden')
assert.equal(claudeCodeVorfahr(lang, 6), undefined, 'sechste nicht')
// Ordnername claude-code nur als ganzer Pfadteil.
assert.equal(claudeCodeVorfahr(t([[20, 1, 'C:\\tools\\my-claude-code-x\\claude.exe']]), 20), undefined)

// Als Prozess: kein Claude-Code-Vorfahr (Elternteil ist dieser node-Prozess) → still, Exit 0.
const r = spawnSync(process.execPath, [hook], { encoding: 'utf8', timeout: 20000 })
assert.equal(r.status, 0, r.stderr)
assert.equal(r.stdout, '')
console.log('prioritaet-niedrig.test: ok (CLI, Shell dazwischen, nur App, Abriss, Tiefe, Pfadteil, Prozess)')
