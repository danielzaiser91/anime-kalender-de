/**
 * Gegenprobe zum Wächter in `tools/check-logic-alle.mjs` (`tools/bestand-sperre.cjs`): Eine Prüfung in `check:logic` darf `public/data` nicht lesen.
 * Je Fall eine kleine Liste mit einer Wegwerf-Prüfung; erwartet wird Ablehnung oder Annahme. Aufruf: node tools/check-logic-ohne-bestand.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'ohne-bestand-'))
const ABLEHNUNG = 'darf den gebauten Bestand nicht lesen'

const LIEST_BESTAND = "import { readFileSync } from 'node:fs'\nreadFileSync('public/data/titles.json', 'utf8')\n"
const LIEST_ANDERES = "import { readFileSync } from 'node:fs'\nreadFileSync('package.json', 'utf8')\n"
const LIEST_IM_UNTERPROZESS =
  "import { spawnSync } from 'node:child_process'\n" +
  "const r = spawnSync(process.execPath, ['-e', \"require('fs').readFileSync('public/data/titles.json')\"], { stdio: 'inherit' })\n" +
  'process.exit(r.status)\n'

/** Fährt den Runner über eine Liste mit einer Wegwerf-Prüfung; `ausnahmen` ist der Inhalt der Ausnahmeliste dazu. */
function lauf(name, quelltext, ausnahmen = (datei) => ({ hoechstens: 0, ausnahmen: [] })) {
  const datei = join(ordner, `${name}.mjs`).replace(/\\/g, '/')
  const liste = join(ordner, `${name}-liste.txt`)
  const ausnahmenDatei = join(ordner, `${name}-ausnahmen.json`)
  writeFileSync(datei, quelltext)
  writeFileSync(liste, `${datei}\n`)
  writeFileSync(ausnahmenDatei, JSON.stringify(ausnahmen(datei)))
  const r = spawnSync(process.execPath, [join(WURZEL, 'tools/check-logic-alle.mjs'), liste, 'check:logic'], {
    cwd: WURZEL,
    encoding: 'utf8',
    env: { ...process.env, BESTAND_AUSNAHMEN: ausnahmenDatei },
  })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

const ausnahme = (datei, extra = {}) => ({ datei, erlaubt: ['public/data/titles.json'], grund: 'Test', seit: '2026-10-12', bis: '2099-01-01', ...extra })

try {
  const liest = lauf('liest', LIEST_BESTAND)
  assert.notEqual(liest.status, 0, 'eine Prüfung, die public/data liest, wird abgelehnt')
  assert.match(liest.text, new RegExp(ABLEHNUNG), 'die Ablehnung nennt den Grund')

  const unterprozess = lauf('unterprozess', LIEST_IM_UNTERPROZESS)
  assert.notEqual(unterprozess.status, 0, 'auch das Lesen in einem Unterprozess wird abgelehnt')
  assert.match(unterprozess.text, new RegExp(ABLEHNUNG), 'die Ablehnung im Unterprozess nennt den Grund')

  const gegenprobe = lauf('anderes', LIEST_ANDERES)
  assert.equal(gegenprobe.status, 0, `eine Prüfung ohne Zugriff auf public/data läuft durch: ${gegenprobe.text}`)

  const erlaubt = lauf('erlaubt', LIEST_BESTAND, (d) => ({ hoechstens: 1, ausnahmen: [ausnahme(d)] }))
  assert.equal(erlaubt.status, 0, `eine Prüfung mit Ausnahme für genau diesen Pfad läuft durch: ${erlaubt.text}`)

  const anderePfade = lauf('anderer-pfad', LIEST_BESTAND, (d) => ({ hoechstens: 1, ausnahmen: [ausnahme(d, { erlaubt: ['public/data/releases.json'] })] }))
  assert.notEqual(anderePfade.status, 0, 'die Ausnahme gilt nur für die genannten Pfade')

  const ueberfluessig = lauf('ueberfluessig', LIEST_ANDERES, (d) => ({ hoechstens: 1, ausnahmen: [ausnahme(d)] }))
  assert.notEqual(ueberfluessig.status, 0, 'eine Ausnahme, die nicht mehr gebraucht wird, muss gestrichen werden')
  assert.match(ueberfluessig.text, /streichen/, 'die Meldung sagt, dass die Ausnahme zu streichen ist')

  const abgelaufen = lauf('abgelaufen', LIEST_BESTAND, (d) => ({ hoechstens: 1, ausnahmen: [ausnahme(d, { bis: '2020-01-01' })] }))
  assert.notEqual(abgelaufen.status, 0, 'eine abgelaufene Frist macht die Prüfkette rot')

  const zuViele = lauf('zu-viele', LIEST_BESTAND, (d) => ({ hoechstens: 0, ausnahmen: [ausnahme(d)] }))
  assert.notEqual(zuViele.status, 0, 'mehr Ausnahmen als `hoechstens` sind abgelehnt')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('check-logic-ohne-bestand: ok')
