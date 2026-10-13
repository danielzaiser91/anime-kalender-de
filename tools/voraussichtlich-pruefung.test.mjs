// Prüft `findeVoraussichtlichOhneSchaetzung`: „voraussichtlich" in der note braucht `schedule.estimated: true`.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

const skript = `
const { findeVoraussichtlichOhneSchaetzung } = await import('./pipeline/lib/voraussichtlich-pruefung.ts')
console.log(JSON.stringify(findeVoraussichtlichOhneSchaetzung(process.env.YAML_TEXT)))
`

function lauf(yamlText) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', skript], {
    cwd: wurzel,
    env: { ...process.env, YAML_TEXT: yamlText },
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

const eintrag = (slug, note, schedule) =>
  `- slug: ${slug}\n  platform: disc\n  note: "${note}"\n  schedule: ${schedule}\n`

const ohne = '{ firstEpisodeDate: "2026-12-04" }'
const mit = '{ firstEpisodeDate: "2026-12-04", estimated: true }'

// Gegenprobe: ohne estimated rot, mit estimated grün, ohne Wort grün.
assert.deepEqual(lauf(eintrag('a', 'Voraussichtlicher Termin; Sprache offen.', ohne)), ['a'])
assert.deepEqual(lauf(eintrag('b', 'Voraussichtlicher Termin; Sprache offen.', mit)), [])
assert.deepEqual(lauf(eintrag('c', 'Termin laut Hersteller.', ohne)), [])
// Schreibweisen: Großschreibung, Beugung, Kürzel; „vsl." nur als eigenes Wort.
assert.deepEqual(lauf(eintrag('d', 'kommt VORAUSSICHTLICH im Dezember', ohne)), ['d'])
assert.deepEqual(lauf(eintrag('e', 'Termin vsl. Dezember', ohne)), ['e'])
assert.deepEqual(lauf(eintrag('f', 'Konvsl. Dezember', ohne)), [])
// Eintrag ohne Termin hat nichts zu kennzeichnen; ein Kommentar allein löst nichts aus.
assert.deepEqual(lauf('- slug: g\n  note: "voraussichtlich"\n'), [])
assert.deepEqual(lauf('# voraussichtlich\n' + eintrag('h', 'Termin laut Hersteller.', ohne)), [])
console.log('voraussichtlich-pruefung: grün')
