/**
 * Ablauftest des Schritts „Arbeitslisten und Prüfstand neu erzeugen" aus bestand-bauen.yml (`run` und `env` aus der YAML, npm als Attrappe).
 * Anlass (18.10.2026): Scheiterte `data:extension-liste` auf dem Hauptweg, blieb das ohne jede Meldung (`continue-on-error`);
 * nur `commit-data.sh` machte den seltenen Neuaufbau-Weg rot.
 */
import assert from 'node:assert/strict'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const tools = dirname(fileURLToPath(import.meta.url))
const wf = parse(readFileSync(join(tools, '../.github/workflows/bestand-bauen.yml'), 'utf8'))
const schritte = wf.jobs.bauen.steps.filter((s) => s.name === 'Arbeitslisten und Prüfstand neu erzeugen')
assert.equal(schritte.length, 1, 'genau ein Schritt „Arbeitslisten und Prüfstand neu erzeugen"')
const schritt = schritte[0]
const SKRIPTE = ['data:vorschlaege', 'data:dub-checks', 'data:extension-liste', 'data:start-liste']

// Das gemeinsame Ziel, das auch der PR-Datenbau fährt, nennt genau dieselben Skripte in derselben Reihenfolge wie die Schleife des Bestandsbaus.
const pkg = JSON.parse(readFileSync(join(tools, '../package.json'), 'utf8'))
assert.equal(pkg.scripts['data:arbeitslisten'], SKRIPTE.map((s) => `npm run ${s}`).join(' && '), 'data:arbeitslisten = die vier Skripte der Schleife')
for (const s of SKRIPTE) assert.ok(schritt.run.includes(s), `${s} steht in der Schleife des Bestandsbaus`)

const ordner = mkdtempSync(join(tmpdir(), 'listen-schritt-'))

/** `scheitert`: Name des npm-Skripts, das mit Exit 1 endet (oder ''); `vorher`: bereits gesetzte DATEN_WARNUNG. */
function lauf({ scheitert, vorher = '' }) {
  const arbeit = join(ordner, `arbeit-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(arbeit, 'bin'), { recursive: true })
  const spur = join(arbeit, 'spur.txt')
  const envDatei = join(arbeit, 'github-env.txt')
  writeFileSync(spur, '')
  writeFileSync(envDatei, '')
  const npm = join(arbeit, 'bin', 'npm')
  writeFileSync(npm, `#!/usr/bin/env bash\necho "$2" >> "${spur}"\n[ "$2" = "${scheitert}" ] && { echo "Abbruch in $2"; exit 1; }\nexit 0\n`)
  chmodSync(npm, 0o755)
  const env = { ...process.env, ...schritt.env, GITHUB_ENV: envDatei, PATH: `${join(arbeit, 'bin')}${delimiter}${process.env.PATH}` }
  if (vorher) env.DATEN_WARNUNG = vorher
  else delete env.DATEN_WARNUNG
  const r = spawnMitLimit('bash', ['-e', '-o', 'pipefail', '-c', schritt.run], { cwd: arbeit, encoding: 'utf8', env })
  return { status: r.status, ausgabe: r.stdout, env: readFileSync(envDatei, 'utf8').trim(), spur: readFileSync(spur, 'utf8').trim().split('\n') }
}

try {
  assert.equal(schritt['continue-on-error'], true, 'ein Scheitern hält den Bau nicht an (die Meldung kommt über DATEN_WARNUNG)')

  const gruen = lauf({ scheitert: '' })
  assert.equal(gruen.status, 0, 'alle vier grün: Exit 0')
  assert.equal(gruen.env, '', 'alle vier grün: keine Warnung')
  assert.deepEqual(gruen.spur, SKRIPTE, 'alle vier laufen, in dieser Reihenfolge')

  for (const [i, skript] of SKRIPTE.entries()) {
    const rot = lauf({ scheitert: skript })
    assert.notEqual(rot.status, 0, `${skript} scheitert: der Schritt endet rot`)
    assert.equal(rot.env, `DATEN_WARNUNG=Arbeitslisten nicht neu erzeugt: ${skript}`, `${skript}: Warnung nennt das Skript`)
    assert.match(rot.ausgabe, new RegExp(`^::error::${skript} ist gescheitert`, 'm'), `${skript}: Fehlerzeile im Schrittlog`)
    assert.match(rot.ausgabe, new RegExp(`^Abbruch in ${skript}$`, 'm'), `${skript}: Rohausgabe steht im Schrittlog`)
    assert.deepEqual(rot.spur, SKRIPTE.slice(0, i + 1), `${skript}: die folgenden Skripte laufen nicht mehr`)
  }

  const mitVorher = lauf({ scheitert: 'data:extension-liste', vorher: 'Anderes' })
  assert.equal(mitVorher.env, 'DATEN_WARNUNG=Anderes · Arbeitslisten nicht neu erzeugt: data:extension-liste', 'vorhandene Warnung bleibt vorn')
  console.log('bestand-listen-schritt: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
