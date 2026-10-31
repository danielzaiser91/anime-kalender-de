// Zweiter Schnitt des Zeitlimits (nach kind-mit-limit.test.mjs): wache-woechentlich, wache-urteil-dossier und pr-nachrechnen
// bekommen ein hängendes gh (Ersatz-gh ohne Antwort) und müssen mit der FEHLER-Zeile enden, nicht hängen.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { legeGhAttrappe } from './gh-attrappe.mjs'

const tools = fileURLToPath(new URL('.', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'wache-haenger-'))
const wurzel = mkdtempSync(join(tmpdir(), 'wache-haenger-w-'))
try {
  mkdirSync(join(wurzel, 'tools'))
  for (const f of ['wache-woechentlich.mjs', 'wache-fristen.mjs', 'kind-mit-limit.mjs']) copyFileSync(join(tools, f), join(wurzel, 'tools', f))
  const env = { ...process.env, ...legeGhAttrappe(dir), WACHE_LIMIT_MS: '2000', npm_config_offline: 'true' }
  const lauf = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30_000, env })

  // 1. pr-nachrechnen: erster gh-Aufruf hängt -> Exit 2 und FEHLER-Zeile.
  const nach = lauf([join(tools, 'pr-nachrechnen.mjs'), '1'], tools)
  assert.equal(nach.status, 2, `pr-nachrechnen endet mit 2: ${nach.stderr}`)
  assert.match(nach.stdout, /pr-nachrechnen: FEHLER FEHLER: gh pr view nach 2 s abgebrochen/)

  // 2. Dossier: jede gh-Quelle nennt den Hänger als Zeile, der Lauf endet.
  const code = `const {sammle}=await import(${JSON.stringify(pathToFileURL(join(tools, 'wache-urteil-dossier.mjs')).href)});console.log(sammle().map(([n,t])=>n+'|'+t).join('\\n#\\n'))`
  const dossier = lauf(['--input-type=module', '-e', code], wurzel)
  assert.equal(dossier.status, 0, dossier.stderr)
  assert.match(dossier.stdout, /FEHLER beim Sammeln: FEHLER: gh run list nach 2 s abgebrochen/)

  // 3. Wochenwache: Exit 0 bleibt (Wache rot machen nur Sammler), der Hänger steht als Zeile da.
  const woche = lauf([join(wurzel, 'tools', 'wache-woechentlich.mjs'), '--trocken'], wurzel)
  assert.equal(woche.status, 0, `wache-woechentlich endet mit 0: ${woche.stderr}`)
  assert.match(`${woche.stdout}${woche.stderr}`, /FEHLER: gh run list nach 2 s abgebrochen/)

  // 4. Daten-Detektiv hängt (Ersatzskript statt npx tsx): eigene Zeile mit dem Zeitlimit, Wache endet mit 0.
  const haengt = join(dir, 'haengt.mjs')
  writeFileSync(haengt, 'setInterval(() => {}, 1000)\n')
  const schnell = join(dir, 'schnell.mjs')
  writeFileSync(schnell, 'process.exit(1)\n')
  const detektiv = spawnSync(process.execPath, [join(wurzel, 'tools', 'wache-woechentlich.mjs'), '--trocken'], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 30_000, env: { ...env, WACHE_GH_SKRIPT: schnell, WACHE_DETEKTIV_SKRIPT: haengt } })
  assert.equal(detektiv.status, 0, `Wochenwache mit hängendem Detektiv endet mit 0: ${detektiv.stderr}`)
  assert.match(`${detektiv.stdout}${detektiv.stderr}`, /Daten-Detektiv: Lauf fehlgeschlagen \(FEHLER: .*haengt\.mjs nach 2 s abgebrochen\)/)

  // 5. Dossier-Kindskript hängt: laufe() gibt die FEHLER-Zeile zurück, kein Exit-Code-Anhang, der Lauf endet.
  const laufeCode = `const {laufe}=await import(${JSON.stringify(pathToFileURL(join(tools, 'wache-urteil-dossier.mjs')).href)});console.log('ERGEBNIS['+laufe(${JSON.stringify(haengt)})+']')`
  const kind = lauf(['--input-type=module', '-e', laufeCode], wurzel)
  assert.equal(kind.status, 0, kind.stderr)
  assert.match(kind.stdout, /^ERGEBNIS\[FEHLER: .*haengt\.mjs nach 2 s abgebrochen\]$/m)
  assert.doesNotMatch(kind.stdout, /Exit-Code/)
} finally {
  rmSync(dir, { recursive: true, force: true })
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('wache-limit-haenger: ok (pr-nachrechnen Exit 2, Dossier-Quelle, Wochenwache mit hängendem gh, hängender Daten-Detektiv, hängendes Dossier-Kindskript)')
