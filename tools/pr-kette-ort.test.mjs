/**
 * Test für `tools/pr-kette-ort.mjs` (Ort jeder Prüfung): die echte Zuordnung ist grün, jede Abweichung ist rot, und der Aufruf über
 * `tools/pr-kette-pruefen.mjs <wurzel>` gibt Exit 1 samt Meldung. Die Fälle gehen von einer Kopie der echten Dateien aus (Wegwerf-Wurzel unter `os.tmpdir()`)
 * und ändern genau eine Stelle; „Nacht-Eintrag entfernt“ ist der Anlassfall (18.11.2026: Prüfung wandert still zurück in den PR).
 * Aufruf: node tools/pr-kette-ort.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { ortFehler } from './pr-kette-ort.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const wegwerf = mkdtempSync(join(tmpdir(), 'pr-kette-ort-'))
let zaehler = 0

/** Kopie der Dateien, die der Wächter liest; die Tests der echten `tools/` entstehen als leere Dateien gleichen Namens. */
function kopie() {
  const w = join(wegwerf, `k${++zaehler}`)
  mkdirSync(join(w, 'tools'), { recursive: true })
  mkdirSync(join(w, '.claude', 'hooks'), { recursive: true })
  mkdirSync(join(w, '.github', 'workflows'), { recursive: true })
  mkdirSync(join(w, '.github', 'actions', 'kette-einrichten'), { recursive: true })
  for (const d of ['package.json', 'tools/pruefung-ort.json', 'tools/check-logic-liste.txt', '.github/workflows/nacht-pruefung.yml', '.github/workflows/deploy.yml', '.github/workflows/pr-pruefung.yml', '.github/actions/kette-einrichten/action.yml']) {
    cpSync(join(WURZEL, d), join(w, d))
  }
  for (const f of readdirSync(join(WURZEL, 'tools')).filter((n) => n.endsWith('.test.mjs'))) writeFileSync(join(w, 'tools', f), '')
  for (const f of readdirSync(join(WURZEL, '.claude', 'hooks')).filter((n) => n.endsWith('-test.mjs'))) writeFileSync(join(w, '.claude', 'hooks', f), '')
  return w
}

const lies = (w, d) => readFileSync(join(w, d), 'utf8')
const schreibe = (w, d, text) => writeFileSync(join(w, d), text)
function aendereJson(w, d, f) {
  const j = JSON.parse(lies(w, d))
  f(j)
  schreibe(w, d, JSON.stringify(j, null, 2))
}
function aendereYaml(w, d, f) {
  const y = parse(lies(w, d))
  f(y)
  schreibe(w, d, stringify(y))
}

/** Ein Fall: Änderung an der Kopie, erwartet wird mindestens ein Verstoß, dessen Text `muster` trifft. */
function rot(name, aendere, muster) {
  const w = kopie()
  aendere(w)
  const fehler = ortFehler(w)
  assert.ok(fehler.some((f) => muster.test(f)), `${name}: erwartet ${muster}, gefunden: ${JSON.stringify(fehler)}`)
  console.log(`  ✓ rot: ${name}`)
}

const ersterNachtsEintrag = (j, art) => Object.keys(j[art]).find((k) => j[art][k].ort === 'nachts')

try {
  // Grün: die echte Zuordnung und eine unveränderte Kopie.
  assert.deepEqual(ortFehler(WURZEL), [], 'die echte Zuordnung ist in Ordnung')
  assert.deepEqual(ortFehler(kopie()), [], 'die unveränderte Kopie ist in Ordnung')
  console.log('  ✓ grün: echte Zuordnung und Kopie')

  // Anlassfall: Nacht-Eintrag entfernt (Logik und Tests), Zahl bleibt auf „erwartet“.
  rot('Nacht-Eintrag Logik entfernt', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => delete j.logik[ersterNachtsEintrag(j, 'logik')]), /^logik: \d+ Nacht-Einträge, erwartet \d+/)
  rot('Nacht-Eintrag Test entfernt', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => delete j.tests[ersterNachtsEintrag(j, 'tests')]), /^tests: \d+ Nacht-Einträge, erwartet \d+/)
  rot('Nacht-Eintrag ergänzt ohne „erwartet“', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => {
    const neu = lies(w, 'tools/check-logic-liste.txt').split('\n').find((z) => z.startsWith('pipeline/check-') && !(z in j.logik))
    j.logik[neu] = { ort: 'nachts', grund: 'x', beleg: 'y', deploy: false }
  }), /^logik: \d+ Nacht-Einträge, erwartet \d+/)
  rot('Nacht-Eintrag auf Prüfung, die es nicht gibt', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => (j.logik['pipeline/check-gibt-es-nicht.ts'] = { ort: 'nachts', grund: 'x', beleg: 'y', deploy: false })), /gibt es nicht/)
  rot('Test-Eintrag auf Test, den es nicht gibt', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => (j.tests['tools/gibt-es-nicht.test.mjs'] = { ort: 'nachts', grund: 'x', beleg: 'y', deploy: false })), /gibt es nicht/)
  rot('Datei fehlt', (w) => rmSync(join(w, 'tools/pruefung-ort.json')), /pruefung-ort\.json fehlt/)
  rot('fremder Schlüssel oben', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => (j.sonst = {})), /Schlüssel "sonst" nicht erlaubt/)

  // Form eines Eintrags.
  for (const [feld, wert, muster] of [
    ['grund', '', /grund fehlt/],
    ['beleg', undefined, /beleg fehlt/],
    ['deploy', undefined, /deploy \(true\/false\) fehlt/],
    ['ort', 'irgendwo', /ort muss "pr" oder "nachts" sein/],
    ['unbekannt', 1, /Schlüssel "unbekannt" nicht erlaubt/],
  ]) {
    rot(`Eintrag: ${feld} = ${JSON.stringify(wert)}`, (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => {
      const e = j.logik[ersterNachtsEintrag(j, 'logik')]
      if (wert === undefined) delete e[feld]
      else e[feld] = wert
    }), muster)
  }

  // package.json: jedes der vier Skripte in fester Form.
  for (const name of ['check:nachts-logik', 'check:nachts-tests', 'check:nachts', 'check:nachts-deploy']) {
    rot(`package.json: ${name} verändert`, (w) => aendereJson(w, 'package.json', (j) => (j.scripts[name] += ' && echo egal')), new RegExp(`package.json: ${name} muss`))
    rot(`package.json: ${name} fehlt`, (w) => aendereJson(w, 'package.json', (j) => delete j.scripts[name]), new RegExp(`package.json: ${name} muss`))
  }

  // Nacht-Workflow: Auslöser, Jobs, Ausweg.
  rot('Nacht-Workflow: zusätzlicher Auslöser', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => (y.on.schedule = [{ cron: '0 1 * * *' }])), /on muss genau workflow_dispatch sein/)
  rot('Nacht-Workflow: Job Tests fehlt', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => delete y.jobs.tests), /genau zwei Jobs/)
  rot('Nacht-Workflow: Job mit continue-on-error', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => (y.jobs.logik['continue-on-error'] = true)), /Job ohne if und continue-on-error/)
  rot('Nacht-Workflow: Job mit if', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => (y.jobs.tests.if = "${{ always() }}")), /Job ohne if und continue-on-error/)
  rot('Nacht-Workflow: Schritt mit continue-on-error', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => (y.jobs.logik.steps.at(-1)['continue-on-error'] = true)), /Prüfschritt ohne if und continue-on-error/)
  rot('Nacht-Workflow: Logik läuft doppelt, Tests nie', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => (y.jobs.tests.steps.at(-1).run = 'npm run check:nachts-logik')), /jeder Job führt genau einen Schritt aus/)
  rot('Nacht-Workflow: Schritt führt etwas anderes aus', (w) => aendereYaml(w, '.github/workflows/nacht-pruefung.yml', (y) => (y.jobs.logik.steps.at(-1).run = 'npm run check:logic')), /jeder Job führt genau einen Schritt aus/)

  // Deploy: der Schritt für Einträge mit deploy: true. Die Fälle bauen ihre Zuordnung selbst (genau ein Eintrag mit deploy: true), unabhängig von der echten Einordnung.
  const nurEinDeploy = (j) => {
    for (const art of ['logik', 'tests']) for (const e of Object.values(j[art])) if (e.ort === 'nachts') e.deploy = false
    j.logik[ersterNachtsEintrag(j, 'logik')].deploy = true
  }
  const mitDeploy = (aendere) => (w) => {
    aendereJson(w, 'tools/pruefung-ort.json', nurEinDeploy)
    aendere(w)
  }
  const zusicherungen = (y) => y.jobs.zusicherungen.steps
  const deployYaml = (f) => (w) => aendereYaml(w, '.github/workflows/deploy.yml', f)
  const ohneSchritt = (y) => (y.jobs.zusicherungen.steps = zusicherungen(y).filter((s) => s.run !== 'npm run check:nachts-deploy'))
  const gruen = kopie()
  mitDeploy(() => {})(gruen)
  assert.deepEqual(ortFehler(gruen), [], 'Fixture mit genau einem deploy-Eintrag und dem Deploy-Schritt ist grün')
  rot('Deploy: Schritt check:nachts-deploy fehlt', mitDeploy(deployYaml(ohneSchritt)), /genau einen Schritt mit "npm run check:nachts-deploy"/)
  rot('Deploy: Schritt mit continue-on-error', mitDeploy(deployYaml((y) => (zusicherungen(y).find((s) => s.run === 'npm run check:nachts-deploy')['continue-on-error'] = true))), /Schritt check:nachts-deploy ohne continue-on-error/)
  rot('Deploy: Schritt im falschen Job (pruefen statt zusicherungen)', mitDeploy(deployYaml((y) => {
    const s = zusicherungen(y).find((x) => x.run === 'npm run check:nachts-deploy')
    ohneSchritt(y)
    y.jobs.pruefen.steps.push(s)
  })), /genau einen Schritt mit "npm run check:nachts-deploy"/)
  rot('Deploy: Schritt zweimal', mitDeploy(deployYaml((y) => zusicherungen(y).push({ run: 'npm run check:nachts-deploy' }))), /genau einen Schritt mit "npm run check:nachts-deploy", gefunden 2/)
  const deploySchritt = (y) => zusicherungen(y).find((s) => s.run === 'npm run check:nachts-deploy')
  const verschiebe = (y, ziel) => {
    const s = deploySchritt(y)
    ohneSchritt(y)
    zusicherungen(y).splice(ziel(zusicherungen(y)), 0, s)
  }
  rot('Deploy: Schritt mit if: false (Sicherung still aus)', mitDeploy(deployYaml((y) => (deploySchritt(y).if = 'false'))), /if muss wortgleich/)
  rot('Deploy: Schritt mit anderem if', mitDeploy(deployYaml((y) => (deploySchritt(y).if = "${{ always() }}"))), /if muss wortgleich/)
  rot('Deploy: Schritt ohne if', mitDeploy(deployYaml((y) => delete deploySchritt(y).if)), /if muss wortgleich/)
  rot('Deploy: Job zusicherungen mit continue-on-error', mitDeploy(deployYaml((y) => (y.jobs.zusicherungen['continue-on-error'] = true))), /Job zusicherungen ohne continue-on-error/)
  rot('Deploy: Schritt hinter dem Fortschritt-Schritt', mitDeploy(deployYaml((y) => verschiebe(y, (s) => s.length))), /hinter "Zusicherungen prüfen" und vor/)
  rot('Deploy: Schritt vor „Zusicherungen prüfen“', mitDeploy(deployYaml((y) => verschiebe(y, (s) => s.findIndex((x) => x.name === 'Zusicherungen prüfen')))), /hinter "Zusicherungen prüfen" und vor/)
  rot('Deploy: Nachbarschritt „Zusicherungen prüfen“ fehlt', mitDeploy(deployYaml((y) => (y.jobs.zusicherungen.steps = zusicherungen(y).filter((s) => s.name !== 'Zusicherungen prüfen')))), /hinter "Zusicherungen prüfen" und vor/)
  rot('Deploy: Schritt am Anfang des Jobs', mitDeploy(deployYaml((y) => verschiebe(y, () => 0))), /hinter "Zusicherungen prüfen" und vor/)
  rot('Deploy: Schritt da, aber kein Eintrag mit deploy: true', (w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => {
    nurEinDeploy(j)
    j.logik[ersterNachtsEintrag(j, 'logik')].deploy = false
  }), /kein Eintrag hat deploy: true/)
  rot('Deploy: Eintrag mit deploy: true ohne Nacht-Ort', mitDeploy((w) => aendereJson(w, 'tools/pruefung-ort.json', (j) => (j.logik[ersterNachtsEintrag(j, 'logik')].ort = 'pr'))), /deploy gilt nur bei nachts/)

  // Verdrahtung im Aufrufer: `pr-kette-pruefen.mjs <wurzel>` meldet den Verstoß mit Exit 1, die echte Wurzel mit Exit 0 und Zählzeile.
  const gut = spawnSync(process.execPath, [join(WURZEL, 'tools/pr-kette-pruefen.mjs'), WURZEL], { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  assert.equal(gut.status, 0, `${gut.stdout}${gut.stderr}`)
  assert.match(gut.stdout, /Ort je Prüfung: \d+ Logik-Prüfungen und \d+ Tests nachts \(davon im Deploy: \d+ und \d+\), alle übrigen im PR/)
  const w = kopie()
  aendereJson(w, 'tools/pruefung-ort.json', (j) => delete j.tests[ersterNachtsEintrag(j, 'tests')])
  const schlecht = spawnSync(process.execPath, [join(WURZEL, 'tools/pr-kette-pruefen.mjs'), w], { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  assert.equal(schlecht.status, 1, `Exit 1 erwartet: ${schlecht.stdout}${schlecht.stderr}`)
  assert.match(schlecht.stderr, /✗ tests: \d+ Nacht-Einträge, erwartet \d+/)
  console.log('  ✓ Aufrufer: Exit 0 mit Zählzeile, Exit 1 bei entferntem Nacht-Eintrag')
  console.log(`pr-kette-ort: ok (${zaehler} Kopien, Anlassfall Nacht-Eintrag entfernt, Form, package.json, Nacht-Workflow, Deploy-Schritt, Aufrufer)`)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
