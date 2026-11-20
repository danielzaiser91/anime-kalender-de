/**
 * Test zur Freigabe ohne Modell (Mod-Schnellweg, 20.11.2026) in .github/workflows/pr-pruefer.yml:
 * der Schritt „Prüfstufe“ meldet `nur-mod` genau bei Stufe 0 mit `nurMod: true` (echtes bash mit den Zeilen aus der Workflow-Datei),
 * der Schritt „Freigabe ohne Modell (nur Mod)“ schreibt Urteil und Protokoll für genau den Kopf, und jeder Modellschritt entfällt bei `nur-mod`.
 * Aufruf: node tools/pr-pruefer-nur-mod.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

const wf = parse(readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
const schritte = wf.jobs.pruefen.steps
const schritt = (name) => {
  const treffer = schritte.filter((s) => s.name === name)
  assert.equal(treffer.length, 1, `genau ein Schritt „${name}“`)
  return treffer[0]
}
const modell = schritte.filter((s) => String(s.uses ?? '').startsWith('anthropics/claude-code-action'))
assert.equal(modell.length, 3, 'drei Modellschritte')
for (const s of modell) assert.ok(String(s.if).includes("steps.stufe.outputs.nur-mod != '1'"), `${s.name}: entfällt bei nur-mod`)

const ohneModell = schritt('Freigabe ohne Modell (nur Mod)')
assert.equal(ohneModell.if, "steps.kette.outputs.laeuft != 'ja' && steps.stufe.outputs.nur-mod == '1'", 'läuft nur bei nur-mod und beendeter Kette')
const idx = (s) => schritte.indexOf(s)
assert.ok(idx(schritt('Kette läuft noch')) < idx(ohneModell), 'nach „Kette läuft noch“ (sonst überschriebe der Platzhalter das Urteil)')
assert.ok(idx(ohneModell) < Math.min(...modell.map(idx)), 'vor den Modellschritten')
assert.ok(idx(ohneModell) < idx(schritt('Check-Stand des Kopfes')) && idx(schritt('Check-Stand des Kopfes')) < idx(schritt('Protokoll und Freigabe')), 'Check-Stand und Freigabe folgen')

const wurzel = mkdtempSync(join(tmpdir(), 'pr-pruefer-nur-mod-'))
/** Führt `run` mit bash aus und verlangt Exit 0. */
function bash(run, env) {
  const r = spawnSync('bash', ['-c', run], { env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  assert.equal(r.status, 0, `bash-Exit 0 erwartet: ${r.stderr}`)
}
try {
  const posix = (p) => p.replaceAll('\\', '/')
  // Prüfstufe: nur der Teil, der `nur-mod` setzt (ab „nurmod=0“ bis zur Ausgabezeile)
  const stufeRun = schritt('Prüfstufe').run
  const teil = /^\s*nurmod=0\n[\s\S]*?echo "nur-mod=\$nurmod" >> "\$GITHUB_OUTPUT"/m.exec(stufeRun)?.[0]
  assert.ok(teil, 'Abschnitt nur-mod im Schritt Prüfstufe gefunden')
  const nurMod = (json) => {
    const t = join(wurzel, 'p')
    rmSync(t, { recursive: true, force: true })
    spawnSync('bash', ['-c', `mkdir -p "${posix(t)}"`], { timeout: 60_000, windowsHide: true })
    if (json !== null) writeFileSync(join(t, 'stufe.json'), json)
    const ausgabe = join(wurzel, 'out.txt')
    writeFileSync(ausgabe, '')
    bash(teil, { T: posix(t), GITHUB_OUTPUT: posix(ausgabe) })
    return readFileSync(ausgabe, 'utf8').trim()
  }
  assert.equal(nurMod('{"stufe":0,"nurMod":true}'), 'nur-mod=1', 'Stufe 0 und nurMod')
  assert.equal(nurMod('{"stufe":1,"nurMod":true}'), 'nur-mod=0', 'nurMod bei Stufe 1: Modell prüft')
  assert.equal(nurMod('{"stufe":0,"nurMod":false}'), 'nur-mod=0', 'Stufe 0 ohne nurMod (Doku): Modell prüft')
  assert.equal(nurMod('{"stufe":0}'), 'nur-mod=0', 'Feld fehlt')
  assert.equal(nurMod('{"stufe":0,"nurMod":"true"}'), 'nur-mod=0', 'Zeichenkette zählt nicht')
  assert.equal(nurMod('kaputt'), 'nur-mod=0', 'kein JSON')
  assert.equal(nurMod(null), 'nur-mod=0', 'Datei fehlt')

  // Freigabe ohne Modell: Urteil für genau den Kopf, Protokoll nicht leer
  const kopf = 'a'.repeat(40)
  bash(`mkdir -p "${posix(join(wurzel, 'pruefer'))}"`, {})
  bash(ohneModell.run, { RUNNER_TEMP: posix(wurzel), HEAD_SHA: kopf })
  const urteil = JSON.parse(readFileSync(join(wurzel, 'pruefer', 'urteil.json'), 'utf8'))
  assert.deepEqual(urteil, { urteil: 'ok', sha: kopf })
  assert.match(readFileSync(join(wurzel, 'pruefer', 'protokoll.md'), 'utf8'), /nur Mod arbeitsliste.*kein Modellaufruf/)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('pr-pruefer-nur-mod: nur-mod-Weiche, Freigabe ohne Modell und Wegfall der Modellschritte grün')
