// Zeitlimit für Kindprozesse der Wachphase (tools/kind-mit-limit.mjs): Fehlerzeile bei Hänger, Durchreichen anderer Fehler,
// und die Verdrahtung: die Wachphase (laeufe-aufraeumen --trocken) endet mit einem hängenden gh und nennt es klar.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legeGhAttrappe } from './gh-attrappe.mjs'
import { LIMIT_EINZEL_MS, LIMIT_SKRIPT_MS, LIMIT_STAPEL_MS, LIMIT_TEST_MS, abbruchText, ghStapel, mitLimit, spawnMitLimit } from './kind-mit-limit.mjs'

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

// 4. Tests (spawnMitLimit): Standardfrist 120 s, Optionen kommen an, ETIMEDOUT wird zur FEHLER-Zeile, Exit ≠ 0 bleibt ein Ergebnis.
assert.equal(LIMIT_TEST_MS, 120_000)
const spawnGesehen = []
const spawnAttrappe = (ergebnis) => (b, a, o) => (spawnGesehen.push(o), ergebnis)
assert.deepEqual(spawnMitLimit('bash', ['-e'], { cwd: 'x' }, { ausfuehren: spawnAttrappe({ status: 0 }) }), { status: 0 })
const linux = process.platform !== 'win32'
assert.deepEqual(spawnGesehen[0], { cwd: 'x', windowsHide: true, timeout: 120_000, ...(linux ? { detached: true } : {}) })
spawnMitLimit('bash', [], {}, { limitMs: 5000, ausfuehren: spawnAttrappe({ status: 0 }) })
assert.equal(spawnGesehen[1].timeout, 5000)
spawnMitLimit('bash', [], {}, { limitMs: 0, ausfuehren: spawnAttrappe({ status: 0 }) })
assert.equal('timeout' in spawnGesehen[2], false)
assert.equal('detached' in spawnGesehen[2], false, 'ohne Frist keine eigene Gruppe')
const hing = { status: null, error: Object.assign(new Error('spawnSync bash ETIMEDOUT'), { code: 'ETIMEDOUT' }) }
assert.throws(() => spawnMitLimit('bash', ['-e', 'schritt.sh', 'x'], {}, { limitMs: 7000, ausfuehren: spawnAttrappe(hing) }), { message: 'FEHLER: bash -e schritt.sh hing länger als 7 s' })
const exit3 = { status: 3, stderr: 'kaputt', error: undefined }
assert.equal(spawnMitLimit('bash', [], {}, { ausfuehren: spawnAttrappe(exit3) }).status, 3)
// Echter Hänger, auch mit Enkelprozess, der den Ausgabekanal offen hält (Bash startet sleep): bricht nach der Frist ab.
const echt = (args) => spawnMitLimit(process.execPath, args, { encoding: 'utf8' }, { limitMs: 700 })
assert.throws(() => echt(['-e', 'setTimeout(()=>{},1e6)']), { message: /^FEHLER: .* hing länger als 1 s$/ })
const enkel = "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},20000)'],{stdio:'inherit'});setTimeout(()=>{},1e6)"
assert.throws(() => echt(['-e', enkel]), { message: /^FEHLER: .* hing länger als 1 s$/ })

// 5. Prozessbaum (Prüfer 2536 A3): Fristablauf beendet die Gruppe des Kindes (Linux/CI); eingespeist und mit echtem Enkel.
const beendet = []
const mitPid = { ...hing, pid: 4242 }
if (linux) {
  assert.throws(() => spawnMitLimit('bash', [], {}, { limitMs: 7000, ausfuehren: spawnAttrappe(mitPid), beendeGruppe: (pid) => beendet.push(pid) }), /hing länger/)
  assert.deepEqual(beendet, [4242])
  spawnMitLimit('bash', [], {}, { limitMs: 7000, ausfuehren: spawnAttrappe({ status: 0, pid: 4243 }), beendeGruppe: (pid) => beendet.push(pid) })
  assert.deepEqual(beendet, [4242], 'ohne Fristablauf keine Gruppe beenden')
  const keineGruppe = Object.assign(new Error('weg'), { code: 'ESRCH' })
  assert.throws(() => spawnMitLimit('bash', [], {}, { limitMs: 7000, ausfuehren: spawnAttrappe(mitPid), beendeGruppe: () => { throw keineGruppe } }), /hing länger/, 'ESRCH (Gruppe schon weg) bleibt die FEHLER-Zeile')
  const anderer = Object.assign(new Error('nein'), { code: 'EPERM' })
  assert.throws(() => spawnMitLimit('bash', [], {}, { limitMs: 7000, ausfuehren: spawnAttrappe(mitPid), beendeGruppe: () => { throw anderer } }), (e) => e === anderer)
}
const pidDatei = join(mkdtempSync(join(tmpdir(), 'kind-baum-')), 'enkel.pid')
const mitEnkel = `const g = require('child_process').spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' }); require('fs').writeFileSync(${JSON.stringify(pidDatei)}, String(g.pid)); setInterval(()=>{},1000)`
assert.throws(() => spawnMitLimit(process.execPath, ['-e', mitEnkel], { encoding: 'utf8' }, { limitMs: 2000 }), /hing länger als 2 s/)
const enkelPid = Number(readFileSync(pidDatei, 'utf8'))
const lebt = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
if (linux) {
  for (let i = 0; i < 50 && lebt(enkelPid); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  assert.equal(lebt(enkelPid), false, 'Enkelprozess läuft nach Fristablauf nicht mehr')
} else {
  console.log('kind-mit-limit: Prozessbaum-Ende übersprungen (win32: Enkel überlebt, siehe Kommentar an spawnMitLimit)')
  if (lebt(enkelPid)) process.kill(enkelPid)
}
rmSync(join(pidDatei, '..'), { recursive: true, force: true })
console.log('kind-mit-limit: spawnMitLimit ok (Standardfrist, Optionen, ETIMEDOUT, Exit ≠ 0, echter Hänger, Enkelprozess)')
