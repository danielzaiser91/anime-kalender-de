/**
 * Fixture-Test für tools/quittung-nach-commit-waechter.mjs: Die Schrittfolge vor dem 17.10.2026 (Rohfolgen ohne eigenen
 * Abhak-Schritt) muss rot sein, jede Verschiebung eines Quittungsschritts vor den Commit ebenso, der heutige Stand grün.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { aufrufe } from './quittung-aufrufe.mjs'
import { CACHE_AUFRAEUMEN, FEST, pruefeAlle, pruefeCacheAufraeumen, pruefeFest, pruefeJob, pruefeMerkerPfade, pruefeWorkflow } from './quittung-nach-commit-waechter.mjs'

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

// Merken nach dem Commit, Quittieren ohne Commit, Briefkasten-Abruf ohne Schalter (merkt seit Runde 2 immer).
assert.match(pruefeJob('spaet', [BAU, COMMIT, MERKEN[2], QUITT[1]]).join('|'), /merkt nach dem Commit/)
assert.match(pruefeJob('ohne', [MERKEN[2], QUITT[1]]).join('|'), /quittiert vor dem Commit/)
assert.match(pruefeJob('sofort', [CHECK, s('npm run data:pruefungen'), BAU, COMMIT]).join('|'), /kein Schritt „npm run data:pruefungen -- --nur-abhaken"/)
assert.deepEqual(pruefeJob('sofort', [CHECK, s('npm run data:pruefungen'), BAU, COMMIT, QUITT[0]]), [])
// Trockenläufe merken nicht und brauchen keine Quittung.
assert.deepEqual(pruefeJob('trocken', [s('npm run data:pruefungen -- --trocken'), CHECK]), [])
assert.deepEqual(pruefeJob('trocken', [CHECK, s('npm run data:vorfaelle -- --trocken'), CHECK]), [])

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
const RESTORE = { name: 'AniList-Cache wiederverwenden', uses: 'actions/cache/restore@v4' }
const AUFRAEUMEN = structuredClone(CACHE_AUFRAEUMEN)
// Der Schritt räumt wirklich beide Ordner (der Text steht fest hier, nicht aus dem Modul) und lässt Fremdes in data/cache stehen.
assert.equal(AUFRAEUMEN.run, 'rm -rf data/cache/quittung-offen data/cache/quittung-frei')
{
  const wurzel = mkdtempSync(join(tmpdir(), 'merker-aufraeumen-'))
  for (const d of ['quittung-offen', 'quittung-frei', 'anilist']) mkdirSync(join(wurzel, 'data/cache', d), { recursive: true })
  for (const d of ['quittung-offen', 'quittung-frei', 'anilist']) writeFileSync(join(wurzel, 'data/cache', d, 'x.json'), '[1]')
  const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', AUFRAEUMEN.run], { cwd: wurzel, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readdirSync(join(wurzel, 'data/cache')), ['anilist'])
  rmSync(wurzel, { recursive: true, force: true })
}
assert.deepEqual(pruefeWorkflow('bestand-bauen.yml', doc('bauen', [RESTORE, AUFRAEUMEN, BAU, ...fest])), [])

// Aufräumschritt nach dem Cache-Restore: fehlt, verschoben, geändert oder ohne Restore: je rot (Bauer 1426, Prüfer R1).
assert.deepEqual(pruefeCacheAufraeumen([RESTORE, AUFRAEUMEN, BAU]), [])
assert.equal(pruefeCacheAufraeumen([RESTORE, BAU]).length, 1)
assert.equal(pruefeCacheAufraeumen([RESTORE, BAU, AUFRAEUMEN]).length, 1)
assert.equal(pruefeCacheAufraeumen([AUFRAEUMEN, RESTORE, BAU]).length, 1)
assert.equal(pruefeCacheAufraeumen([RESTORE, { ...AUFRAEUMEN, run: 'rm -rf data/cache/quittung-offen' }]).length, 1)
assert.equal(pruefeCacheAufraeumen([RESTORE, { ...AUFRAEUMEN, run: 'true' }]).length, 1)
assert.equal(pruefeCacheAufraeumen([RESTORE, { ...AUFRAEUMEN, if: 'always()' }]).length, 1)
assert.equal(pruefeCacheAufraeumen([RESTORE, { ...AUFRAEUMEN, 'continue-on-error': true }]).length, 1)
assert.match(pruefeCacheAufraeumen([AUFRAEUMEN, BAU]).join('|'), /AniList-Cache wiederverwenden" fehlt/)
assert.equal(pruefeWorkflow('bestand-bauen.yml', doc('bauen', [RESTORE, BAU, ...fest])).length, 1)
assert.deepEqual(pruefeWorkflow('anderer.yml', doc('bauen', GUT)), [])
assert.match(pruefeWorkflow('bestand-bauen.yml', doc('anders', GUT)).join('|'), /Job „bauen" fehlt/)

// Das geparste Dokument zählt, nicht der Text: Flow-Syntax und Anführungszeichen ändern nichts.
const flow = 'jobs:\n  bauen:\n    steps: [{run: "npm run data:rohfolgen"}, {run: \'bash tools/commit-data.sh "x"\'}]\n'
assert.match(pruefeWorkflow('anderer.yml', parse(flow)).join('|'), /data:rohfolgen-abhaken/)
assert.match(pruefeWorkflow('bestand-bauen.yml', parse('jobs: {}\n')).join('|'), /Job „bauen" fehlt/)

// `run: |` endet mit Zeilenumbruch: zählt wie ohne.
assert.match(pruefeJob('block', [s('npm run data:rohfolgen\n'), BAU, COMMIT, CHECK]).join('|'), /data:rohfolgen-abhaken/)

// Erkennung am Kommando, nicht an der Zeile: verkettet, per Pfad, mit Zusatzargumenten, mehrzeilig — vor dem Commit rot.
const VOR_COMMIT = [
  'npm run data:rohfolgen && npm run data:rohfolgen-abhaken',
  'npx tsx pipeline/rohfolgen-abhaken.ts',
  'npm run data:vorfaelle -- --nur-loeschen --x',
  'npm run data:build;\nnpm run data:pruefungen -- --nur-abhaken --y',
  'echo a \\\n  && npm run data:rohfolgen-abhaken',
  'LAUF=1 npm run-script data:rohfolgen-abhaken',
  'node ./pipeline/rohfolgen-abhaken.ts',
]
for (const run of VOR_COMMIT) {
  const job = [...MERKEN, BAU, s(run, 'eingeschoben'), CHECK, COMMIT, ...QUITT]
  const fehler = pruefeJob('eingeschoben', job)
  assert.ok(fehler.some((f) => f.includes('„eingeschoben": quittiert vor dem Commit')), `${run}: ${fehler}`)
}
// Trenner einzeln: `;` in einer Zeile, reiner Zeilenumbruch, Fortsetzungszeile ohne Trenner, Schalter nur als ganzes Wort.
for (const run of ['echo a; npm run data:rohfolgen-abhaken', 'echo a\nnpm run data:rohfolgen-abhaken', 'npm run \\\ndata:rohfolgen-abhaken']) {
  const fehler = pruefeJob('trenner', [BAU, s(run, 'eingeschoben'), COMMIT, CHECK])
  assert.ok(fehler.some((f) => f.includes('quittiert vor dem Commit')), `${JSON.stringify(run)}: ${fehler}`)
}
// `||` und `|` trennen ebenfalls; der Treffer vorn in einer Kette zählt (nicht nur der letzte Aufruf).
const R = 'npx tsx pipeline/rohfolgen-abhaken.ts'
for (const run of [`npx tsx pipeline/build.ts || ${R}`, `npx tsx pipeline/build.ts | ${R}`, `${R} && node tools/z.mjs`]) {
  assert.match(pruefeJob('kette', [BAU, s(run, 'eingeschoben'), COMMIT, CHECK]).join('|'), /quittiert vor dem Commit/, run)
}
assert.doesNotMatch(pruefeJob('wort', [BAU, s('npm run data:vorfaelle -- --nur-loeschenX'), COMMIT, QUITT[2]]).join('|'), /quittiert vor dem Commit/)
// Dateiendungen und Argumente der Erkennung selbst.
assert.deepEqual(aufrufe('node tools/a.mjs --x && tsx ./b/c.cjs; node d.js', {}).map((a) => a.datei), ['tools/a.mjs', 'b/c.cjs', 'd.js'])
assert.deepEqual(aufrufe('echo hallo', {}), [])

// Dieselben Kommandos nach dem Commit, verkettet und mit Zusatzargumenten: grün.
const NACH = [s('npm run data:rohfolgen-abhaken --silent'), s('npx tsx pipeline/fetch-vorfaelle.ts --nur-loeschen\n'), s('npm run data:pruefungen -- --nur-abhaken && echo ok')]
assert.deepEqual(pruefeJob('nach', [...MERKEN, BAU, COMMIT, CHECK, ...NACH, CHECK]), [])
// Merken per Pfad oder verkettet nach dem Commit: rot; fehlende Quittung bei verkettetem Merken: rot.
assert.match(pruefeJob('spaet', [BAU, COMMIT, s('npx tsx pipeline/fetch-rohfolgen.ts --x'), CHECK]).join('|'), /merkt nach dem Commit/)
assert.match(pruefeJob('kette', [s('npm run data:build && npm run data:vorfaelle --x'), COMMIT, CHECK]).join('|'), /kein Schritt „npm run data:vorfaelle -- --nur-loeschen"/)
// Briefkasten-Abruf per Pfad oder verkettet ohne Quittung danach: rot; mit Quittung: grün.
assert.match(pruefeJob('pfad', [CHECK, s('npx tsx pipeline/fetch-pruefungen.ts'), BAU, COMMIT]).join('|'), /kein Schritt/)
assert.match(pruefeJob('kette', [CHECK, s('npm run data:x && npm run data:pruefungen -- --x'), BAU, COMMIT]).join('|'), /kein Schritt/)
assert.deepEqual(pruefeJob('mit', [s('npm run data:pruefungen -- --abhaken-spaeter --x'), BAU, COMMIT, QUITT[0]]), [])
// Pfad als erstes Wort des Teilbefehls (ausführbare Datei).
assert.deepEqual(aufrufe('pipeline/rohfolgen-abhaken.ts --x', {}).map((a) => a.datei), ['pipeline/rohfolgen-abhaken.ts'])

// Indirekt über andere npm-Skripte der package.json (auch zweistufig, Kreis ohne Absturz).
const SKRIPTE = {
  'data:rohfolgen-abhaken': 'tsx pipeline/rohfolgen-abhaken.ts',
  'data:vorfaelle': 'tsx pipeline/fetch-vorfaelle.ts',
  'data:alles-abhaken': 'npm run data:rohfolgen-abhaken && echo x',
  'data:ganz-alles': 'npm run data:alles-abhaken',
  'data:kreis': 'npm run data:kreis2',
  'data:kreis2': 'npm run data:kreis',
  'data:zweit': 'tsx pipeline/build.ts && tsx pipeline/rohfolgen-abhaken.ts && node tools/z.mjs',
}
const indirekt = (run) => pruefeJob('ind', [s('npm run data:build'), s(run, 'x'), COMMIT, CHECK], SKRIPTE).join('|')
assert.match(indirekt('npm run data:ganz-alles'), /quittiert vor dem Commit/)
assert.match(indirekt('npm run data:alles-abhaken'), /quittiert vor dem Commit/)
assert.match(indirekt('npm run data:zweit'), /quittiert vor dem Commit/)
assert.match(indirekt('npm run data:vorfaelle'), /merkt|kein Schritt/)
assert.match(indirekt('npm run data:vorfaelle -- --nur-loeschen'), /quittiert vor dem Commit/)
assert.equal(indirekt('npm run data:kreis'), '')
assert.equal(indirekt('npm run data:unbekannt'), '')

// Merker nur unter quittung-offen/: der alte Pfad (vor Runde 2) und quittung-frei/ sind rot, auch mitten in einer Zeile.
// Der alte Pfad steht zusammengesetzt, sonst hielte ihn tools/check-cache-abhaengigkeit.mjs für eine echte Cache-Datei.
const CACHE = 'data/cache'
const OK = 'data/cache/quittung-offen/pruefungen-abhaken.json'
const pfade = pruefeMerkerPfade('m', [
  s(`rm -f ${OK}`),
  s(`rm -f ${OK} ${CACHE}/pruefungen-abhaken.json data/cache/quittung-offen/vorfaelle-loeschen.json`, 'alt'),
  s('cat data/cache/quittung-frei/rohfolgen-abhaken.json', 'frei'),
  s('echo ok'),
])
assert.deepEqual(pfade.map((f) => f.match(/„(\w+)"/)[1]), ['alt', 'frei'])
assert.match(pruefeWorkflow('x.yml', { jobs: { j: { steps: [s(`rm -f ${CACHE}/vorfaelle-loeschen.json`, 'w')] } } }).join('|'), /„w": Merker/)

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
