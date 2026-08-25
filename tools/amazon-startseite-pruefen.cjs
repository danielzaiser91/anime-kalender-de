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

for (const pfad of ['/', '/gp/video/storefront', '/dp/B0DJYJBNWF']) {
  const { mach, body } = baueDom()
  const angehaengt = []
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: liste,
    location: { pathname: pfad, search: '', href: 'https://www.amazon.de' + pfad },
    document: {
      documentElement: { innerHTML: '<html></html>' },
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
