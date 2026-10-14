// Prüft `pruefeVerwaiste` (check:handbelege): Ein Handbeleg ohne Titel bricht ab, im Vergleichsmodus (Ersatz-Cache, BAU_VERGLEICH=1) warnt er nur.
// Die Umgebungsvariable wird beim Laden von `bau-widerspruch.ts` gelesen — deshalb je Fall ein eigener Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

const skript = `
const { pruefeVerwaiste, findeVerwaiste } = await import('./pipeline/lib/handbeleg-verwaist.ts')
const [checks, bekannt] = JSON.parse(process.argv[1])
console.log('VERWAIST ' + findeVerwaiste(checks, new Set(bekannt)).length)
pruefeVerwaiste(checks, new Set(bekannt))
console.log('WEITER')
`

function lauf(checks, bekannt, vergleich) {
  const env = { ...process.env }
  delete env.BAU_VERGLEICH
  if (vergleich) env.BAU_VERGLEICH = '1'
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', skript, JSON.stringify([checks, bekannt])], {
    cwd: wurzel,
    env,
    encoding: 'utf8',
  })
}

const fehlt = { anilistId: 179950, platform: 'crunchyroll', title: 'Fehlt im Ersatz-Bestand' }
const bewusst = { anilistId: 7, platform: 'netflix', nichtImBestand: true }
const bekannt = { anilistId: 1, platform: 'netflix' }

const normal = lauf([fehlt, bewusst, bekannt], [1], false)
assert.match(normal.stdout, /VERWAIST 1/, 'nur der Beleg ohne Titel und ohne nichtImBestand zählt')
assert.equal(normal.status, 1, `Normalmodus: Exit 1 erwartet, war ${normal.status}\n${normal.stderr}`)
assert.ok(!normal.stdout.includes('WEITER'), 'Normalmodus darf nicht weiterlaufen')
assert.match(normal.stderr, /179950/)

const vergleich = lauf([fehlt, bewusst, bekannt], [1], true)
assert.equal(vergleich.status, 0, `Vergleichsmodus: Exit 0 erwartet, war ${vergleich.status}\n${vergleich.stderr}`)
assert.ok(vergleich.stdout.includes('WEITER'), 'Vergleichsmodus muss weiterlaufen')
assert.match(vergleich.stderr, /179950/, 'die Warnung nennt den Beleg weiterhin')
assert.match(vergleich.stderr, /Vergleichsmodus/)

for (const modus of [false, true]) {
  const sauber = lauf([bewusst, bekannt], [1], modus)
  assert.equal(sauber.status, 0, 'ohne verwaisten Beleg nie Abbruch')
  assert.ok(sauber.stdout.includes('WEITER'))
}
console.log('handbeleg-verwaist.test: ok')
