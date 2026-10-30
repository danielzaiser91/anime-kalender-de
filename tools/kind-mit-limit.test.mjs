// Zeitlimit für Kindprozesse der Wachphase (tools/kind-mit-limit.mjs): Fehlerzeile bei Hänger, Durchreichen anderer Fehler,
// und die Verdrahtung: die Wachphase (laeufe-aufraeumen --trocken) endet mit einem hängenden gh und nennt es klar.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legeGhAttrappe } from './gh-attrappe.mjs'
import { mitLimit } from './kind-mit-limit.mjs'

// 1. Eingespeister Ausführer: Optionen kommen an (Limit, windowsHide), ETIMEDOUT wird zur FEHLER-Zeile.
const gesehen = []
const ok = mitLimit('gh', ['run', 'list', '--x'], { encoding: 'utf8' }, { limitMs: 7000, ausfuehren: (b, a, o) => (gesehen.push([b, a, o]), 'antwort') })
assert.equal(ok, 'antwort')
assert.deepEqual(gesehen[0][2], { encoding: 'utf8', windowsHide: true, timeout: 7000 })
const zeitueberschreitung = Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' })
assert.throws(() => mitLimit('gh', ['run', 'list', '--x'], {}, { limitMs: 7000, ausfuehren: () => { throw zeitueberschreitung } }), { message: 'FEHLER: gh run list nach 7 s abgebrochen' })
// Ein anderer Fehler (Exit 1) bleibt, was er war: kein falsches „abgebrochen“.
const exit1 = Object.assign(new Error('Command failed'), { status: 1 })
assert.throws(() => mitLimit('gh', ['x'], {}, { ausfuehren: () => { throw exit1 } }), (e) => e === exit1)

// 2. Echter hängender Kindprozess: endet nach dem Limit mit der FEHLER-Zeile.
assert.throws(() => mitLimit(process.execPath, ['-e', 'setTimeout(()=>{},1e6)'], {}, { limitMs: 700 }), { message: /^FEHLER: .*node.* -e setTimeout.* nach 1 s abgebrochen$/ })

// 3. Verdrahtung: hängendes gh in der Wachphase → klare Zeile, die Wache läuft weiter und endet.
const dir = mkdtempSync(join(tmpdir(), 'kind-limit-'))
try {
  const ghEnv = legeGhAttrappe(dir)
  const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', 'data:text/javascript,globalThis.fetch=async()=>new Response("[]",{status:200})', werkzeug, '--trocken'], {
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, ...ghEnv, WACHE_LIMIT_MS: '2000' },
  })
  assert.equal(r.status, 0, `Wache lief bis zum Ende: ${r.stderr}`)
  assert.match(r.stdout, /Rote Sammler-PRs nicht lesbar: FEHLER: gh pr list nach 2 s abgebrochen/)
  assert.match(r.stdout, /WACHE ruhig/, 'der Rest der Wache lief weiter')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('kind-mit-limit: ok (Optionen, ETIMEDOUT, anderer Fehler, echter Hänger, Wachphase mit hängendem gh)')
