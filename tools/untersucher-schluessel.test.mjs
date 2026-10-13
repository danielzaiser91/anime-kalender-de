// Prüft den Untersucher-Schlüssel an den 15 roten Bestandsbauten vom 10.–12.10.2026 (Protokollauszüge
// in tools/testdaten/untersucher/). Je Lauf das Issue, das der Untersucher damals dazu anlegte.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { schluesselAusProtokoll, markerFuer, offenesIssue, laufNummern, offenePrs } from './untersucher-logik.mjs'

const DIR = new URL('./testdaten/untersucher/', import.meta.url)
const schluessel = (lauf) => schluesselAusProtokoll(readFileSync(new URL(`${lauf}.log`, DIR), 'utf8'))?.schluessel

// Gruppe = tatsächlich dieselbe Ursache, wie die Issues selbst sie nennen; Einzelfälle stehen allein.
const gruppen = {
  gesperrterTitel: { issues: [935, 937, 943], laeufe: ['38233819404', '38234944519', '38238108553'] },
  erratenerWeg: { issues: [890, 893, 898, 900, 908], laeufe: ['38209333535', '38210673513', '38215607142', '38220091147', '38221256877'] },
  pruefliste: { issues: [923, 926], laeufe: ['38229380423', '38230001432'] },
  handbelege: { issues: [878, 883], laeufe: ['38203328049', '38206265340'] },
}
const einzeln = [38064910222, 38088461435, 38131754000].map(String)

const schluesselDerGruppen = []
for (const [name, g] of Object.entries(gruppen)) {
  const ks = new Set(g.laeufe.map(schluessel))
  assert.equal(ks.size, 1, `${name}: ein Schlüssel für alle ${g.laeufe.length} Läufe, war ${[...ks]}`)
  assert.ok([...ks][0], `${name}: Schlüssel gefunden`)
  schluesselDerGruppen.push([...ks][0])
}
const alle = [...schluesselDerGruppen, ...einzeln.map(schluessel)]
assert.equal(new Set(alle).size, 7, 'sieben verschiedene Ursachen, keine zwei zusammengeworfen')
assert.ok(alle.every(Boolean), 'jeder Lauf liefert einen Schlüssel')

// Weder Zahlen noch Fundlisten dürfen den Schlüssel ändern; ein anderer Prüfungstext schon.
const zeile = (text) => `bauen\tÄnderungen committen\t2026-10-12T10:17:23.4035703Z   ✖ ${text}\n`
const k = (t) => schluesselAusProtokoll(zeile(t)).schluessel
assert.equal(k('kein gesperrter Titel in x.json — gefunden: [10013220]'), k('kein gesperrter Titel in x.json — gefunden: [1, 2, 3]'))
assert.notEqual(k('kein gesperrter Titel in x.json — gefunden: [1]'), k('kein gesperrter Titel in y.json — gefunden: [1]'))
assert.equal(schluesselAusProtokoll('nichts Besonderes\n'), null, 'ohne Ursachenzeile kein Schlüssel')
assert.equal(schluesselAusProtokoll('##[error]Process completed with exit code 1.\n'), null, 'allgemeine Meldung ist keine Ursache')

// Issue- und PR-Suche mit den Stücken, die am 12.10. wirklich vorlagen (gekürzt).
const key = schluessel('38233819404')
const issues = [
  { number: 898, body: 'altes Issue ohne Marker' },
  { number: 937, body: `neueres Issue\n${markerFuer(key)}` },
  { number: 935, body: `Lauf 38233819404, Schritt „Änderungen committen“\n${markerFuer(key)}` },
]
assert.equal(offenesIssue(issues, key), 935, 'das älteste Issue mit dem Marker gewinnt')
assert.equal(offenesIssue(issues, 'ffffffffff'), null, 'anderer Schlüssel: kein Treffer')
assert.equal(offenesIssue([{ number: 1, body: null }], key), null, 'Issue ohne Text')

const prs = [
  { number: 927, title: 'fix(bau): CR-Teilseiten-Prüfliste nach Dublettenbereinigung bereinigen', body: 'Behebt den roten Bestandslauf 38230001432' },
  { number: 936, title: 'Neu auf Deutsch: F-Sperre auch in neu-mit-synchro.json', body: 'Behebt den roten Bestandsbau 38233819404: Der Filter übersah sperre-Titel.' },
  { number: 938, title: 'fix(bau): F-Sperre gilt auch für „Neu auf Deutsch“', body: 'Behebt #937.' },
  { number: 9370, title: 'unbeteiligt', body: 'Behebt #9370' },
]
const laeufe = laufNummern(['Lauf 38233819404, Schritt', 'Derselbe Fehler im Lauf 38234944519'])
assert.deepEqual(laeufe, ['38233819404', '38234944519'])
assert.deepEqual(offenePrs(prs, 935, laeufe), [936], 'PR, der nur den Lauf zitiert, gehört zum Issue')
assert.deepEqual(offenePrs(prs, 937, []), [938], '„#937“ trifft nicht #9370 und nicht fremde PRs')
assert.deepEqual(offenePrs(prs, 935, []), [], 'ohne Bezug kein PR')

console.log('untersucher-schluessel.test: 15 Läufe, 7 Ursachen, Issue-/PR-Suche grün.')
