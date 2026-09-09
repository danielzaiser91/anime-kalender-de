/**
 * Läuft amazon.js auf der Startseite durch — und öffnet die Liste dort?
 *
 * Aufruf aus dem Repo-Wurzelverzeichnis: node tools/amazon-startseite-pruefen.cjs
 *
 *
 * Alle vorhandenen Zusicherungen starten mit einer Adresse der Form
 * `/dp/<ASIN>`. Daniels Fehlerbild vom 25.08.2026 stammt aber von
 * `https://www.amazon.de/` — dort gibt es keine Kennung in der Adresse.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync('extension/amazon.js', 'utf8')
const liste = JSON.parse(
  readFileSync('extension/offene-amazon.js', 'utf8')
    .replace(/^globalThis\.AK_OFFENE_AMAZON\s*=\s*/, '')
    .replace(/;?\s*$/, ''),
)

function baueDom() {
  const mach = () => ({
    className: '',
    style: {},
    dataset: {},
    textContent: '',
    title: '',
    type: '',
    disabled: false,
    kinder: [],
    hoerer: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    /*
      Die festen Zeilen des Kastens werden geleert statt gelöscht — sie bleiben
      stehen, damit die Höhe steht (siehe `kastenSkelett()`).
    */
    replaceChildren(...neu) { this.kinder = neu; return undefined },
    appendChild(k) { this.kinder.push(k); return k },
    remove() {},
    addEventListener(art, fn) { this.hoerer[art] = fn },
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
insertBefore(k) { this.kinder.push(k); return k },
  })
  const body = mach()
  return { mach, body }
}

/*
  **Die Suchseite gehört dazu — dort war die Erweiterung am 09.09.2026 weg.**

  Geprüft wurden bis dahin Startseite, Storefront und eine Titelseite. Der
  Suchkasten mit seinen Ankreuz-Feldern läuft aber nur auf `/s?k=…`, und genau
  dort warf ein `const`, das vor seiner Deklaration gelesen wurde: „Cannot
  access 'istKanalKarte' before initialization" (Daniel, mit Bild aus der
  Fehlerliste).

  Vierter Fall dieser Klasse — `listenId` (25.08.), `knopf` (28.08.),
  `wiedervorlageBeantwortet` (01.09.). Die drei davor hat diese Datei gefangen,
  diesen nicht: Sie kannte die Seite nicht, auf der er auftritt.

  `search` gehört mit in die Kulisse: Ohne den Suchbegriff hält `amazon.js` die
  Adresse für eine leere Suche und baut den Kasten gar nicht erst.
*/
const PFADE = [
  { pfad: '/', suche: '' },
  { pfad: '/gp/video/storefront', suche: '' },
  { pfad: '/dp/B0DJYJBNWF', suche: '' },
  { pfad: '/s', suche: '?k=Death%20Note%20Relight&i=instant-video' },
]

for (const { pfad, suche } of PFADE) {
  const { mach, body } = baueDom()
  const angehaengt = []
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: liste,
    location: { pathname: pfad, search: suche, href: 'https://www.amazon.de' + pfad + suche },
    document: {
      /*
        `classList` gehört dazu: `amazon.js` markiert seine Seiten seit dem
        06.09.2026 mit `ak-amazon` am `<html>`, damit eine CSS-Regel für Amazons
        Hinweiskasten nicht auch Netflix trifft. Ohne diese Zeile wirft der
        Aufruf beim Laden, das Skript bricht ab, und vier Zusicherungen der
        Übersicht fallen mit — genau das hat der Sandkasten gemeldet.
      */
      documentElement: {
        innerHTML: '<html></html>',
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      },
      body: { ...body, appendChild(k) { angehaengt.push(k); return k } },
      title: 'Amazon.de',
      createElement: () => mach(),
      querySelector: () => null,
      querySelectorAll: () => [],
    focus() {},
      addEventListener() {},
      head: mach(),
    },
    chrome: {
      runtime: { id: 'test' },
      storage: { local: { get: (k, cb) => cb({}), set: (v, cb) => cb && cb() } },
    },
    window: { addEventListener() {}, location: { pathname: pfad, search: '' } },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    /*
      **Was der Browser mitbringt, muss der Sandkasten auch mitbringen.**

      Am 28.08.2026 brach die Prüfung mit „URLSearchParams is not defined" ab —
      und zwar an einer Zeile, die im Browser seit Wochen einwandfrei läuft. Eine
      Prüfung, die an ihrer eigenen Umgebung scheitert, meldet einen Fehler, den
      es nicht gibt, und verdeckt die, die es gibt.
    */
    URLSearchParams,
    URL,
    setInterval: () => 0,
    setTimeout: () => 0,
    clearInterval() {},
    console,
    performance: { now: () => Date.now() },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    Date,
    JSON,
    Math,
    Set,
    Map,
    Number,
    String,
    Object,
    Array,
    Boolean,
    RegExp,
    Promise,
    Error,
    encodeURIComponent,
    decodeURIComponent,
  }
  sandkasten.globalThis = sandkasten
  sandkasten.window.document = sandkasten.document

  let fehler = null
  try {
    vm.runInNewContext(quelle, sandkasten, { filename: 'amazon.js' })
  } catch (err) {
    fehler = err
  }

  const uebersicht = angehaengt.find((e) => (e.className || '').includes('ak-amazon-uebersicht'))
  let klickFehler = null
  if (uebersicht?.hoerer?.click) {
    try { uebersicht.hoerer.click() } catch (err) { klickFehler = err }
  }

  console.log(`\n=== Adresse ${pfad} ===`)
  console.log('  Aufbau:', fehler ? 'FEHLER — ' + fehler.message : 'durchgelaufen')
  console.log('  Knopf:', uebersicht ? JSON.stringify(uebersicht.textContent) : 'FEHLT')
  console.log('  Klick:', klickFehler ? 'FEHLER — ' + klickFehler.message : uebersicht?.hoerer?.click ? 'ok' : 'kein Handler')
}
