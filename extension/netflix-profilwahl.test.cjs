/**
 * **Auf der Profilauswahl ist die Erweiterung eingeklappt** (a-32, 05.11.2026).
 *
 * Auslöser: Daniel sah auf „Wer schaut gerade?" den Kasten und startete „alle durchgehen" — Ergebnis
 * `/watch/<id>` mit E103. PR 2875 hatte nur bewiesen, dass der Kasten dort klickbar ist (Gegenteil).
 * Fixture: anonymisierter Ausschnitt der echten Profilauswahl (kein Profilname). Das Netz-Dokument
 * ist ein Mini-Nachbau, der `querySelector('[data-uia="x"]')` gegen die Fixture beantwortet.
 * Die CSS-Regel wird am Quelltext gegengelesen (kein Browser im Lauf).
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}`)
}
const lies = (n) => readFileSync(resolve(__dirname, n), 'utf8')
const fixture = lies('netflix-profilauswahl.fixture.html')
const browse = '<div data-uia="botLink"></div><div data-uia="container-adult"><div data-uia="lolomo"></div></div>'

console.log('Netflix: Profilauswahl klappt die Erweiterung ein')

function welt(html) {
  const marken = new Set()
  const takte = []
  const doc = {
    querySelector: (sel) => {
      const m = /^\[data-uia="([^"]+)"\]$/.exec(sel)
      return m && html.includes(`data-uia="${m[1]}"`) ? {} : null
    },
    documentElement: {
      classList: {
        toggle: (k, an) => (an ? marken.add(k) : marken.delete(k)),
        contains: (k) => marken.has(k),
      },
    },
  }
  const beendet = []
  const kontext = {
    document: doc,
    setInterval: (f) => takte.push(f),
    laufBeenden: (g) => beendet.push(g),
  }
  vm.createContext(kontext)
  vm.runInContext(lies('netflix-profilwahl.js') + '\nthis.t = { akProfilwahlSeite, akProfilwahlTakt }', kontext)
  return { marken, takte, beendet, doc, kontext, ...kontext.t }
}

{
  const w = welt(fixture)
  pruefe('Profilauswahl (Fixture) wird erkannt', w.akProfilwahlSeite(w.doc) === true)
  pruefe('Marke wird gesetzt', w.akProfilwahlTakt(w.doc, () => false, () => {}) === true && w.marken.has('ak-profilwahl'))
}
{
  const w = welt(browse)
  pruefe('Startseite nach der Profilwahl: nicht erkannt', w.akProfilwahlSeite(w.doc) === false)
  w.marken.add('ak-profilwahl')
  w.akProfilwahlTakt(w.doc, () => false, () => {})
  pruefe('Marke fällt nach der Profilwahl ab', !w.marken.has('ak-profilwahl'))
}
{
  const w = welt(fixture)
  const beendet = []
  w.akProfilwahlTakt(w.doc, () => true, (g) => beendet.push(g))
  pruefe('laufender Durchgang endet auf der Profilauswahl', beendet.length === 1 && /Profilauswahl/.test(beendet[0]))
  const b2 = []
  welt(browse).akProfilwahlTakt(welt(browse).doc, () => true, (g) => b2.push(g))
  pruefe('ohne Profilauswahl läuft der Durchgang weiter', b2.length === 0)
  const b3 = []
  w.akProfilwahlTakt(w.doc, () => false, (g) => b3.push(g))
  pruefe('ohne Durchgang wird nichts beendet', b3.length === 0)
}
{
  /* Verdrahtung: der echte Takt fragt `selbstAn` und ruft `laufBeenden` von melder.js. */
  const w = welt(fixture)
  pruefe('genau ein Takt registriert', w.takte.length === 1)
  w.takte[0]()
  pruefe('Takt ohne melder.js (selbstAn fehlt) wirft nicht und beendet nichts', w.beendet.length === 0 && w.marken.has('ak-profilwahl'))
  vm.runInContext('var selbstAn = true', w.kontext)
  w.takte[0]()
  pruefe('Takt mit laufendem Durchgang ruft laufBeenden', w.beendet.length === 1)
  vm.runInContext('selbstAn = false', w.kontext)
  w.takte[0]()
  pruefe('Takt ohne Durchgang beendet nichts', w.beendet.length === 1)
}
{
  const css = lies('melder.css')
  const regel = /html\.ak-profilwahl \.ak-box,\s*html\.ak-profilwahl \.ak-icon,\s*html\.ak-profilwahl \.ak-dialog,\s*html\.ak-profilwahl \.ak-schutzflaeche\s*\{\s*display: none !important;/
  pruefe('CSS blendet Kasten, Icon, Dialog und Schutzfläche aus', regel.test(css))
  const manifest = JSON.parse(lies('manifest.json'))
  const js = manifest.content_scripts.find((c) => c.js.includes('melder.js')).js
  pruefe('Manifest lädt die Datei vor melder.js', js.indexOf('netflix-profilwahl.js') >= 0 && js.indexOf('netflix-profilwahl.js') < js.indexOf('melder.js'))
}

if (fehler.length) {
  console.log(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Profilauswahl halten.')
