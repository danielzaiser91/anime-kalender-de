/**
 * Gegenprobe zur Listenprüfung in `tools/check-logic-alle.mjs`: Die Liste muss sortiert sein und keine Zeile doppelt führen.
 * Doppelzeilen entstehen, wenn `.gitattributes` die Liste mit `merge=union` zusammenführt (13.10.2026).
 * Aufruf: node tools/check-logic-liste.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'check-liste-'))

/** Fährt den Runner über eine Liste mit diesem Inhalt; `check:test` hat keine Bestand-Sperre, die Dateien selbst werden nie erreicht. */
function lauf(zeilen) {
  const liste = join(ordner, 'liste.txt')
  writeFileSync(liste, `${zeilen.join('\n')}\n`)
  const r = spawnSync(process.execPath, [join(WURZEL, 'tools/check-logic-alle.mjs'), liste, 'check:test'], { cwd: WURZEL, encoding: 'utf8' })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

try {
  const doppelt = lauf(['pipeline/check-a.ts', 'pipeline/check-b.ts', 'pipeline/check-b.ts'])
  assert.equal(doppelt.status, 1, 'Doppelzeile muss abbrechen')
  assert.match(doppelt.text, /mehrfach/, 'Doppelzeile wird als solche benannt')
  assert.match(doppelt.text, /pipeline\/check-b\.ts/, 'die Zeile wird genannt')

  const unsortiert = lauf(['pipeline/check-b.ts', 'pipeline/check-a.ts'])
  assert.equal(unsortiert.status, 1, 'Unsortierte Liste muss abbrechen')
  assert.match(unsortiert.text, /alphabetisch sortiert/, 'Unsortiert wird als solches benannt')
  const punktVorStrich = lauf(['pipeline/check-a.ts', 'pipeline/check-a-b.ts'])
  assert.equal(punktVorStrich.status, 1, '„.“ vor „-“ ist unsortiert (Code-Reihenfolge)')
  assert.match(punktVorStrich.text, /check-a-b\.ts steht zu früh/, 'der zu früh stehende Eintrag wird genannt')
  const hilfe = spawnSync(process.execPath, [join(WURZEL, 'tools/check-logic-alle.mjs'), '--help'], { cwd: WURZEL, encoding: 'utf8', timeout: 20000 })
  assert.equal(hilfe.status, 0, '--help endet mit 0')
  assert.match(hilfe.stdout, /^Aufruf:/, '--help druckt nur die Hilfe')
  assert.doesNotMatch(`${hilfe.stdout}${hilfe.stderr}`, /check:logic: /, '--help startet keinen Lauf')
  console.log('check-logic-liste.test: ok (Sortierfälle, --help)')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
