// Prüft `brichAbBeiWiderspruch`: Normalmodus beendet den Bau mit Exit 1, `BAU_VERGLEICH=1` warnt nur und läuft weiter.
// Die Umgebungsvariable wird beim Laden des Moduls gelesen — deshalb je Fall ein eigener Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

const skript = `
const { brichAbBeiWiderspruch } = await import('./pipeline/lib/bau-widerspruch.ts')
brichAbBeiWiderspruch(JSON.parse(process.argv[1]), 'Testschluss.')
console.log('WEITER')
`

function lauf(fehler, vergleich) {
  const env = { ...process.env }
  delete env.BAU_VERGLEICH
  if (vergleich) env.BAU_VERGLEICH = '1'
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', skript, JSON.stringify(fehler)], {
    cwd: wurzel,
    env,
    encoding: 'utf8',
  })
}

const normal = lauf(['kaputt A', 'kaputt B'], false)
assert.equal(normal.status, 1, `Normalmodus: Exit 1 erwartet, war ${normal.status}\n${normal.stderr}`)
assert.ok(!normal.stdout.includes('WEITER'), 'Normalmodus darf nicht weiterlaufen')
assert.match(normal.stderr, /✖ kaputt A/)
assert.match(normal.stderr, /2 Testschluss\./)

const vergleich = lauf(['kaputt A'], true)
assert.equal(vergleich.status, 0, `Vergleichsmodus: Exit 0 erwartet, war ${vergleich.status}\n${vergleich.stderr}`)
assert.ok(vergleich.stdout.includes('WEITER'), 'Vergleichsmodus muss weiterlaufen')
assert.match(vergleich.stderr, /⚠ Widerspruch \(Vergleichsmodus\):.*kaputt A/)

for (const modus of [false, true]) {
  const leer = lauf([], modus)
  assert.equal(leer.status, 0, 'ohne Widerspruch nie Abbruch')
  assert.ok(leer.stdout.includes('WEITER'))
}
console.log('bau-widerspruch.test: ok')
