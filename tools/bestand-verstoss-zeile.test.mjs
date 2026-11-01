/**
 * Test für tools/bestand-verstoss-zeile.mjs: Jede Bestandsprüfung (die Einzelskripte von `check:bestand` und `tools/check-bestand-liste.txt`)
 * schreibt vor ihrem Fehlerausgang mindestens eine Zeile, die `zaehleVerstoesse` (tools/pr-bestand-zaehlen.mjs) mitzählt; sonst gälte ihr Rot
 * im Basisvergleich mit 0 Verstößen als geerbt. Aufruf: node tools/bestand-verstoss-zeile.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { restSkripte } from './pr-bestand-vergleich.mjs'
import { findeStummeAusgaenge, zaehleFehlerAusgaenge } from './bestand-verstoss-zeile.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (rel) => readFileSync(join(wurzel, rel), 'utf8')
const stumm = (text) => findeStummeAusgaenge(text).map((s) => s.zeile)

/** Prüfungen ohne eigenen Fehlerausgang, mit Grund. Der Test verlangt, dass sie wirklich keinen haben. */
const OHNE_AUSGANG = {
  'pipeline/check-anisearch-paar-bestand.ts':
    'nur Warnung (⚠ WARNUNG, Exit 0): der tägliche Abruf der aniSearch-Brücke kann jederzeit ein neues Fehlpaar liefern, Rot würde den Bestandsbau stoppen; 01.11.2026',
  'pipeline/check-ankuendigung-versteckt-bestand.ts':
    'nur Warnung (⚠ WARNUNG, Exit 0): ein Titel mit frischer Ankündigung hinter dem Toggle kann zu Recht dort liegen (aniSearch „Deutsch nicht genannt“, Handurteil), Rot würde den Bestandsbau stoppen; 26.10.2026',
  'pipeline/check-disc-suchlinks-bestand.ts':
    'nur Warnung (⚠ WARNUNG, Exit 0): ein Sammler kann jederzeit eine Disc ohne EAN melden, Rot würde den Bestandsbau stoppen; 27.10.2026',
  'pipeline/check-gleiche-adresse-bestand.ts':
    'nur Warnung (⚠ WARNUNG, Exit 0): die Erweiterung kann jederzeit einen Beleg an eine fremde Amazon-Seite melden, Rot würde den Bestandsbau stoppen; 28.10.2026',
  'pipeline/check-handlung-eigen-bestand.ts':
    'verwaist ist seit 26.10.2026 eine Warnung (herabgestufteWarnzeile, Exit 0): ein Eintrag ohne Titel bringt nichts live, der Bau bindet nur Einträge zu Titeln im Bestand ein',
}

// Fälle der Regel (Zeilennummern: erste Zeile = 1).
assert.deepEqual(stumm('process.exit(1)'), [1], 'nackter Ausgang ist stumm')
assert.deepEqual(stumm("console.error('x')\nprocess.exit(1)"), [], 'Ausgabe davor')
assert.deepEqual(stumm("process.exit(1)\nconsole.error('x')"), [1], 'Ausgabe erst danach')
assert.deepEqual(stumm("console.log('x')\nprocess.exit(0)"), [], 'Ausgang 0 ist kein Fehler')
assert.deepEqual(stumm('process.exit(0)'), [], 'Ausgang 0 braucht keine Zeile')
assert.deepEqual(stumm('process.exitCode = 1'), [1], 'exitCode = 1')
assert.deepEqual(stumm("console.warn('x')\nprocess.exitCode = n"), [], 'exitCode mit Ausdruck, Ausgabe davor')
assert.deepEqual(stumm('process.exitCode = n'), [1], 'exitCode mit Ausdruck ist möglicherweise rot')
assert.deepEqual(stumm('process.exit(main())'), [1], 'Ausdruck als Code, nichts ausgegeben')
assert.deepEqual(stumm("function main() { console.error('x'); return 1 }\nprocess.exit(main())"), [], 'Hilfsfunktion davor gibt aus')
assert.deepEqual(stumm("function pruefe() { console.error('x') }\nfunction a() { process.exit(1) }"), [2], 'in einer Funktion zählt nur deren eigene Ausgabe')
assert.deepEqual(stumm("function a() { console.error('x'); if (y) { process.exit(2) } }"), [], 'Ausgabe vor verschachteltem Ausgang')
assert.deepEqual(stumm("console.log('x')\nfunction a() { process.exit(1) }"), [2], 'Ausgabe außerhalb der Funktion zählt nicht')
assert.deepEqual(stumm("process.stderr.write('x')\nprocess.exit(1)"), [], 'process.stderr.write')
assert.deepEqual(stumm("process.stdout.write('x')\nprocess.exit(1)"), [], 'process.stdout.write')
assert.deepEqual(stumm("process.stdin.write('x')\nprocess.exit(1)"), [2], 'stdin ist keine Ausgabe')
assert.deepEqual(stumm("log('x')\nprocess.exit(1)"), [], 'log-Helfer aus pipeline/lib/util')
assert.deepEqual(stumm("warn('x')\nprocess.exit(1)"), [], 'warn-Helfer aus pipeline/lib/util')
assert.deepEqual(stumm("console.info('x')\nprocess.exit(1)"), [], 'console.info')
assert.deepEqual(stumm("process.stdout.log('x')\nprocess.exit(1)"), [2], 'process.stdout.log ist keine Ausgabe')
assert.deepEqual(stumm("other.stderr.write('x')\nprocess.exit(1)"), [2], 'stderr eines fremden Objekts')
assert.deepEqual(stumm('process.exit()'), [1], 'exit ohne Argument nimmt exitCode, kann rot sein')
assert.deepEqual(stumm('if (process.exitCode == 1) {}'), [], 'Vergleich ist keine Zuweisung')
assert.deepEqual(stumm("logger.log('x')\nprocess.exit(1)"), [2], 'fremdes Objekt mit log ist keine Ausgabe')
assert.deepEqual(stumm("console.dir('x')\nprocess.exit(1)"), [2], 'console.dir ist nicht vorgesehen')
assert.deepEqual(stumm("console.log('  ✓ gut')\nprocess.exit(1)"), [2], 'Erfolgszeile zählt nicht mit')
assert.deepEqual(stumm('console.log(`✔ gut ${n}`)\nprocess.exit(1)'), [2], 'Erfolgszeile als Schablone zählt nicht mit')
assert.deepEqual(stumm("console.log('✖ schlecht')\nprocess.exit(1)"), [], 'Fehlerzeile zählt')
assert.deepEqual(stumm('console.log(`  ${marke} Text`)\nprocess.exit(1)'), [], 'Zeile mit Platzhalter am Anfang zählt')
assert.deepEqual(stumm('console.log(zeile)\nprocess.exit(1)'), [], 'nicht literale Zeile zählt')
assert.deepEqual(stumm("console.log()\nprocess.exit(1)"), [], 'Aufruf ohne Argument ist eine Ausgabe')
assert.equal(zaehleFehlerAusgaenge("process.exit(0)\nconsole.log('x')"), 0)
assert.equal(zaehleFehlerAusgaenge('process.exit(1)\nprocess.exitCode = 2'), 2)

// Die echten Prüfungen: gleiche Auswahl wie tools/pr-bestand-vergleich.mjs (Einzelskripte plus Liste).
const pkg = JSON.parse(lies('package.json'))
const skriptDatei = (name) => /(?:tsx|node) (\S+\.(?:ts|mjs))/.exec(pkg.scripts[name])?.[1]
const einzel = restSkripte(pkg).map(skriptDatei)
const liste = lies('tools/check-bestand-liste.txt').split(/\r?\n/).filter((z) => z && !z.startsWith('#'))
const pruefungen = [...einzel, ...liste]
assert.ok(!einzel.includes(undefined), 'jedes Einzelskript nennt seine Datei hinter tsx/node')
assert.ok(einzel.length >= 12 && liste.length >= 50, `Auswahl zu klein (${einzel.length} + ${liste.length})`)
assert.equal(new Set(pruefungen).size, pruefungen.length, 'keine Prüfung doppelt')

for (const datei of pruefungen) {
  const text = lies(datei)
  const ausgaenge = zaehleFehlerAusgaenge(text, datei)
  if (datei in OHNE_AUSGANG) {
    assert.equal(ausgaenge, 0, `${datei}: steht in OHNE_AUSGANG, hat aber Fehlerausgänge (Eintrag streichen)`)
    continue
  }
  assert.ok(ausgaenge > 0, `${datei}: kein Fehlerausgang (process.exit/exitCode) gefunden; Ausnahme mit Grund in OHNE_AUSGANG eintragen`)
  assert.deepEqual(stumm(text), [], `${datei}: Fehlerausgang ohne vorherige Verstoßzeile (Zeilen ${stumm(text)})`)
}
for (const datei of Object.keys(OHNE_AUSGANG)) assert.ok(pruefungen.includes(datei), `${datei}: Ausnahme ohne Bestandsprüfung (Eintrag streichen)`)

// Am echten Skript: ohne seine Fehlerzeilen wird dieselbe Datei stumm.
const echt = lies('pipeline/check-ja-hat-weg-bestand.ts')
assert.deepEqual(stumm(echt), [])
const leise = echt.replaceAll('console.error(', 'void(').replaceAll('console.log(', 'void(')
assert.notEqual(leise, echt)
assert.equal(stumm(leise).length, 1, 'ohne console.error und console.log wird der Ausgang von check-ja-hat-weg-bestand stumm')

console.log(`bestand-verstoss-zeile.test: grün (${pruefungen.length} Bestandsprüfungen, ${Object.keys(OHNE_AUSGANG).length} Ausnahme)`)
