/**
 * Test für `tools/leerzeichen-gestagt-pruefen.mjs` (Pre-commit): gestagte Datei mit verschlucktem Leerzeichen hält den Commit an
 * (Datei:Zeile), saubere läuft durch, nicht gestagte und gelöschte werden nicht geprüft; `--einrichten` hängt die Prüfung in den Hook.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gestagteQuellen } from './leerzeichen-gestagt-pruefen.mjs'

const tools = import.meta.dirname
const werkzeug = path.join(tools, 'leerzeichen-gestagt-pruefen.mjs')
const wurzel = mkdtempSync(path.join(tmpdir(), 'leerzeichen-gestagt-'))
const git = (...args) => execFileSync('git', ['-C', wurzel, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
const schreibe = (datei, text) => {
  mkdirSync(path.dirname(path.join(wurzel, datei)), { recursive: true })
  writeFileSync(path.join(wurzel, datei), text)
}
const lauf = () => spawnSync(process.execPath, [werkzeug], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60000 })

try {
  git('init', '-q')
  schreibe('pipeline/alt.ts', 'export const a = 1\n')
  schreibe('pipeline/weg.ts', 'export const w = 1\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'start')

  // Nichts gestagt, aber die Arbeitskopie ist kaputt: nicht geprüft.
  schreibe('pipeline/alt.ts', 'export const a =await f()\n')
  assert.equal(lauf().status, 0, 'nicht gestagte Datei wird nicht geprüft')

  schreibe('pipeline/neu.ts', 'export const ok = 1\nexport const b = [1,2]\n')
  git('add', 'pipeline/neu.ts')
  const rot = lauf()
  assert.equal(rot.status, 1, rot.stderr)
  assert.match(rot.stderr, /pipeline\/neu\.ts:2 Leerzeichen nach , fehlt/)
  assert.doesNotMatch(rot.stderr, /alt\.ts/, 'nicht gestagte Datei bleibt außen')

  // Gelesen wird der Index, nicht die Arbeitskopie: Arbeitskopie repariert, Index weiter kaputt.
  schreibe('pipeline/neu.ts', 'export const ok = 1\n')
  assert.equal(lauf().status, 1, 'Index zählt, nicht die Arbeitskopie')

  schreibe('pipeline/neu.ts', 'export const x =await g()\n')
  git('add', 'pipeline/neu.ts')
  assert.match(lauf().stderr, /pipeline\/neu\.ts:1 Leerzeichen nach = fehlt/)

  schreibe('pipeline/neu.ts', 'export const x = await g()\n')
  git('add', 'pipeline/neu.ts')
  assert.equal(lauf().status, 0, 'saubere Datei')

  schreibe('.github/workflows/a.yml', 'run: echo a>>$GITHUB_OUTPUT\n')
  schreibe('daten/x.json', '{"a":[1,2]}\n')
  schreibe('tools/archiv/alt.mjs', 'const x =1\n')
  git('add', '-A')
  git('reset', '-q', 'pipeline/alt.ts')
  const yml = lauf()
  assert.equal(yml.status, 1)
  assert.match(yml.stderr, /\.github\/workflows\/a\.yml:1 Leerzeichen an >> fehlt/)
  assert.doesNotMatch(yml.stderr, /archiv|x\.json/, 'Archiv und Nicht-Quelle bleiben außen')

  git('rm', '-q', '-f', '.github/workflows/a.yml')
  assert.equal(lauf().status, 0, 'gelöschte Datei wird nicht geprüft')
  assert.deepEqual(gestagteQuellen((...a) => git(...a)).sort(), ['pipeline/neu.ts'], 'Auswahl: Quelle ja, Archiv und JSON nein')

  // Quelle außerhalb der Ordner (scripts/): gestagt, aber nicht Sache dieser Prüfung.
  schreibe('scripts/x.ts', 'export const x =await g()\n')
  git('add', 'scripts/x.ts')
  assert.equal(lauf().status, 0, 'Quelle außerhalb der Ordner bleibt außen')
  assert.ok(!gestagteQuellen((...a) => git(...a)).includes('scripts/x.ts'), 'Ordnerfilter')

  // Committete, dann gelöschte Datei: der Index kennt sie nicht mehr, `git show :datei` würde abstürzen.
  git('rm', '-q', '-f', 'pipeline/weg.ts')
  const geloescht = lauf()
  assert.equal(geloescht.status, 0, `committete, dann gelöschte Datei: ${geloescht.stderr}`)
  assert.ok(!gestagteQuellen((...a) => git(...a)).includes('pipeline/weg.ts'), 'Löschung nicht in der Auswahl')

  // --einrichten schreibt die Prüfung in den Hook.
  mkdirSync(path.join(wurzel, 'tools'), { recursive: true })
  copyFileSync(path.join(tools, 'quellen-commit-wache.sh'), path.join(wurzel, 'tools/quellen-commit-wache.sh'))
  const einrichten = spawnSync('bash', ['tools/quellen-commit-wache.sh', '--einrichten'], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60000 })
  assert.equal(einrichten.status, 0, einrichten.stderr)
  const hook = readFileSync(path.join(wurzel, '.git/hooks/pre-commit'), 'utf8')
  assert.match(hook, /node tools\/leerzeichen-gestagt-pruefen\.mjs/, 'Leerzeichen-Prüfung im Hook')
  assert.match(hook, /umfang-pruefen\.mjs/, 'bisherige Prüfung bleibt')
  console.log('leerzeichen-gestagt: ok (rot mit Datei:Zeile, sauber grün, Arbeitskopie/Archiv/gelöscht außen, Hook)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
