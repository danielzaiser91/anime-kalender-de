/**
 * Ablauftest des Schritts „Datenqualität messen" aus bestand-bauen.yml (`run` und `env` aus der YAML, npm als Attrappe):
 * Eine Zeile `STREAMING_RUECKGANG …` der Messung wird zur DATEN_WARNUNG, der Exit-Code der Messung bleibt erhalten.
 * Die Zeile selbst erzeugt `pipeline/check-qualitaet.ts` (Prozesstest `pipeline/check-qualitaet-rueckgang-lauf.ts`).
 */
import assert from 'node:assert/strict'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const wf = parse(readFileSync(join(wurzel, '.github/workflows/bestand-bauen.yml'), 'utf8'))
const schritte = wf.jobs.bauen.steps.filter((s) => s.name === 'Datenqualität messen')
assert.equal(schritte.length, 1, 'genau ein Schritt')
const schritt = schritte[0]
const ordner = mkdtempSync(join(tmpdir(), 'qualitaet-schritt-'))

function lauf({ npmAusgabe, exit, vorher = '' }) {
  const arbeit = join(ordner, `arbeit-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(arbeit, 'bin'), { recursive: true })
  const envDatei = join(arbeit, 'github-env.txt')
  writeFileSync(envDatei, '')
  writeFileSync(join(arbeit, 'ausgabe.txt'), npmAusgabe)
  const npm = join(arbeit, 'bin', 'npm')
  writeFileSync(npm, `#!/usr/bin/env bash\n[ "$2" = check:qualitaet ] || exit 9\ncat "${join(arbeit, 'ausgabe.txt')}"\nexit ${exit}\n`)
  chmodSync(npm, 0o755)
  const env = { ...process.env, ...schritt.env, RUNNER_TEMP: arbeit, GITHUB_ENV: envDatei, PATH: `${join(arbeit, 'bin')}${delimiter}${process.env.PATH}` }
  if (vorher) env.DATEN_WARNUNG = vorher
  else delete env.DATEN_WARNUNG
  const r = spawnMitLimit('bash', ['-e', '-o', 'pipefail', '-c', schritt.run], { cwd: arbeit, encoding: 'utf8', env })
  return { status: r.status, ausgabe: r.stdout, env: readFileSync(envDatei, 'utf8').trim() }
}

const RUECKGANG = 'STREAMING_RUECKGANG mitStreamingWeg: 1947 → 1900 (−47, mehr als 1 % weniger als beim letzten Wert)\n'
const ZAHLEN = '[pipeline] Bestand am 2026-11-16:\n'

try {
  assert.equal(schritt['continue-on-error'], true, 'ein Scheitern hält den Bau nicht an')

  const rueck = lauf({ npmAusgabe: ZAHLEN + RUECKGANG, exit: 0 })
  assert.equal(rueck.status, 0, 'Rückgang: Messung grün, Schritt grün')
  assert.equal(rueck.env, 'DATEN_WARNUNG=Streaming-Abdeckung gesunken: mitStreamingWeg: 1947 → 1900 (−47, mehr als 1 % weniger als beim letzten Wert)', 'Rückgang setzt DATEN_WARNUNG')
  assert.match(rueck.ausgabe, /^\[pipeline\] Bestand am/m, 'Rohausgabe steht im Schrittlog')

  const still = lauf({ npmAusgabe: ZAHLEN, exit: 0 })
  assert.equal(still.status, 0, 'ohne Rückgang: Exit 0')
  assert.equal(still.env, '', 'ohne Rückgang: keine Warnung')

  const mitVorher = lauf({ npmAusgabe: RUECKGANG, exit: 0, vorher: 'Anderes' })
  assert.match(mitVorher.env, /^DATEN_WARNUNG=Anderes · Streaming-Abdeckung gesunken: /, 'vorhandene Warnung bleibt vorn')

  const hart = lauf({ npmAusgabe: '[pipeline] ⚠  verwaisteTermine: 2 — das darf nicht vorkommen\n' + RUECKGANG, exit: 1 })
  assert.equal(hart.status, 1, 'Exit-Code der Messung bleibt (harter Fehler ist weiter rot)')
  assert.match(hart.env, /^DATEN_WARNUNG=Streaming-Abdeckung gesunken/, 'Warnung auch bei hartem Fehler')
  assert.match(hart.env.split('\n').at(-1), /^DATEN_WARNUNG=Streaming-Abdeckung gesunken.* · Datenqualität hart rot: verwaisteTermine: 2$/, 'harte Zeile hängt an die Streaming-Warnung, überschreibt sie nicht')

  const nurHart = lauf({ npmAusgabe: '[pipeline] ⚠  doppelteAdressen: 3 — das darf nicht vorkommen\n[pipeline] ⚠  verwaisteTermine: 2 — das darf nicht vorkommen\n', exit: 1, vorher: 'Anderes' })
  assert.equal(nurHart.status, 1, 'nur hart: Exit 1 bleibt')
  assert.equal(nurHart.env, 'DATEN_WARNUNG=Anderes · Datenqualität hart rot: doppelteAdressen: 3;verwaisteTermine: 2', 'harte Wächter als DATEN_WARNUNG, beide Zeilen')

  const absturz = lauf({ npmAusgabe: 'Error: kaputt\n', exit: 1 })
  assert.equal(absturz.status, 1, 'Absturz: Schritt rot')
  assert.equal(absturz.env, '', 'Absturz ohne Rückgangszeile: keine Streaming-Warnung')
  console.log('bestand-qualitaet-schritt: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
