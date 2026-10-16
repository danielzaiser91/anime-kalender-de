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
const pruefSchritt = (d) => d.jobs.logik.steps.find((s) => /check:logic/.test(s.run ?? ''))
fall('Prüfschritt mit if: false', (d) => { pruefSchritt(d).if = 'false' }, /Schlüssel "if" am Schritt/)
fall('Prüfschritt mit || true', (d) => { pruefSchritt(d).run = 'npm run check:logic || true' }, /run ist nicht exakt/)
fall('Prüfschritt mit ; true', (d) => { pruefSchritt(d).run = 'npm run check:logic; true' }, /run ist nicht exakt/)
fall('Prüfschritt mit continue-on-error', (d) => { pruefSchritt(d)['continue-on-error'] = true }, /Schlüssel "continue-on-error" am Schritt/)
fall('Teiljob mit continue-on-error', (d) => { d.jobs.logik['continue-on-error'] = true }, /Job "logik": Schlüssel "continue-on-error"/)
fall('Teiljob mit if: false', (d) => { d.jobs.logik.if = '${{ false }}' }, /Teiljob "logik": if ist nicht textgleich/)
fall('Sammeljob always() && false', (d) => { sammler(d).if = '${{ always() && false }}' }, /Sammeljob: if ist nicht textgleich/)
fall('Sammeljob ohne Teiljob-Bedingung', (d) => { sammler(d).if = '${{ always() }}' }, /Sammeljob: if ist nicht textgleich/)
fall('Sammeljob mit continue-on-error', (d) => { sammler(d)['continue-on-error'] = true }, /continue-on-error/)
fall('jq -e mit || true', (d) => { const s = sammler(d).steps.at(-1); s.run = s.run.replace('> /dev/null', '|| true') }, /nicht auf success/)

// Prüfer Runde 2 (16.10.2026): Text-Muster ließen Form-Verfälschungen durch. Jede dieser Mutationen muss rot sein.
const logikSchritt = (d) => d.jobs.logik.steps.findIndex((s) => /check:logic/.test(s.run ?? ''))
const setzeRun = (d, run) => { d.jobs.logik.steps[logikSchritt(d)].run = run }
const setzeSchritt = (d, schluessel, wert) => { d.jobs.logik.steps[logikSchritt(d)][schluessel] = wert }
const ABGEFANGEN = /run ist nicht exakt/
fall('echo als Prüfung', (d) => setzeRun(d, 'echo npm run check:logic'), /"check:logic" läuft 0-mal/)
fall('Kommentar als Prüfung', (d) => setzeRun(d, '# npm run check:logic'), /"check:logic" läuft 0-mal/)
fall('run-Block mit true danach', (d) => setzeRun(d, 'npm run check:logic\ntrue\n'), ABGEFANGEN)
fall('set +e davor', (d) => setzeRun(d, 'set +e\nnpm run check:logic\n'), ABGEFANGEN)
fall('& am Ende', (d) => setzeRun(d, 'npm run check:logic &'), ABGEFANGEN)
fall('--dry-run', (d) => setzeRun(d, 'npm run check:logic --dry-run'), ABGEFANGEN)
fall('env npm_config_dry_run', (d) => setzeSchritt(d, 'env', { npm_config_dry_run: true }), /env am Schritt/)
fall('working-directory am Schritt', (d) => setzeSchritt(d, 'working-directory', 'web'), /Schlüssel "working-directory"/)
fall('shell am Schritt', (d) => setzeSchritt(d, 'shell', 'bash {0}'), /Schlüssel "shell"/)
fall('defaults.run.shell im Workflow', (d) => { d.defaults = { run: { shell: 'bash {0}' } } }, /Workflow: Schlüssel "defaults"/)
fall('defaults am Teiljob', (d) => { d.jobs.logik.defaults = { run: { shell: 'bash {0}' } } }, /Job "logik": Schlüssel "defaults"/)
fall('strategy.matrix leer', (d) => { d.jobs.logik.strategy = { matrix: { x: [] } } }, /Job "logik": Schlüssel "strategy"/)
fall('timeout-minutes: 0', (d) => { d.jobs.logik['timeout-minutes'] = 0 }, /timeout-minutes muss/)
fall('Sammeljob any statt all', (d) => { sammler(d).steps[0].run = sammler(d).steps[0].run.replace('all(', 'any(') }, /nicht auf success/)
fall('Sammeljob if: false am Schritt', (d) => { sammler(d).steps[0].if = false }, /Sammeljob: Schlüssel "if" am Schritt/)
fall('Sammeljob jq mit Kommentar', (d) => { sammler(d).steps[0].run = 'echo "$NEEDS" | jq -e \'true\' #.result == "success"' }, /nicht auf success/)
fall('Sammeljob weiterer Schritt', (d) => { sammler(d).steps.push({ run: 'true' }) }, /genau ein Schritt/)
fall('fremde Action', (d) => { d.jobs.logik.steps.push({ uses: 'evil/action@v1' }) }, /uses "evil\/action@v1" nicht erlaubt/)
fall('Sammeljob env verändert', (d) => { sammler(d).steps[0].env = { NEEDS: '[]' } }, /env ist nicht exakt/)
console.log('pr-kette-pruefen.test: grün')
