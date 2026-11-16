/**
 * Ablauftest des Schritts „Mängel melden“ aus bestand-bauen.yml (`run` aus der YAML, npm als Attrappe):
 * Zeilen `MAENGEL_NEU …` und `MAENGEL_RUECKFALL …` von `pipeline/check-maengel.ts` werden zur DATEN_WARNUNG, der Schritt bleibt grün.
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
const schritte = wf.jobs.bauen.steps.filter((s) => s.name === 'Mängel melden')
assert.equal(schritte.length, 1, 'genau ein Schritt')
const schritt = schritte[0]
const ordner = mkdtempSync(join(tmpdir(), 'maengel-schritt-'))

function lauf({ npmAusgabe, exit, vorher = '' }) {
  const arbeit = join(ordner, `arbeit-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(arbeit, 'bin'), { recursive: true })
  const envDatei = join(arbeit, 'github-env.txt')
  writeFileSync(envDatei, '')
  writeFileSync(join(arbeit, 'ausgabe.txt'), npmAusgabe)
  const npm = join(arbeit, 'bin', 'npm')
  writeFileSync(npm, `#!/usr/bin/env bash\n[ "$2" = check:maengel ] || exit 9\ncat "${join(arbeit, 'ausgabe.txt')}"\nexit ${exit}\n`)
  chmodSync(npm, 0o755)
  const env = { ...process.env, RUNNER_TEMP: arbeit, GITHUB_ENV: envDatei, PATH: `${join(arbeit, 'bin')}${delimiter}${process.env.PATH}` }
  if (vorher) env.DATEN_WARNUNG = vorher
  else delete env.DATEN_WARNUNG
  const r = spawnMitLimit('bash', ['-e', '-o', 'pipefail', '-c', schritt.run], { cwd: arbeit, encoding: 'utf8', env })
  return { status: r.status, ausgabe: r.stdout, env: readFileSync(envDatei, 'utf8').trim() }
}

const NEU = 'MAENGEL_NEU fsk: 12 (1, 2, 3, …); banner: 1 (7)\n'
const RUECK = 'MAENGEL_RUECKFALL kein-weg: 1 (495)\n'
const ZAHLEN = '[pipeline] Mängel am 2026-11-16: 3684 offen\n'

try {
  assert.equal(schritt['continue-on-error'], true, 'ein Scheitern hält den Bau nicht an')

  const neu = lauf({ npmAusgabe: ZAHLEN + NEU, exit: 0 })
  assert.equal(neu.status, 0, 'NEU: Schritt grün')
  assert.equal(neu.env, 'DATEN_WARNUNG=Mängel neu: fsk: 12 (1, 2, 3, …); banner: 1 (7)', 'NEU setzt DATEN_WARNUNG')
  assert.match(neu.ausgabe, /^\[pipeline\] Mängel am/m, 'Rohausgabe steht im Schrittlog')

  const beide = lauf({ npmAusgabe: NEU + RUECK, exit: 0, vorher: 'Anderes' })
  assert.equal(beide.status, 0, 'beide: Schritt grün')
  assert.equal(beide.env.split('\n').at(-1), 'DATEN_WARNUNG=Anderes · Mängel neu: fsk: 12 (1, 2, 3, …); banner: 1 (7) · Mängel Rückfall: kein-weg: 1 (495)', 'vorhandene Warnung bleibt vorn, beide hängen sich an')

  const nurRueck = lauf({ npmAusgabe: RUECK, exit: 0 })
  assert.equal(nurRueck.env, 'DATEN_WARNUNG=Mängel Rückfall: kein-weg: 1 (495)', 'nur Rückfall')

  const still = lauf({ npmAusgabe: ZAHLEN, exit: 0 })
  assert.equal(still.status, 0, 'ohne Ereignis: Exit 0')
  assert.equal(still.env, '', 'ohne Ereignis: keine Warnung')

  const absturz = lauf({ npmAusgabe: 'Error: kaputt\n', exit: 1 })
  assert.equal(absturz.status, 1, 'Absturz: Schritt rot (continue-on-error fängt ihn)')
  assert.equal(absturz.env, '', 'Absturz: keine Warnung')
  console.log('bestand-maengel-schritt: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
