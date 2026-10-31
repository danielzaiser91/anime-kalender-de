// Prozess-Test: tools/wache-woechentlich.mjs als Hauptskript, gh durch eine Attrappe ersetzt, im Wegwerf-Ordner.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const quelle = resolve(import.meta.dirname)
const wurzel = mkdtempSync(join(tmpdir(), 'wache-prozess-'))
mkdirSync(join(wurzel, 'tools'))
for (const f of ['wache-woechentlich.mjs', 'wache-fristen.mjs', 'wache-woechentlich-gh-attrappe.mjs', 'kind-mit-limit.mjs']) copyFileSync(join(quelle, f), join(wurzel, 'tools', f))

function lauf(stunden) {
  const r = spawnSync(process.execPath, ['tools/wache-woechentlich.mjs', '--trocken'], {
    cwd: wurzel,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    env: { ...process.env, WACHE_GH_SKRIPT: join(wurzel, 'tools', 'wache-woechentlich-gh-attrappe.mjs'), ATTRAPPE_STUNDEN: stunden, npm_config_offline: 'true' },
  })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}

try {
  const alt = lauf('refresh-hourly.yml=4')
  assert.match(alt, /refresh-hourly\.yml: letzter erfolgreicher Lauf vor 4 h, erlaubt 3 h/)
  assert.match(alt, /::warning title=Wochenwache::refresh-hourly\.yml: letzter erfolgreicher Lauf vor 4 h/)
  const frisch = lauf('refresh-hourly.yml=2')
  assert.doesNotMatch(frisch, /refresh-hourly\.yml: letzter erfolgreicher Lauf/)
  assert.match(frisch, /refresh-hourly\.yml\s+letzter Erfolg vor 2\.0 h \(erlaubt 3 h\)/)
  const bauen = lauf('bestand-bauen.yml=9')
  assert.match(bauen, /bestand-bauen\.yml: letzter erfolgreicher Lauf vor 9 h, erlaubt 8 h/)
  console.log('wache-woechentlich-prozess: Hauptskript mit gh-Attrappe, stündlich 4 h -> Meldung, 2 h -> keine, bestand-bauen 9 h -> Meldung: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
