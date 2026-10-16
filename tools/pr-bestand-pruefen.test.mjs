/**
 * Test für tools/pr-bestand-pruefen.sh (Schritt "Bestandsprüfungen" im Job PR-Datenbau). Ein falsches `npm` im PATH meldet je Aufruf Exit 0 oder 1:
 * rot muss die Kette werden, sobald eine der beiden Hälften rot ist, und beide Hälften müssen laufen (auch die zweite nach einer roten ersten).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skript = join(dirname(fileURLToPath(import.meta.url)), 'pr-bestand-pruefen.sh')
const ordner = mkdtempSync(join(tmpdir(), 'pr-bestand-'))
const spur = join(ordner, 'aufrufe.txt')
// Drei Argumentnamen dienen als Kulisse: nur `check:bestand-rest` und `check:bestand-liste` sind erlaubt, alles andere bricht den Test.
writeFileSync(join(ordner, 'npm'), `#!/bin/bash
[ "$1" = run ] || exit 9
echo "$2" >> "${spur.replaceAll('\\', '/')}"
case "$2" in
  check:bestand-rest) echo "rest-ausgabe"; [[ " $ROT " == *" rest "* ]] && exit 1 ;;
  check:bestand-liste) sleep 1; echo "liste-ausgabe"; [[ " $ROT " == *" liste "* ]] && exit 1 ;;
  *) exit 9 ;;
esac
exit 0
`)
chmodSync(join(ordner, 'npm'), 0o755)

function lauf(rot) {
  writeFileSync(spur, '')
  const r = spawnSync('bash', [skript], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${ordner.replaceAll('\\', '/')}:${process.env.PATH}`, ROT: rot, RUNNER_TEMP: ordner },
  })
  const aufrufe = readFileSync(spur, 'utf8').trim().split('\n').sort()
  return { status: r.status, aus: r.stdout + r.stderr, aufrufe }
}

for (const [rot, soll] of [['', 0], ['rest', 1], ['liste', 1], ['rest liste', 1]]) {
  const e = lauf(rot)
  assert.deepEqual(e.aufrufe, ['check:bestand-liste', 'check:bestand-rest'], `beide Hälften laufen (rot: "${rot}")`)
  assert.equal(e.status, soll, `Exit bei rot "${rot}": ${e.aus}`)
  assert.match(e.aus, /liste-ausgabe/, 'Ausgabe der Liste erscheint im Log')
  if (soll === 1) assert.match(e.aus, /::error::/)
}
console.log('pr-bestand-pruefen.test: grün')
