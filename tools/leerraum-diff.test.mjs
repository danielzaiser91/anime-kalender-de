/** Tests für tools/lib/leerraum-diff.mjs: Zeilen, die ein Diff nur im Leerraum ändert. */
import assert from 'node:assert/strict'
import { leerraumErlaubt, leerraumFunde, leerraumRot } from './lib/leerraum-diff.mjs'

/** Baut einen `git diff -U0`-Text: je Hunk Startzeile, entfernte und hinzugefügte Zeilen. */
const diff = (datei, ...hunks) =>
  [
    `diff --git a/${datei} b/${datei}`,
    `--- a/${datei}`,
    `+++ b/${datei}`,
    ...hunks.flatMap(({ ab, minus, plus }) => [`@@ -${ab},${minus.length} +${ab},${plus.length} @@`, ...minus.map((z) => `-${z}`), ...plus.map((z) => `+${z}`)]),
    '',
  ].join('\n')
const eins = (ab, vorher, nachher) => ({ ab, minus: [vorher], plus: [nachher] })

// Positiv: verschluckte Leerzeichen, Zeile und Datei werden genannt.
const zwischen = leerraumFunde(diff('a.ts', eins(7, 'const x = 1', 'const x =1')))
assert.deepEqual(zwischen.map((f) => [f.datei, f.zeile]), [['a.ts', 7]], 'Leerzeichen zwischen Wörtern')
assert.equal(leerraumFunde(diff('a.ts', eins(3, 'foo()', 'foo() '))).length, 1, 'nur Zeilenende-Leerraum')
assert.equal(leerraumFunde(diff('a.ts', eins(3, 'foo()', 'foo()\r'))).length, 1, 'Zeilenende CRLF')
assert.equal(leerraumFunde(diff('a.ts', eins(3, '  foo()', '    foo()'))).length, 1, 'eine verschobene Einrückung')
assert.equal(leerraumFunde(diff('a.ts', eins(3, 'a b', 'ab'))).length, 1, 'Wortlücke fehlt')
assert.equal(leerraumFunde(diff('a.ts', eins(3, 'ab', 'a b'))).length, 1, 'Leerzeichen zu viel')

// Zeilennummer der neuen Seite, auch hinter mehreren zugefügten Zeilen im Hunk.
const mehrere = leerraumFunde(diff('a.ts', { ab: 10, minus: ['x = 1'], plus: ['neu', 'x =1'] }))
assert.deepEqual(mehrere.map((f) => f.zeile), [11], 'Zeilennummer = Platz in der neuen Datei')

// Negativ: echte Änderung (auch mit Leerraum), unverändert, Verschiebung, reine Zufügung.
assert.equal(leerraumFunde(diff('a.ts', eins(3, 'const x = 1', 'const x = 2'))).length, 0, 'echte Änderung')
assert.equal(leerraumFunde(diff('a.ts', eins(3, 'const x = 1', 'const  y =  2'))).length, 0, 'echte Änderung plus Leerraum zählt nicht')
assert.equal(leerraumFunde(diff('a.ts', { ab: 3, minus: [], plus: ['neu'] })).length, 0, 'reine Zufügung')
assert.equal(leerraumFunde(diff('a.ts', { ab: 3, minus: ['a', 'b'], plus: ['b', 'a'] })).length, 0, 'vertauschte Zeilen, zeichengleich')
assert.equal(leerraumFunde(diff('a.ts', eins(3, '', ''))).length, 0, 'leere Zeile bleibt leer')
assert.equal(leerraumFunde(diff('a.ts', eins(3, '  ', ''))).length, 0, 'Zeile ohne Inhalt wird nicht gemeldet')
assert.equal(leerraumFunde('').length, 0, 'leerer Diff')
assert.equal(leerraumFunde('Binary files a/x.png and b/x.png differ\n').length, 0, 'Binärdatei')

// Zwei gleiche Kerne: jede entfernte Zeile wird nur einmal verbraucht.
const doppelt = leerraumFunde(diff('a.ts', { ab: 3, minus: ['a b'], plus: ['ab', 'a  b'] }))
assert.equal(doppelt.length, 1, 'eine entfernte Zeile ergibt höchstens einen Fund')

// Eine zeichengleiche Zeile verbraucht ihre Gegenzeile, sie darf keiner späteren Leerraum-Zeile als Partner dienen.
assert.equal(leerraumFunde(diff('a.ts', { ab: 3, minus: ['x'], plus: ['x', ' x'] })).length, 0, 'gleiche Zeile verbraucht den Partner')

// Umformatieren: ab drei Einrückungs-Änderungen in einer Datei kein Fund, andere Funde bleiben.
const block = [eins(3, 'a', ' a'), eins(5, 'b', ' b'), eins(8, 'c', ' c')]
assert.equal(leerraumFunde(diff('a.ts', ...block)).length, 0, 'drei Einrückungen = Umformatieren')
assert.equal(leerraumFunde(diff('a.ts', ...block.slice(0, 2))).length, 2, 'zwei Einrückungen bleiben Funde')
assert.equal(leerraumFunde(diff('a.ts', ...block, eins(20, 'x = 1', 'x =1'))).length, 1, 'Wortlücke im Umformatieren-Block bleibt Fund')
const andereDateien = diff('a.ts', ...block.slice(0, 2)) + diff('b.ts', block[2])
assert.equal(leerraumFunde(andereDateien).length, 3, 'Zählung je Datei, nicht je Diff')
const verschachtelt = diff('a.ts', ...block.slice(0, 2), eins(30, 'q', 'q '))
assert.equal(leerraumFunde(verschachtelt).length, 3, 'Zeilenende-Leerraum zählt nicht zu den Einrückungen')

// Erzeugte Dateien und Kopfzeilen im Inhalt.
assert.equal(leerraumFunde(diff('public/data/titles.json', eins(3, 'a b', 'ab'))).length, 0, 'erzeugte Datei ausgelassen')
assert.equal(leerraumFunde(diff('package-lock.json', eins(3, 'a b', 'ab'))).length, 0, 'Lockfile ausgelassen')
assert.equal(leerraumFunde(diff('extension/pruefstand.json', eins(3, 'a b', 'ab'))).length, 0, 'Prüfstand ausgelassen')
assert.equal(leerraumFunde(diff(['data', 'cache', 'x.json'].join('/'), eins(3, 'a b', 'ab'))).length, 0, 'Cache ausgelassen')
assert.equal(leerraumFunde(diff('web/public/data/x.ts', eins(3, 'a b', 'ab'))).length, 1, 'nur der Ordner public/data an der Wurzel')
const kopfImInhalt = diff('a.ts', { ab: 1, minus: ['x = 1'], plus: ['++ b/q.ts', 'x =1'] })
assert.deepEqual(leerraumFunde(kopfImInhalt).map((f) => f.datei), ['a.ts'], 'Inhaltszeile „+++ b/…“ ist keine Dateikopfzeile')
const minusImInhalt = diff('a.ts', { ab: 1, minus: ['-- x', 'x = 1'], plus: ['x =1'] })
assert.equal(leerraumFunde(minusImInhalt).length, 1, 'Inhaltszeile „--- …“ bleibt entfernte Zeile')
const nachKopf = diff('a.ts', { ab: 1, minus: ['x y'], plus: ['xy'] }) + diff('b.ts', { ab: 1, minus: ['k l'], plus: ['kl'] })
assert.deepEqual(leerraumFunde(nachKopf).map((f) => f.datei), ['a.ts', 'b.ts'], 'zweite Datei im selben Diff')

// Ausweg im PR-Text.
assert.equal(leerraumErlaubt('Leerraum: absichtlich – YAML umgerückt'), true, 'Ausweg mit Grund')
assert.equal(leerraumErlaubt('Text\nLeerraum: absichtlich - Grund'), true, 'Ausweg mit Bindestrich in späterer Zeile')
assert.equal(leerraumErlaubt('Leerraum: absichtlich'), false, 'Ausweg ohne Grund gilt nicht')
assert.equal(leerraumErlaubt('Leerraum: absichtlich –   '), false, 'Ausweg mit leerem Grund gilt nicht')
assert.equal(leerraumErlaubt('Das ist Leerraum: absichtlich – Grund'), false, 'Ausweg nur am Zeilenanfang')
assert.equal(leerraumErlaubt(''), false, 'kein Ausweg im leeren Text')
const d = diff('a.ts', eins(7, 'const x = 1', 'const x =1'))
assert.equal(leerraumRot(d, 'nix').length, 1, 'ohne Ausweg rot')
assert.equal(leerraumRot(d, 'Leerraum: absichtlich – Grund').length, 0, 'mit Ausweg grün')
assert.match(leerraumRot(d, 'nix')[0], /a\.ts:7 /, 'Meldung nennt Datei und Zeile')
assert.equal(leerraumRot('', 'nix').length, 0, 'leerer Diff grün')

console.log('leerraum-diff.test: grün (Positiv, Negativ, Umformatieren je Datei, erzeugte Dateien, Ausweg)')
