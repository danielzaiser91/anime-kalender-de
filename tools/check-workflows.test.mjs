/**
 * Prozess-Test für tools/check-workflows.mjs (check:workflows): Das Werkzeug liest `.github/workflows` aus
 * dem Arbeitsordner, andere Prüfungen über den Ort des Skripts. Der Test baut deshalb einen Wegwerf-Ordner mit Kopien
 * von Workflows, `tools/` und `package.json` (`pipeline/` und `node_modules` verknüpft), je Fall genau eine Probe-Datei.
 * Gut = Exit 0, kaputt = Exit 1 mit der erwarteten Meldung. Kein Netz, keine Uhr.
 */
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(fileURLToPath(new URL('..', import.meta.url)))
const temp = mkdtempSync(join(tmpdir(), 'check-workflows-'))
mkdirSync(join(temp, '.github'))
cpSync(join(wurzel, '.github/workflows'), join(temp, '.github/workflows'), { recursive: true })
symlinkSync(join(wurzel, 'pipeline'), join(temp, 'pipeline'), 'junction')
symlinkSync(join(wurzel, 'node_modules'), join(temp, 'node_modules'), 'junction')
cpSync(join(wurzel, 'tools'), join(temp, 'tools'), { recursive: true, filter: (q) => !/[\\/]tools[\\/](testdaten|archiv)$/.test(q) })
cpSync(join(wurzel, 'package.json'), join(temp, 'package.json'))
const werkzeug = join(temp, 'tools/check-workflows.mjs')
const probe = join(temp, '.github/workflows/zz-probe.yml')

const KOPF = 'name: Probe\non: workflow_dispatch\n'
const job = (env, schritte) =>
  `${KOPF}jobs:\n  a:\n    runs-on: ubuntu-latest\n${env}    steps:\n${schritte}`
const CHECKOUT = '      - uses: actions/checkout@v4\n'
const ZWECK = '    env:\n      LAUF_ZWECK: x\n      LAUF_ZIEL: y\n'
const MELDEN = '      - name: Melden\n        continue-on-error: true\n        run: bash $RUNNER_TEMP/lauf-melden.sh anmelden\n'

let faelle = 0
function lauf(inhalt) {
  faelle++
  if (inhalt === null) rmSync(probe, { force: true })
  else writeFileSync(probe, inhalt)
  const r = spawnSync(process.execPath, [werkzeug], { cwd: temp, encoding: 'utf8', timeout: 60000 })
  assert.ok(r.status !== null, `Werkzeug lief nicht bis zum Ende: ${r.error ?? r.stderr}`)
  return r
}
const gut = (name, inhalt) => {
  const r = lauf(inhalt)
  assert.equal(r.status, 0, `${name}: sollte grün sein\n${r.stderr}`)
  assert.match(r.stdout, /✓ oder-true:/, `${name}: Schlusszeile fehlt, Lauf endete nicht regulär`)
}
const rot = (name, inhalt, muster) => {
  const r = lauf(inhalt)
  assert.equal(r.status, 1, `${name}: sollte Exit 1 liefern\n${r.stdout}${r.stderr}`)
  assert.match(r.stderr, muster, `${name}: Meldung fehlt`)
  assert.match(r.stderr, /Problem\(e\) in den Workflow-Dateien/, `${name}: Schlusszeile fehlt`)
}

try {
  gut('echter Bestand ohne Probe', null)
  gut('gültiger Minimal-Workflow', job('', `${CHECKOUT}      - run: echo hallo\n`))

  rot('kein gültiges YAML', `${KOPF}jobs:\n  a:\n    steps:\n      - run: bash x.sh "a: b"\n`, /zz-probe\.yml: kein gültiges YAML/)
  rot('kein name', 'on: workflow_dispatch\njobs: {}\n', /zz-probe\.yml: kein `name`/)
  rot('kein on-Block', 'name: Probe\njobs: {}\n', /zz-probe\.yml: kein `on`-Block/)

  gut('Melden mit Checkout, Zweck, Ziel', job(ZWECK, CHECKOUT + MELDEN))
  rot('Melden ohne Checkout', job(ZWECK, MELDEN), /Job "a" meldet den Laufstatus, hat aber keinen Auscheckvorgang/)
  rot('Meldeschritt ohne continue-on-error', job(ZWECK, CHECKOUT + MELDEN.replace('        continue-on-error: true\n', '')), /Der Meldeschritt hat kein `continue-on-error: true`/)
  rot('Melden ohne LAUF_ZWECK', job('    env:\n      LAUF_ZIEL: y\n', CHECKOUT + MELDEN), /setzt aber kein LAUF_ZWECK/)
  rot('Melden ohne LAUF_ZIEL', job('    env:\n      LAUF_ZWECK: x\n', CHECKOUT + MELDEN), /setzt aber kein LAUF_ZIEL/)

  const npm = '      - name: Lauf\n        env:\n          LAUF_TOKEN: t\n        run: npm run data:probe\n'
  gut('Pipeline-Schritt mit LAUF_TOKEN', job(ZWECK, CHECKOUT + MELDEN + npm))
  rot('Pipeline-Schritt ohne LAUF_TOKEN', job(ZWECK, CHECKOUT + MELDEN + npm.replace('        env:\n          LAUF_TOKEN: t\n', '')), /Pipeline-Schritt ohne LAUF_TOKEN/)

  rot('commit-data.sh außerhalb des Bestandsbaus', job('', `${CHECKOUT}      - run: bash tools/commit-data.sh x\n`), /zz-probe\.yml ruft commit-data\.sh auf/)
  rot('quellen-pr.sh ohne eigene Gruppe', job('', `${CHECKOUT}      - run: bash tools/quellen-pr.sh x\n`), /reicht Pull Requests ein, hat aber keine eigene Concurrency-Gruppe/)
  gut('quellen-pr.sh mit eigener Gruppe', `${KOPF}concurrency:\n  group: probe-gruppe\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${CHECKOUT}      - run: bash tools/quellen-pr.sh x\n`)

  const geduldet = (skript) => job('', `${CHECKOUT}      - name: Geduldet\n        continue-on-error: true\n        run: npx tsx ${skript}\n`)
  rot('geduldeter Schritt ohne Wachhund', geduldet('pipeline/adn-zuordnen.ts'), /darf scheitern \(continue-on-error\), aber pipeline\/adn-zuordnen\.ts meldet sich nirgends/)
  gut('geduldeter Schritt mit Wachhund', geduldet('pipeline/belege-lesen.ts'))
  gut('geduldeter Schritt mit Vorfall-Meldung (meldeAbbruch ohne recordSource)', geduldet('pipeline/termine-pruefen.ts'))

  rot('|| true ohne Eintrag in der Ausnahmeliste', job('', `${CHECKOUT}      - run: echo x || true\n`), /zz-probe\.yml: `echo x \|\| true` verschluckt einen Fehler/)

  // Ausnahmen der Token-Regel: data:historie meldet keinen Fortschritt.
  const historie = npm.replace('data:probe', 'data:historie').replace('        env:\n          LAUF_TOKEN: t\n', '')
  gut('data:historie braucht kein LAUF_TOKEN', job(ZWECK, CHECKOUT + MELDEN + historie))
  rot('check:-Schritt ohne LAUF_TOKEN', job(ZWECK, CHECKOUT + MELDEN + historie.replace('data:historie', 'check:probe')), /Pipeline-Schritt ohne LAUF_TOKEN/)

  // commit-data.sh meldet zwei Verstöße: falscher Workflow und falsche Gruppe.
  const commit = lauf(job('', `${CHECKOUT}      - run: bash tools/commit-data.sh x\n`))
  assert.match(commit.stderr, /schreibt auf main, steht aber in der Gruppe "keine" statt "bau"/)
  rot('quellen-pr.sh in Gruppe bau', `${KOPF}concurrency:\n  group: bau\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${CHECKOUT}      - run: bash tools/quellen-pr.sh x\n`, /Concurrency-Gruppe \(gefunden: "bau"\)/)

  // Veränderte Kopien der echten Dateien im Wegwerf-Ordner (Probe-Datei bleibt weg).
  const aendere = (datei, fn) => {
    const pfad = join(temp, datei)
    const alt = readFileSync(pfad, 'utf8')
    const neu = fn(alt)
    assert.notEqual(neu, alt, `${datei}: Änderung wirkungslos`)
    writeFileSync(pfad, neu)
    return () => writeFileSync(pfad, alt)
  }
  let zurueck = aendere('.github/workflows/delta-wache.yml', (t) => t.replaceAll('actions/cache/save@', 'actions/cache/saveX@'))
  rot('delta-wache sichert den Vortagsstand nicht', null, /delta-wache\.yml: der Vortagsstand .* wird nicht wiederhergestellt/)
  zurueck()
  zurueck = aendere('.github/workflows/delta-wache.yml', (t) => t.replace('      - name: Vortagsstand sichern\n        if: always()\n', '      - name: Vortagsstand sichern\n'))
  rot('delta-wache sichert nur im grünen Lauf', null, /delta-wache\.yml: der Vortagsstand .* nicht mit `if: always\(\)` gesichert/)
  zurueck()
  zurueck = aendere('package.json', (t) => t.replace('"scripts": {', '"scripts": {\n    "data:zzprobe": "echo x",'))
  rot('data:-Skript in keinem Workflow', null, /npm-Skript "data:zzprobe" steht in keinem Workflow/)
  zurueck()
  zurueck = aendere('tools/quellen-liste.sh', () => '# leer\n')
  rot('Pipeline-Ziel fehlt in quellen-liste.sh', null, /wird von der Pipeline geschrieben, steht aber nicht in tools\/quellen-liste\.sh/)
  zurueck()
  gut('Kopien zurückgesetzt', null)
} finally {
  unlinkSync(join(temp, 'pipeline'))
  unlinkSync(join(temp, 'node_modules'))
  rmSync(temp, { recursive: true, force: true })
}
console.log(`check-workflows.test: ${faelle} Fälle grün (YAML, name, on, Melden, LAUF_*, Gruppen, Wachhund, || true)`)
