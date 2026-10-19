/**
 * Gegenprobe zu tools/uhr-in-tests.mjs: ein zusätzliches Vorkommen der echten Uhr in einem Test macht rot, die Ausnahme
 * `uhr-echt:` zählt nicht, `node_modules` und `_wt-*` bleiben außen vor, `--festschreiben` senkt und erhöht nie,
 * und die Grenzdatei deckt den echten Bestand.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const werkzeug = join(tools, 'uhr-in-tests.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'uhr-in-tests-'))

// Die Fundstücke werden zusammengesetzt, damit dieser Test selbst nicht gezählt wird.
const JETZT = 'Date.' + 'now()'
const NEU = 'new Date' + '()'

const lauf = (quelle, grenzen, ...optionen) => spawnSync(process.execPath, [werkzeug, '--quelle', quelle, '--grenzen', grenzen, ...optionen], { encoding: 'utf8' })

function baum(name, dateien) {
  const wurzel = join(ordner, name)
  for (const [pfad, text] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
    writeFileSync(join(wurzel, pfad), text)
  }
  return wurzel
}

const grenzen = (n) => {
  const datei = join(ordner, `grenzen-${n}.json`)
  writeFileSync(datei, JSON.stringify({ erlaubt: n }))
  return datei
}

try {
  const grund = { 'a.test.ts': `const t = ${JETZT}\n`, 'b.test.mjs': 'const t = 1\n' }
  assert.equal(lauf(baum('grund', grund), grenzen(1)).status, 0, 'genau an der Grenze grün')
  assert.equal(lauf(baum('grund', grund), grenzen(2)).status, 0, 'unter der Grenze grün')
  assert.equal(lauf(baum('grund', grund), grenzen(0)).status, 1, 'ein Vorkommen über der Grenze rot')

  for (const [datei, zeile] of [
    ['neu.test.ts', `const d = ${NEU}\n`],
    ['neu.test.mjs', `const d = ${JETZT}\n`],
    ['neu.test.cjs', `const d = ${NEU}\n`],
    ['tief/ordner/neu.test.ts', `const d = ${JETZT}\n`],
  ]) {
    const mit = baum('mit', { ...grund, [datei]: zeile })
    assert.equal(lauf(mit, grenzen(1)).status, 1, `${datei}: zusätzliche echte Uhr macht rot`)
    rmSync(mit, { recursive: true })
  }

  const zwei = baum('zwei', { 'a.test.ts': `const x = [${JETZT}, ${NEU}]\n` })
  assert.equal(lauf(zwei, grenzen(1)).status, 1, 'zwei Vorkommen in einer Zeile zählen zweimal')
  assert.equal(lauf(zwei, grenzen(2)).status, 0)

  const ausnahme = baum('ausnahme', {
    'a.test.ts': `const t = ${JETZT} // uhr-echt: misst die Wartezeit\n`,
    'a.ts': `const t = ${JETZT}\n`,
    'node_modules/x/a.test.ts': `const t = ${JETZT}\n`,
    '_wt-fremd/a.test.ts': `const t = ${JETZT}\n`,
    'b.test.ts': `const fest = new Date('2026-10-12T12:00:00Z')\n`,
  })
  assert.equal(lauf(ausnahme, grenzen(0)).status, 0, 'Ausnahme-Zeile, Nicht-Tests, node_modules, _wt-*, Datum mit Argument zählen nicht')

  const datei = grenzen(5)
  assert.equal(lauf(baum('grund', grund), datei, '--festschreiben').status, 0)
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1, '--festschreiben senkt auf den Bestand')
  const hoch = baum('hoch', { 'a.test.ts': `${JETZT}\n${JETZT}\n` })
  assert.equal(lauf(hoch, datei, '--festschreiben').status, 1, '--festschreiben erhöht nie')
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1)

  const kaputt = join(ordner, 'kaputt.json')
  writeFileSync(kaputt, '{}')
  assert.equal(lauf(baum('grund', grund), kaputt).status, 1, 'Grenzdatei ohne Zahl: rot statt stillschweigend 0')

  const echt = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8' })
  assert.equal(echt.status, 0, `der echte Bestand liegt in der Grenze: ${echt.stderr}`)
  assert.match(echt.stdout, /^Uhr in Tests in Ordnung: \d+ Vorkommen, höchstens \d+ erlaubt\.$/m)
  console.log('Alle Prüfungen grün.')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
