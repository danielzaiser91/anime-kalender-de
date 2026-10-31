/**
 * Ablauftest des Schritts „Erweiterung und Wiedervorlagen gegen die neuen Listen prüfen" aus bestand-bauen.yml
 * (`run` aus der YAML, npm als Attrappe) und seiner Lage: nach den Listen, vor dem Commit, ohne `continue-on-error`.
 * Anlass (Prüftisch 19.10.2026): check:extension und check:wiedervorlage liefen erst nach dem Commit der Listen auf main.
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
const alle = wf.jobs.bauen.steps
const NAME = 'Erweiterung und Wiedervorlagen gegen die neuen Listen prüfen'
const schritte = alle.filter((s) => s.name === NAME)
assert.equal(schritte.length, 1, 'genau ein Vorprüfungsschritt')
const schritt = schritte[0]
const PRUEFUNGEN = ['check:extension', 'check:wiedervorlage']

const lage = alle.indexOf(schritt)
const liste = alle.findIndex((s) => s.name === 'Arbeitslisten und Prüfstand neu erzeugen')
const commit = alle.findIndex((s) => s.name === 'Änderungen committen')
assert.ok(liste >= 0 && commit >= 0, 'Listen- und Commit-Schritt vorhanden')
assert.ok(lage > liste, 'nach dem Erzeugen der Listen')
assert.ok(lage < commit, 'vor dem Commit')
assert.equal(schritt['continue-on-error'], undefined, 'ein Scheitern macht den Lauf rot')
assert.equal(schritt.if, undefined, 'ohne Bedingung')

const ordner = mkdtempSync(join(tmpdir(), 'vorpruefung-schritt-'))

/** `scheitert`: Name des npm-Skripts, das mit Exit 1 endet (oder ''). */
function lauf(scheitert) {
  const arbeit = join(ordner, `arbeit-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(arbeit, 'bin'), { recursive: true })
  const spur = join(arbeit, 'spur.txt')
  writeFileSync(spur, '')
  const npm = join(arbeit, 'bin', 'npm')
  writeFileSync(npm, `#!/usr/bin/env bash\necho "$2" >> "${spur}"\n[ "$2" = "${scheitert}" ] && { echo "Abbruch in $2"; exit 1; }\nexit 0\n`)
  chmodSync(npm, 0o755)
  const env = { ...process.env, ...schritt.env, PATH: `${join(arbeit, 'bin')}${delimiter}${process.env.PATH}` }
  const r = spawnMitLimit('bash', ['-e', '-o', 'pipefail', '-c', schritt.run], { cwd: arbeit, encoding: 'utf8', env })
  return { status: r.status, ausgabe: r.stdout, spur: readFileSync(spur, 'utf8').trim().split('\n') }
}

try {
  const gruen = lauf('')
  assert.equal(gruen.status, 0, 'beide grün: Exit 0')
  assert.deepEqual(gruen.spur, PRUEFUNGEN, 'beide laufen, in dieser Reihenfolge')

  for (const [i, name] of PRUEFUNGEN.entries()) {
    const rot = lauf(name)
    assert.notEqual(rot.status, 0, `${name} rot: der Schritt endet rot`)
    assert.match(rot.ausgabe, new RegExp(`^::error::${name} ist rot`, 'm'), `${name}: Fehlerzeile im Schrittlog`)
    assert.match(rot.ausgabe, new RegExp(`^Abbruch in ${name}$`, 'm'), `${name}: Rohausgabe im Schrittlog`)
    assert.deepEqual(rot.spur, PRUEFUNGEN.slice(0, i + 1), `${name}: die folgende Prüfung läuft nicht mehr`)
  }
  console.log('bestand-vorpruefung-schritt: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
