/**
 * Fixture-Test für tools/quittung-nach-commit-waechter.mjs: Die Schrittfolge vor dem 17.10.2026 (Rohfolgen ohne eigenen
 * Abhak-Schritt) muss rot sein, jede Verschiebung eines Quittungsschritts vor den Commit ebenso, der heutige Stand grün.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { FEST, pruefeAlle, pruefeFest, pruefeJob, pruefeWorkflow } from './quittung-nach-commit-waechter.mjs'

const s = (run, name = run) => ({ name, run })
const BAU = s('npm run data:build')
const COMMIT = s('bash tools/commit-data.sh "x"', 'commit')
const MERKEN = [s('npm run data:pruefungen -- --abhaken-spaeter'), s('npm run data:vorfaelle'), s('npm run data:rohfolgen')]
const QUITT = [s('npm run data:pruefungen -- --nur-abhaken'), s('npm run data:rohfolgen-abhaken'), s('npm run data:vorfaelle -- --nur-loeschen')]
const CHECK = s('npm run data:check')

// Gut: der Quittungsschritt in der Mitte, dahinter ein zweiter Commit (es zählt der erste).
const GUT = [...MERKEN, BAU, COMMIT, QUITT[0], CHECK, QUITT[1], QUITT[2], COMMIT]
assert.deepEqual(pruefeJob('gut', GUT), [])

// Stand vor dem Fix: kein Abhak-Schritt für die Rohfolgen, also hakt der Zuordner selbst ab.
const ALT = [...MERKEN, BAU, COMMIT, QUITT[0], QUITT[2], CHECK]
assert.match(pruefeJob('alt', ALT).join('|'), /data:rohfolgen-abhaken" nach dem Commit/)
assert.equal(pruefeJob('alt', ALT).length, 1)

// Jeder Quittungsschritt einzeln vor den Commit gezogen: rot (Quittung vor Commit und fehlende Quittung danach).
for (const q of QUITT) {
  const ohne = GUT.filter((x) => x !== q)
  const vorher = [...ohne.slice(0, 3), q, ...ohne.slice(3)]
  const fehler = pruefeJob('vorher', vorher)
  assert.ok(fehler.some((f) => f.includes('quittiert vor dem Commit')), `${q.run}: ${fehler}`)
  assert.ok(fehler.some((f) => f.includes('nach dem Commit')), `${q.run}: ${fehler}`)
}

// Merken nach dem Commit, Quittieren ohne Commit, Briefkasten-Abruf ohne Schalter.
assert.match(pruefeJob('spaet', [BAU, COMMIT, MERKEN[2], QUITT[1]]).join('|'), /merkt nach dem Commit/)
assert.match(pruefeJob('ohne', [MERKEN[2], QUITT[1]]).join('|'), /quittiert vor dem Commit/)
assert.match(pruefeJob('sofort', [CHECK, s('npm run data:pruefungen'), BAU, COMMIT]).join('|'), /ohne --abhaken-spaeter/)
assert.deepEqual(pruefeJob('trocken', [s('npm run data:pruefungen -- --trocken'), CHECK]), [])

// Festgelegte Schritte: genau diese Schlüssel, direkt hintereinander.
const fest = structuredClone(FEST)
assert.deepEqual(pruefeFest([BAU, ...fest, CHECK]), [])
assert.equal(pruefeFest([BAU, fest[0], fest[2], fest[1], fest[3]]).length, 2)
assert.equal(pruefeFest([BAU, fest[0], { ...fest[1], if: 'always()' }, fest[2], fest[3]]).length, 1)
assert.equal(pruefeFest([BAU, fest[0], fest[1], { ...fest[2], 'continue-on-error': true }, fest[3]]).length, 1)
assert.equal(pruefeFest([BAU, fest[0], fest[1], fest[2], CHECK, fest[3]]).length, 1)
assert.equal(pruefeFest([BAU, CHECK]).length, 1)
// Ein früherer Schritt gleichen Namens zählt: Die Festlegung gilt dem ersten.
assert.ok(pruefeFest([BAU, { ...fest[0], run: 'true' }, CHECK, ...fest]).length > 0)

// Die Festlegung greift nur für den Job „bauen" in bestand-bauen.yml.
const doc = (job, schritte) => ({ jobs: { vorab: { steps: [CHECK] }, [job]: { steps: schritte } } })
assert.match(pruefeWorkflow('bestand-bauen.yml', doc('bauen', GUT)).join('|'), /Änderungen committen" fehlt/)
assert.deepEqual(pruefeWorkflow('bestand-bauen.yml', doc('bauen', [BAU, ...fest])), [])
assert.deepEqual(pruefeWorkflow('anderer.yml', doc('bauen', GUT)), [])
assert.match(pruefeWorkflow('bestand-bauen.yml', doc('anders', GUT)).join('|'), /Job „bauen" fehlt/)

// Das geparste Dokument zählt, nicht der Text: Flow-Syntax und Anführungszeichen ändern nichts.
const flow = 'jobs:\n  bauen:\n    steps: [{run: "npm run data:rohfolgen"}, {run: \'bash tools/commit-data.sh "x"\'}]\n'
assert.match(pruefeWorkflow('anderer.yml', parse(flow)).join('|'), /data:rohfolgen-abhaken/)
assert.match(pruefeWorkflow('bestand-bauen.yml', parse('jobs: {}\n')).join('|'), /Job „bauen" fehlt/)

// `run: |` endet mit Zeilenumbruch: zählt wie ohne.
assert.match(pruefeJob('block', [s('npm run data:rohfolgen\n'), BAU, COMMIT, CHECK]).join('|'), /data:rohfolgen-abhaken/)

// pruefeAlle liest jede .yml und .yaml eines Ordners.
const ordner = mkdtempSync(join(tmpdir(), 'quittung-waechter-'))
try {
  writeFileSync(join(ordner, 'a.yaml'), flow)
  writeFileSync(join(ordner, 'b.yml'), flow)
  writeFileSync(join(ordner, 'c.txt'), flow)
  assert.equal(pruefeAlle(ordner).length, 2)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

assert.deepEqual(pruefeAlle(join(import.meta.dirname, '..', '.github', 'workflows')), [])
console.log('quittung-nach-commit-waechter.test: ok')
