/**
 * Test für .github/workflows/mutationsprobe.yml: Aufbau aus der YAML (Eingaben, Rechte, Reihenfolge)
 * und die Schritte `run` zur Laufzeit in bash — Eingabeprüfung, Mutationslauf mit Ergebnisdatei und Exit-Code,
 * Kommentar mit gefälschtem `gh` (Aufruf und Fall ohne Ergebnis).
 */
import assert from 'node:assert/strict'
import { spawnMitLimit } from './kind-mit-limit.mjs'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

const WURZEL = join(import.meta.dirname, '..')
const wf = parse(readFileSync(join(WURZEL, '.github/workflows/mutationsprobe.yml'), 'utf8'))
const mutation = wf.jobs.mutation
const kommentar = wf.jobs.kommentar
const schritt = (job, name) => {
  const s = job.steps.find((x) => x.name === name)
  assert.ok(s, `Schritt fehlt: ${name}`)
  return s
}

// Aufbau
assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch'])
assert.deepEqual(Object.keys(wf.on.workflow_dispatch.inputs), ['zweig', 'liste', 'test', 'pr', 'kopf', 'timeout'])
for (const n of ['zweig', 'liste']) assert.equal(wf.on.workflow_dispatch.inputs[n].required, true, n)
for (const n of ['test', 'kopf']) assert.equal(wf.on.workflow_dispatch.inputs[n].required, false, `${n} optional`)
assert.equal(wf['run-name'], 'Mutationsprobe ${{ inputs.liste }} @ ${{ inputs.kopf }}', 'Lauftitel, an dem der Prüfer den Lauf findet')
assert.deepEqual(wf.permissions, { contents: 'read' })
assert.equal(mutation.permissions, undefined, 'der Lauf des Zweig-Codes bekommt nur contents: read')
assert.deepEqual(kommentar.permissions, { 'pull-requests': 'write' })
assert.equal(kommentar.needs, 'mutation')
assert.match(kommentar.if, /inputs\.pr != ''/)
assert.match(kommentar.if, /always\(\)/)
assert.equal(mutation.steps.find((s) => s.uses?.startsWith('actions/checkout'))?.with.ref, '${{ inputs.kopf || inputs.zweig }}')
assert.ok(kommentar.steps.every((s) => !s.uses?.startsWith('actions/checkout')), 'Kommentar-Job lädt keinen Zweig-Code')
for (const job of [mutation, kommentar]) {
  for (const s of job.steps) assert.ok(!/\$\{\{/.test(s.run ?? ''), `Ausdruck in run (nur über env): ${s.name}`)
}

// Einrichten mit Chromium: Node, npm ci und Browser stecken in der Action; sie steht nach dem Checkout und vor dem Lauf
const einrichtenIdx = mutation.steps.findIndex((s) => s.uses === './.github/actions/einrichten')
assert.ok(einrichtenIdx > mutation.steps.findIndex((s) => s.uses?.startsWith('actions/checkout')), 'Einrichten nach dem Checkout')
assert.ok(einrichtenIdx < mutation.steps.findIndex((s) => s.name === 'Mutanten einspielen und Tests laufen lassen'), 'Einrichten vor dem Lauf')
assert.equal(mutation.steps[einrichtenIdx].with.playwright, 'true', 'Chromium wird installiert')
assert.equal(mutation.steps[einrichtenIdx].with.cache, 'aus')

// Laufzeit
const dir = mkdtempSync(join(tmpdir(), 'mutprobe-'))
const bash = (script, env, cwd) =>
  spawnMitLimit('bash', ['-c', script], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true })
try {
  const pruefen = schritt(mutation, 'Eingaben prüfen').run
  const gut = { PR: '12', TIMEOUT: '300', LISTE: 'tools/mutationen/x.json', KOPF: '' }
  assert.equal(bash(pruefen, gut, dir).status, 0)
  assert.equal(bash(pruefen, { ...gut, KOPF: 'a'.repeat(40) }, dir).status, 0, 'ein SHA ist erlaubt')
  for (const kopf of ['a'.repeat(39), 'a'.repeat(41), 'G'.repeat(40), `${'a'.repeat(39)};`]) {
    assert.equal(bash(pruefen, { ...gut, KOPF: kopf }, dir).status, 2, `kopf ${kopf}`)
  }
  assert.equal(bash(pruefen, { ...gut, PR: '' }, dir).status, 0, 'ohne PR ist erlaubt')
  for (const schlecht of [{ PR: '1; echo' }, { TIMEOUT: '' }, { TIMEOUT: '5s' }, { LISTE: '../x.json' }, { LISTE: '/etc/x.json' }]) {
    assert.equal(bash(pruefen, { ...gut, ...schlecht }, dir).status, 2, JSON.stringify(schlecht))
  }

  // Mutationslauf mit der echten Läufer-Datei in einer Wegwerf-Kopie
  const arbeit = join(dir, 'arbeit')
  mkdirSync(join(arbeit, 'tools'), { recursive: true })
  copyFileSync(join(WURZEL, 'tools/mutationslaeufer.mjs'), join(arbeit, 'tools/mutationslaeufer.mjs'))
  writeFileSync(join(arbeit, 'a.txt'), 'wert=1\n')
  writeFileSync(join(arbeit, 'pruef.mjs'), "import{readFileSync as r}from'node:fs';process.exit(r('a.txt','utf8').includes('wert=1')?0:1)\n")
  const rot = { name: 'rot', datei: 'a.txt', suche: 'wert=1', ersetze: 'wert=2' }
  const grün = { name: 'grün', datei: 'a.txt', suche: 'a', ersetze: 'a' }
  const lauf = (liste, test = 'node pruef.mjs') => {
    writeFileSync(join(arbeit, 'liste.json'), JSON.stringify(liste))
    const temp = join(dir, `temp-${Math.random().toString(36).slice(2)}`)
    mkdirSync(temp)
    const summary = join(temp, 'summary.md')
    const r = bash(schritt(mutation, 'Mutanten einspielen und Tests laufen lassen').run, {
      LISTE: 'liste.json',
      TEST: test,
      TIMEOUT: '60',
      ZWEIG: 'feat/x',
      RUNNER_TEMP: temp,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_SERVER_URL: 'https://github.example',
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_RUN_ID: '77',
    }, arbeit)
    return { ...r, ergebnis: readFileSync(join(temp, 'mutation', 'ergebnis.md'), 'utf8'), summary: readFileSync(summary, 'utf8') }
  }
  const alleRot = lauf([rot])
  assert.equal(alleRot.status, 0, alleRot.stdout + alleRot.stderr)
  assert.match(alleRot.ergebnis, /^## Mutationsprobe für `feat\/x` \(`liste\.json`\)\n\nExit 0 /)
  assert.match(alleRot.ergebnis, /actions\/runs\/77/)
  assert.match(alleRot.ergebnis, /Kopf: `unbekannt`\./, 'ohne Git-Stand steht „unbekannt“, nie eine leere Angabe')
  assert.match(alleRot.ergebnis, /\| rot /)
  assert.equal(alleRot.summary, alleRot.ergebnis, 'Zusammenfassung = Ergebnis')
  // Leerer Standardtest (Prüfer-Lauf): jeder Mutant trägt eigene tests, der Läufer bekommt kein „--test“.
  const eigene = lauf([{ ...rot, tests: ['node pruef.mjs'] }], '')
  assert.equal(eigene.status, 0, eigene.stdout + eigene.stderr)
  assert.match(eigene.ergebnis, /\| rot /)
  assert.equal(lauf([rot], '').status, 2, 'ohne Standardtest und ohne eigene tests bleibt es ein Aufruffehler')
  const ueberlebt = lauf([rot, grün])
  assert.equal(ueberlebt.status, 1, 'ein Überlebender macht den Lauf rot')
  assert.match(ueberlebt.ergebnis, /\nExit 1 /)
  assert.match(ueberlebt.ergebnis, /GRÜN|grün/i)
  const grundrot = lauf([{ name: 'x', datei: 'a.txt', suche: 'wert=1', ersetze: 'wert=2', tests: ['node -e "process.exit(1)"'] }])
  assert.equal(grundrot.status, 2, 'roter Grundlauf = Exit 2')
  assert.match(grundrot.ergebnis, /\nExit 2 /)
  assert.ok(grundrot.ergebnis.includes('Grundlauf ohne Mutation ist rot'), 'ohne Tabelle steht das Log-Ende im Ergebnis')
  assert.equal(readFileSync(join(arbeit, 'a.txt'), 'utf8'), 'wert=1\n', 'Datei nach allen Läufen zurückgesetzt')
  // Im Git-Stand trägt das Ergebnis den echten Kopf-SHA (der Prüfer ordnet den Kommentar daran dem Push zu).
  const git = (...a) => spawnMitLimit('git', a, { cwd: arbeit, encoding: 'utf8', windowsHide: true })
  git('init', '-q')
  git('add', '-A')
  git('-c', 'user.email=t@example.org', '-c', 'user.name=t', 'commit', '-q', '-m', 'x')
  const sha = git('rev-parse', 'HEAD').stdout.trim()
  assert.match(sha, /^[0-9a-f]{40}$/)
  assert.ok(lauf([rot]).ergebnis.includes(`Kopf: \`${sha}\`. Lauf:`), 'Kopf-SHA im Ergebnis')

  // Kommentar mit gefälschtem gh
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "$@" > "$GH_PROTOKOLL"\ncat "$5" >> "$GH_PROTOKOLL"\n')
  chmodSync(join(bin, 'gh'), 0o755)
  const kommentiere = (mitErgebnis) => {
    const k = mkdtempSync(join(dir, 'k-'))
    if (mitErgebnis) {
      mkdirSync(join(k, 'ergebnis'))
      writeFileSync(join(k, 'ergebnis', 'ergebnis.md'), '## Tabelle\n')
    }
    const protokoll = join(k, 'gh.txt')
    const r = bash(schritt(kommentar, 'Am PR kommentieren').run, {
      PATH: `${bin}:${process.env.PATH}`,
      GH_PROTOKOLL: protokoll,
      PR: '12',
      GITHUB_SERVER_URL: 'https://github.example',
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_RUN_ID: '77',
    }, k)
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.ok(existsSync(protokoll), 'gh wurde nicht aufgerufen')
    return readFileSync(protokoll, 'utf8')
  }
  const mit = kommentiere(true)
  assert.match(mit, /^pr comment 12 --body-file ergebnis\/ergebnis\.md\n## Tabelle/)
  const ohne = kommentiere(false)
  assert.match(ohne, /^pr comment 12 --body-file ergebnis\/ergebnis\.md\n## Mutationsprobe ohne Ergebnis/)
  assert.match(ohne, /actions\/runs\/77/)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('mutationsprobe-workflow.test: ok (Aufbau, Eingabeprüfung 5 Fehlformen, Lauf rot/Überlebender/Grundlauf rot, Kommentar mit und ohne Ergebnis)')
