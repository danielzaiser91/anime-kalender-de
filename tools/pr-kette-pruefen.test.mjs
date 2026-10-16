/**
 * Test zu `tools/pr-kette-pruefen.mjs`: die echte Datei ist grün, jede Fixture-Verfälschung ist rot.
 * Aufruf: node tools/pr-kette-pruefen.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { pruefeKette } from './pr-kette-pruefen.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const lesen = () => parse(readFileSync(resolve(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8'))
const { scripts } = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8'))

assert.deepEqual(pruefeKette(lesen(), scripts), [], 'echte Kette muss grün sein')

/** Verfälschte Kopie der echten Kette; `aendere` bekommt das Dokument. */
function fall(beschreibung, aendere, muster) {
  const doc = lesen()
  aendere(doc)
  const fehler = pruefeKette(doc, scripts).join('\n')
  assert.match(fehler, muster, `${beschreibung}: muss rot sein, war: ${fehler || 'grün'}`)
}

const sammler = (doc) => Object.values(doc.jobs).find((j) => j.name === 'PR-Prüfkette')
const ohneLogik = (d) => { d.jobs.logik.steps = d.jobs.logik.steps.filter((s) => !/check:logic/.test(s.run ?? '')) }
fall('Prüfung fehlt', ohneLogik, /"check:logic" läuft 0-mal/)
fall('Prüfung doppelt', (d) => { d.jobs.typen.steps.push({ run: 'npm run check:logic' }) }, /"check:logic" läuft 2-mal/)
fall('Sammeljob verliert needs', (d) => { sammler(d).needs = sammler(d).needs.slice(1) }, /fehlt in needs/)
fall('Sammeljob ohne always()', (d) => { sammler(d).if = "${{ !startsWith(github.head_ref, 'daten/') }}" }, /always\(\)/)
fall('Sammeljob prüft nichts', (d) => { sammler(d).steps = [{ run: 'echo ok' }] }, /nicht auf success/)
fall('Sammeljob umbenannt', (d) => { sammler(d).name = 'Kette' }, /Kein Job mit dem Namen/)
fall('neuer Teiljob nicht in needs', (d) => { d.jobs.neu = { name: 'Kette – neu', steps: [{ run: 'echo' }] } }, /"neu" fehlt in needs/)
fall('Sammeljob ohne Ergebnisprüfung', (d) => { sammler(d).steps = [{ run: 'echo "$NEEDS"', env: { NEEDS: '${{ toJSON(needs) }}' } }] }, /nicht auf success/)
fall('needs nennt unbekannten Job', (d) => { sammler(d).needs.push('gibtsnicht') }, /unbekannten Job "gibtsnicht"/)
fall('Teiljob ruft vor-commit zusätzlich auf', (d) => { d.jobs.typen.steps.push({ run: 'npm run check:vor-commit' }) }, /"check:install" läuft 2-mal/)
fall('Sammeljob liest needs nicht', (d) => { sammler(d).steps = [{ run: "jq -e '.result == \"success\"' x" }] }, /nicht auf success/)
console.log('pr-kette-pruefen.test: grün')
