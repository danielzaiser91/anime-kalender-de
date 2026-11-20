/**
 * Netflix-Durchgang, Reste aus PR 4190 (Mutationsprobe): Knopf-Schreiber, Datum aus dem Erinnern-Fenster, Zähler der Schlusszeile.
 * Jeder Fall hält einen Mutanten aus `tools/mutationen/netflix-durchgang-rest.json` rot.
 */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const lies = (n) => readFileSync(resolve(__dirname, n), 'utf8')
const kontext = { globalThis: null, console }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-erinnern.js'), kontext)
vm.runInContext(lies('netflix-durchgang-steuerung.js'), kontext)
const { akNetflixKnopfSchreiben, akNetflixDatumKurz, akNetflixEndeZeigen } = kontext

const element = (klassen = []) => {
  const _ = new Set(klassen)
  return {
    hidden: true,
    disabled: false,
    textContent: 'alt',
    classList: {
      add: (...n) => n.forEach((x) => _.add(x)),
      remove: (...n) => n.forEach((x) => _.delete(x)),
      contains: (n) => _.has(n),
      toggle: (n, an) => (an ? _.add(n) : _.delete(n)),
    },
    klassen: () => [..._].sort(),
  }
}

/* --- Knopf-Schreiber: die Klasse wechselt, nichts Altes bleibt --- */
for (const alt of ['ak-ja', 'ak-nein', 'ak-leer']) {
  const el = element([alt])
  akNetflixKnopfSchreiben(el, { text: 'Melden', klasse: 'ak-ja', aktiv: true }, '/title/1')
  assert.deepEqual(el.klassen(), ['ak-ja'], `von ${alt} nach ak-ja`)
  assert.equal(el.textContent, 'Melden')
  assert.equal(el.disabled, false)
  const el2 = element([alt])
  akNetflixKnopfSchreiben(el2, { text: 'Nein', klasse: 'ak-nein', aktiv: true }, '/title/1')
  assert.deepEqual(el2.klassen(), ['ak-nein'], `von ${alt} nach ak-nein`)
}
{
  const el = element(['ak-ja'])
  akNetflixKnopfSchreiben(el, null, '/title/1')
  assert.deepEqual(el.klassen(), ['ak-leer'])
  assert.equal(el.textContent, 'Nichts zu melden')
  assert.equal(el.disabled, true, 'ohne Text nicht klickbar')
  assert.equal(el.hidden, false, 'nie versteckt')
}
for (const rueck of ['ak-erfolg', 'ak-fehler']) {
  const el = element([rueck])
  el.textContent = 'Rückmeldung'
  akNetflixKnopfSchreiben(el, { text: 'Melden', klasse: 'ak-ja', aktiv: true }, '/title/1')
  /* Erster Aufruf: Pfad neu → Rückmeldung fällt weg; zweiter Aufruf auf derselben Adresse lässt sie stehen. */
  el.classList.add(rueck)
  el.textContent = 'Rückmeldung'
  akNetflixKnopfSchreiben(el, { text: 'Melden', klasse: 'ak-ja', aktiv: true }, '/title/1')
  assert.equal(el.textContent, 'Rückmeldung', `${rueck} bleibt auf derselben Adresse`)
  akNetflixKnopfSchreiben(el, { text: 'Melden', klasse: 'ak-ja', aktiv: true }, '/title/2')
  assert.equal(el.textContent, 'Melden', `${rueck} fällt bei Adresswechsel weg`)
  assert.ok(!el.classList.contains(rueck))
}

/* --- Datum: Monatskürzel, Schreibweisen --- */
const datum = [
  ['19. November', '19.11.'], ['3. Okt. 2026', '3.10.'], ['05. Dezember', '5.12.'], ['5. Juni', '5.6.'], ['5. Juli', '5.7.'],
  ['3. Mar. 2026', '3.3.'], ['3. März', '3.3.'], ['19.November', '19.11.'], ['1. JANUAR', '1.1.'], ['9. Feb', '9.2.'], ['9. Mai', '9.5.'],
  ['12. Sept.', '12.9.'], ['Ab 7. Aug.', '7.8.'], ['2. Apr', '2.4.'],
]
for (const [text, erwartet] of datum) assert.equal(akNetflixDatumKurz(text), erwartet, text)
assert.equal(akNetflixDatumKurz('nichts'), null)
assert.equal(akNetflixDatumKurz('3. Xyz'), null)

/* --- Schlusszeile: Zähler „offen" und Grund --- */
const zeileMit = (ende, zurueck = '') => {
  const kinder = []
  const el = { classList: { toggle() {} }, remove() {}, textContent: '', title: '' }
  kontext.document = { createElement: () => el }
  const zeile = { querySelector: () => null, appendChild: (k) => kinder.push(k) }
  akNetflixEndeZeigen(() => zeile, ende, zurueck)
  return el
}
const ende = (grund, uebersprungen, text = ' · übersprungen: 2 (A, B)') => ({ grund, zaehlung: { uebersprungen }, uebersprungenText: text, text: '' })
assert.equal(zeileMit(ende('Netflix zeigte 3 Titel ohne Inhalt', 2)).textContent, 'Durchgang fertig · 5 offen (A, B)', 'Bremse-Titel plus Übersprungene')
assert.equal(zeileMit(ende('Netflix zeigte 3 Titel ohne Inhalt', 0, '')).textContent, 'Durchgang fertig · 3 offen', 'nur Bremse-Titel')
assert.equal(zeileMit(ende('kein offener Auftrag mehr', 2)).textContent, 'Durchgang fertig · 2 offen (A, B)', 'nur Übersprungene')
assert.equal(zeileMit(ende('kein offener Auftrag mehr', 0, '')).textContent, 'Durchgang fertig', 'nichts offen')
assert.equal(zeileMit(ende('abgebrochen', 2)).textContent, 'Durchgang abgebrochen · abgebrochen · übersprungen: 2 (A, B)', 'Abbruch ist nicht fertig')

console.log('netflix-durchgang-rest.test: ok (Knopf-Schreiber, Datum, Schlusszeile)')
