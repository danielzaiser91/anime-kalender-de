/* Regeln von `ladefehler-urteil.mjs`: je Prüfung ein roter Fall, dazu der saubere Fall; feste Messwerte. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aussetzerFehler, dauerFehler, erholungFehler, FEHLER_HINWEIS, FEHLER_SATZ, stehendeAnsichtFehler } from './ladefehler-urteil.mjs'

const knopfGut = { w: 180, h: 44, trifft: true }
const dauerGut = { text: FEHLER_SATZ + ' Erneut versuchen ' + FEHLER_HINWEIS, knopf: knopfGut, anfragen: 4 }
const dauer = (aendere) => dauerFehler({ ...dauerGut, ...aendere })

assert.deepEqual(aussetzerFehler({ anfragen: 2, fehlerSichtbar: false, geladen: true }), [], 'Aussetzer sauber')
assert.deepEqual(aussetzerFehler({ anfragen: 1, fehlerSichtbar: false, geladen: true }), ['Aussetzer nicht ausgelöst oder nicht wiederholt (1 Anfrage/n)'], 'nie grün durch Nichtstun')
assert.deepEqual(aussetzerFehler({ anfragen: 3, fehlerSichtbar: true, geladen: true }), ['Fehlerseite trotz Aussetzer'], 'Fehlerseite trotz Aussetzer')
assert.deepEqual(aussetzerFehler({ anfragen: 3, fehlerSichtbar: false, geladen: false }), ['Seite lädt nach dem Aussetzer nicht'], 'Seite bleibt leer')

assert.deepEqual(dauer({}), [], 'Dauerstörung sauber')
assert.deepEqual(dauer({ anfragen: 1 }), ['zu wenige Versuche vor der Fehlerseite (1, erwartet 4)'], 'zu früh aufgegeben')
assert.deepEqual(dauer({ text: 'Daten konnten nicht geladen werden ' + FEHLER_HINWEIS }), ['Besuchersatz fehlt („Die Daten laden gerade nicht.“)'], 'Satz fehlt')
assert.deepEqual(dauer({ text: FEHLER_SATZ + ' Erneut versuchen' }), ['Hinweis fehlt („Klappt es nicht, versuch es in ein paar Minuten noch einmal.“)'], 'Hinweis fehlt')
assert.deepEqual(dauer({ anfragen: 3 }), ['zu wenige Versuche vor der Fehlerseite (3, erwartet 4)'], 'drei Versuche reichen nicht')
assert.match(dauer({ text: dauerGut.text + ' npm' })[0], /„npm“/, 'npm allein sichtbar')
assert.match(dauer({ text: dauerGut.text + ' data:all' })[0], /„data:all“/, 'data:all allein sichtbar')
assert.match(dauer({ text: dauerGut.text + ' (500)' })[0], /„500“/, 'Statuscode 500 sichtbar')
assert.match(dauer({ text: dauerGut.text + ' 404' })[0], /„404“/, 'Statuscode 404 sichtbar')
assert.match(dauer({ text: dauerGut.text + ' npm run data:all' })[0], /Entwicklertext sichtbar/, 'Befehl sichtbar')
assert.match(dauer({ text: dauerGut.text + ' releases.json' })[0], /„\.json“/, 'Dateiname sichtbar')
assert.match(dauer({ text: dauerGut.text + ' (503)' })[0], /„503“/, 'Statuscode sichtbar')
assert.deepEqual(dauer({ knopf: undefined }), ['Knopf „Erneut versuchen“ fehlt'], 'Knopf fehlt')
assert.match(dauer({ knopf: { ...knopfGut, h: 43 } })[0], /Knopf zu klein \(180 × 43 px/, 'Knopf zu niedrig')
assert.match(dauer({ knopf: { ...knopfGut, w: 43 } })[0], /Knopf zu klein/, 'Knopf zu schmal')
assert.deepEqual(dauer({ knopf: { ...knopfGut, trifft: false } }), ['Knopf wird überdeckt (Trefferprobe)'], 'Knopf überdeckt')

assert.deepEqual(erholungFehler({ fehlerSichtbar: false, geladen: true }), [], 'Erholung sauber')
assert.deepEqual(erholungFehler({ fehlerSichtbar: true, geladen: true }), ['Fehlerseite bleibt nach „Erneut versuchen“ stehen'], 'Fehlerseite bleibt')
assert.deepEqual(erholungFehler({ fehlerSichtbar: false, geladen: false }), ['Seite lädt nach „Erneut versuchen“ nicht'], 'Seite bleibt leer')
assert.deepEqual(stehendeAnsichtFehler({ anfragen: 4, fehlerSichtbar: false, kopfDa: true }), [], 'stehende Ansicht sauber')
assert.deepEqual(stehendeAnsichtFehler({ anfragen: 3, fehlerSichtbar: false, kopfDa: true }), ['Nachladen nicht bis zum Ende versucht (3 Anfragen, erwartet 4)'], 'zu früh geurteilt')
assert.deepEqual(stehendeAnsichtFehler({ anfragen: 4, fehlerSichtbar: true, kopfDa: true }), ['Fehlerseite ersetzt die stehende Ansicht'], 'Fehlerseite statt Ansicht')
assert.deepEqual(stehendeAnsichtFehler({ anfragen: 4, fehlerSichtbar: false, kopfDa: false }), ['stehende Ansicht ist weg'], 'Ansicht weg')
/* Die Browserprobe tools/ladefehler-messen.mjs ruft jede der drei Regeln auf (Laufbeleg: die Probe selbst in der PR-Aussehen-Kette). */
const probe = readFileSync(new URL('./ladefehler-messen.mjs', import.meta.url), 'utf8')
for (const regel of ['aussetzerFehler(', 'dauerFehler(', 'erholungFehler(', 'stehendeAnsichtFehler(']) assert.ok(probe.includes(regel), `Probe ruft ${regel} nicht auf`)
console.log('ladefehler-urteil: ok (32 Fälle)')
