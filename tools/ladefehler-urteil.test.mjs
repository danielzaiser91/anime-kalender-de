/* Regeln von `ladefehler-urteil.mjs`: je Prüfung ein roter Fall, dazu der saubere Fall; feste Messwerte. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aussetzerFehler, dauerFehler, erholungFehler, FEHLER_SATZ } from './ladefehler-urteil.mjs'

const knopfGut = { w: 180, h: 44, trifft: true }
const dauerGut = { text: FEHLER_SATZ + ' Erneut versuchen', knopf: knopfGut, anfragen: 4 }
const dauer = (aendere) => dauerFehler({ ...dauerGut, ...aendere })

assert.deepEqual(aussetzerFehler({ anfragen: 2, fehlerSichtbar: false, geladen: true }), [], 'Aussetzer sauber')
assert.deepEqual(aussetzerFehler({ anfragen: 1, fehlerSichtbar: false, geladen: true }), ['Aussetzer nicht ausgelöst oder nicht wiederholt (1 Anfrage/n)'], 'nie grün durch Nichtstun')
assert.deepEqual(aussetzerFehler({ anfragen: 3, fehlerSichtbar: true, geladen: true }), ['Fehlerseite trotz Aussetzer'], 'Fehlerseite trotz Aussetzer')
assert.deepEqual(aussetzerFehler({ anfragen: 3, fehlerSichtbar: false, geladen: false }), ['Seite lädt nach dem Aussetzer nicht'], 'Seite bleibt leer')

assert.deepEqual(dauer({}), [], 'Dauerstörung sauber')
assert.deepEqual(dauer({ anfragen: 1 }), ['zu wenige Versuche vor der Fehlerseite (1, erwartet 4)'], 'zu früh aufgegeben')
assert.deepEqual(dauer({ text: 'Daten konnten nicht geladen werden' }), ['Besuchersatz fehlt („Die Daten laden gerade nicht.“)'], 'Satz fehlt')
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
/* Die Browserprobe tools/ladefehler-messen.mjs ruft jede der drei Regeln auf (Laufbeleg: die Probe selbst in der PR-Aussehen-Kette). */
const probe = readFileSync(new URL('./ladefehler-messen.mjs', import.meta.url), 'utf8')
for (const regel of ['aussetzerFehler(', 'dauerFehler(', 'erholungFehler(']) assert.ok(probe.includes(regel), `Probe ruft ${regel} nicht auf`)
console.log('ladefehler-urteil: ok (20 Fälle)')
