// Zeitlimit für Kindprozesse der Wachphase (tools/kind-mit-limit.mjs): Fehlerzeile bei Hänger, Durchreichen anderer Fehler,
// und die Verdrahtung: die Wachphase (laeufe-aufraeumen --trocken) endet mit einem hängenden gh und nennt es klar.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legeGhAttrappe } from './gh-attrappe.mjs'
import { LIMIT_EINZEL_MS, LIMIT_SKRIPT_MS, LIMIT_STAPEL_MS, abbruchText, ghStapel, mitLimit } from './kind-mit-limit.mjs'

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

// 2b. Stapel: der Stapelaufruf nimmt das Stapel-Limit (nicht das Einzel-Limit), ein Hänger wird zur FEHLER-Zeile.
assert.equal(LIMIT_EINZEL_MS, 15_000)
assert.equal(LIMIT_STAPEL_MS, 30_000)
assert.equal(LIMIT_SKRIPT_MS, 90_000)
const stapelOpt = []
const stapelAntwort = ghStapel([['a'], ['b']], { ausfuehren: (b, a, o) => (stapelOpt.push(o), '[{"ok":true,"aus":"x"}]') })
assert.deepEqual(stapelAntwort, [{ ok: true, aus: 'x' }])
assert.equal(stapelOpt[0].timeout, 30_000)
assert.equal(stapelOpt[0].input, '[["a"],["b"]]')
assert.throws(() => ghStapel([['a']], { ausfuehren: () => { throw zeitueberschreitung } }), { message: /^FEHLER: .*gh-stapel\.mjs nach 30 s abgebrochen$/ })
// Abschlusstext: Zeitlimit ohne Stack, anderer Fehler mit Stack.
assert.equal(abbruchText(new Error('FEHLER: gh x nach 15 s abgebrochen')), 'FEHLER: gh x nach 15 s abgebrochen')
const anderer = new Error('kaputt')
assert.equal(abbruchText(anderer), anderer.stack)

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
  assert.match(r.stdout, /^Rote Sammler-PRs nicht lesbar: FEHLER: gh pr list nach 2 s abgebrochen$/m)
  // Im Hänger-Fall beginnt die Zeile nicht mit „FEHLER:“: bestand-rot-alarm und rote-sammler-prs setzen ihren Text davor.
  assert.match(r.stdout, /^ALARM\? Läufe des Bestandsbaus nicht lesbar: FEHLER: gh run list nach 2 s abgebrochen$/m)
  assert.match(r.stdout, /^ALARM\? Läufe des Deploys nicht lesbar: FEHLER: gh run list nach 2 s abgebrochen$/m)
  assert.match(r.stdout, /^WACHE nicht geprüft: Bestandsbau \(FEHLER: gh run list nach 2 s abgebrochen\)$/m)
  assert.match(r.stdout, /^WEICH\? Schrittprüfung ausgefallen: (\d+) von \1 Workflows nicht lesbar, erster Grund: FEHLER: .*gh-stapel\.mjs nach 2 s abgebrochen$/m)
  // „WACHE ruhig“ steht trotzdem da, nennt aber nur die geprüften Teile (Quellen); die ungeprüften stehen als „nicht geprüft“.
  assert.match(r.stdout, /^WACHE ruhig: 1 Prüfungen ohne Alarm \(Quellen\)$/m)

  // 4. Abschluss-Catch: kein gh-Aufruf der Wache wirft heute bis dorthin durch (alle fangen selbst); ein geworfenes
  // „FEHLER: …“ aus main() (hier über Date.now im Skript) endet als stderr-Zeile ohne Stack und mit Exit 1.
  const wirft = 'const j=Date.now;Date.now=()=>{if(!new Error().stack.includes("laeufe-aufraeumen.mjs"))return j();throw new Error("FEHLER: gh run list nach 2 s abgebrochen")};globalThis.fetch=async()=>new Response("[]",{status:200})'
  const a = spawnSync(process.execPath, ['--import', `data:text/javascript,${wirft}`, werkzeug, '--trocken'], { encoding: 'utf8', timeout: 120_000, env: { ...process.env, ...ghEnv, WACHE_LIMIT_MS: '2000' } })
  assert.equal(a.status, 1, `Exit 1 beim Abschluss-Fehler: ${a.stdout}`)
  assert.equal(a.stderr.trim(), 'FEHLER: gh run list nach 2 s abgebrochen')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('kind-mit-limit: ok (Optionen, ETIMEDOUT, anderer Fehler, echter Hänger, Wachphase mit hängendem gh, Stapel-Limit, Abschluss-Catch)')
