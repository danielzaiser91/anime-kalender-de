/**
 * Prime: Fassungen aus „Weitere Versionen verfügbar" (24.10.2026, Fischen Impossible).
 *
 * Teil 1: das Lesemodul gegen die Fixture (Ausschnitt der gespeicherten Seite B01MSMV5MA).
 * Teil 2: der Lauf durch `amazon.js` — die Titelseite bietet die Fassungen als Auswahl an.
 * Eine Prime-Probe lag nicht vor; der Prime-Fall ist die Fixture mit geänderter Angebotsmeldung.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (n) => readFileSync(__dirname + '/' + n, 'utf8')
const FIXTURE = lies('prime-fassungen.fixture.json')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const modul = { globalThis: null }
modul.globalThis = modul
vm.runInNewContext(lies('prime-fassungen.js'), modul)
const knoten = (text) => ({ textContent: text })
const eigen = (zusatz = {}) => ({ kennung: 'B01MSMV5MA', titel: 'Fischen Impossible Uncut', zugaenge: [], art: null, ...zusatz })
const kennungen = (liste) => liste.map((f) => f.kennung)

/** Die Fixture mit geänderter Angebotsmeldung der Fassung `kennung`. */
function mitMeldung(kennung, meldung, logo = false, typ = 'Entitled') {
  const daten = JSON.parse(FIXTURE)
  const reihe = Object.values(daten.init.preparations.body.btf.state.containers)[0][0].entities
  const e = reihe.find((x) => x.titleID === kennung)
  e.entitlementCues = { entitlementType: typ, focusMessage: { message: meldung }, glanceMessage: { message: meldung } }
  if (logo) e.entitlementCues.providerLogo = { imageUrl: 'https://example.invalid/kanal.png' }
  return JSON.stringify(daten)
}

console.log('Zusicherungen für die Fassungen aus „Weitere Versionen verfügbar“\n')

const echt = modul.akPrimeFassungenLesen(knoten(FIXTURE), eigen())
pruefe('drei Fassungen: die eigene Seite und die zwei aus dem Abschnitt', echt.length === 3, kennungen(echt))
const nach = Object.fromEntries(echt.map((f) => [f.kennung, f]))
pruefe('KiXi-Fassung: Kaufart Kanal (Gratiszeitraum)', nach.B0GVNJRZCM?.kaufart === 'kanal', nach.B0GVNJRZCM)
pruefe('Kauf-Fassung: Kaufart Kauf (Kaufen oder leihen)', nach.B01HRLV328?.kaufart === 'kauf', nach.B01HRLV328)
pruefe('Titel, Jahr, Laufzeit und Hinweis stehen dabei',
  nach.B01HRLV328?.titel === 'Fischen Impossible [dt./OV]' && nach.B01HRLV328?.jahr === '2011' &&
    nach.B01HRLV328?.laufzeit === '1 Std. 29 Min.' && nach.B01HRLV328?.hinweis === 'Alternative Audiosprache',
  nach.B01HRLV328)
pruefe('Hinweis Originalversion bei der KiXi-Fassung', nach.B0GVNJRZCM?.hinweis === 'Originalversion', nach.B0GVNJRZCM?.hinweis)
pruefe('Adresse trägt die Kennung', nach.B0GVNJRZCM?.url === '/gp/video/detail/B0GVNJRZCM', nach.B0GVNJRZCM?.url)
pruefe('ohne Prime-Fassung steht Kauf vor Kanal, die eigene Seite (unbekannt) vor dem Kanal',
  kennungen(echt).join() === 'B01MSMV5MA,B01HRLV328,B0GVNJRZCM', kennungen(echt))

const primeEigen = modul.akPrimeFassungenLesen(knoten(FIXTURE), eigen({ zugaenge: ['Prime'] }))
pruefe('die eigene Seite mit Prime-Zugang steht vorn', primeEigen[0]?.kennung === 'B01MSMV5MA' && primeEigen[0]?.kaufart === 'prime', primeEigen[0])

const primeAndere = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', 'Mit Prime ansehen', false, 'Unentitled')), eigen({ art: 'kauf' }))
pruefe('eine Prime-Fassung im Abschnitt rückt vor Kauf und Kanal', kennungen(primeAndere).join() === 'B01HRLV328,B01MSMV5MA,B0GVNJRZCM', kennungen(primeAndere))
const ohneText = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', '')), eigen({ art: 'kauf' }))
pruefe('Entitled ohne Kanal-Logo gilt als Prime', ohneText[0]?.kennung === 'B01HRLV328' && ohneText[0]?.kaufart === 'prime', ohneText[0])
const mitLogo = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', '', true)), eigen({ art: 'kauf' }))
pruefe('Entitled mit Kanal-Logo ist Kanal, nicht Prime', mitLogo.find((f) => f.kennung === 'B01HRLV328')?.kaufart === 'kanal', mitLogo)

// Gegenproben: nichts da, nichts geändert
const ohneAbschnitt = JSON.parse(FIXTURE)
const reihen = ohneAbschnitt.init.preparations.body.btf.state.containers
for (const k of Object.keys(reihen)) reihen[k] = reihen[k].map((c) => ({ ...c, title: 'Ähnliche Titel' }))
pruefe('Seite ohne den Abschnitt: leere Liste', modul.akPrimeFassungenLesen(knoten(JSON.stringify(ohneAbschnitt)), eigen()).length === 0)
pruefe('kein Knoten: leere Liste', modul.akPrimeFassungenLesen(null, eigen()).length === 0)
pruefe('kaputtes JSON: leere Liste', modul.akPrimeFassungenLesen(knoten('{"init":'), eigen()).length === 0)
const nurSelbst = JSON.parse(FIXTURE)
Object.values(nurSelbst.init.preparations.body.btf.state.containers)[0][0].entities = [
  Object.values(nurSelbst.init.preparations.body.btf.state.containers)[0][0].entities[0],
]
pruefe('steht nur die eigene Seite im Abschnitt, bleibt die Liste leer',
  modul.akPrimeFassungenLesen(knoten(JSON.stringify(nurSelbst)), eigen({ kennung: 'B0GVNJRZCM' })).length === 0)

// --- Teil 2: Lauf durch amazon.js -----------------------------------------

const skripte = JSON.parse(lies('manifest.json')).content_scripts.find((c) => c.js.includes('amazon.js')).js
pruefe('Manifest: prime-fassungen.js lädt vor amazon.js', skripte.indexOf('prime-fassungen.js') >= 0 && skripte.indexOf('prime-fassungen.js') < skripte.indexOf('amazon.js'), skripte)

const SUCHE ='https://www.amazon.de/s?k=Fischen+Impossible&i=instant-video'
const quelle = ['box.js', 'melde-sperre.js', 'prime-region.js', 'prime-fassungen.js', 'amazon.js'].map(lies).join('\n')

const GLOBALE = Object.fromEntries(
  [Date, JSON, Math, Set, Map, Number, String, Object, Array, Boolean, RegExp, Promise, Error].map((f) => [f.name, f]),
)
GLOBALE.encodeURIComponent = encodeURIComponent
GLOBALE.decodeURIComponent = decodeURIComponent

function element() {
  return {
    className: '',
    isConnected: true,
    style: { cssText: '' },
    dataset: {},
    textContent: '',
    title: '',
    type: '',
    disabled: false,
    kinder: [],
    hoerer: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    replaceChildren(...neu) { this.kinder = neu },
    appendChild(k) { this.kinder.push(k); return k },
    append(...k) { this.kinder.push(...k) },
    insertBefore(k) { this.kinder.push(k); return k },
    remove() {},
    addEventListener(art, fn) { this.hoerer[art] = fn },
    querySelector(sel) {
      const klasse = String(sel).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of this.kinder) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(sel)
        if (tiefer) return tiefer
      }
      return null
    },
    querySelectorAll: () => [],
    focus() {},
  }
}

function lauf(hydration) {
  const angehaengt = []
  const speicher = {
    'ak-prime-suchauftrag': JSON.stringify({ titel: 'Fischen Impossible', id: 1, suchUrl: SUCHE, zeit: Date.now() }),
  }
  const pfad = '/gp/video/detail/B01MSMV5MA'
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: {},
    AK_PRIME_SUCHE: { [SUCHE]: { titel: 'Fischen Impossible', id: 1 } },
    URLSearchParams,
    URL,
    location: { pathname: pfad, search: '', href: 'https://www.amazon.de' + pfad },
    sessionStorage: {
      getItem: (k) => speicher[k] ?? null,
      setItem: (k, v) => { speicher[k] = v },
      removeItem: (k) => { delete speicher[k] },
      clear() {},
    },
    document: {
      documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
      body: { ...element(), appendChild(k) { angehaengt.push(k); return k } },
      title: 'Amazon.de',
      createElement: () => element(),
      createTextNode: (t) => ({ textContent: t }),
      getElementById: (id) => (id === 'dv-web-page-hydration-data' ? hydration : null),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      head: element(),
    },
    chrome: { runtime: { id: 'test' }, storage: { local: { get: () => ({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() } } },
    window: { addEventListener() {}, location: { pathname: pfad, search: '' } },
    MutationObserver: class { observe() {} },
    requestAnimationFrame: () => 0,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    setInterval: () => 0,
    setTimeout: () => 0,
    clearInterval() {},
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => Date.now() },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    ...GLOBALE,
  }
  sandkasten.globalThis = sandkasten
  sandkasten.window.document = sandkasten.document
  let absturz = null
  try {
    vm.runInNewContext(quelle, sandkasten, { filename: 'amazon.js' })
  } catch (err) {
    absturz = err
  }
  return { absturz, angehaengt }
}

function zeilen(e, aus = []) {
  if (String(e?.className ?? '').split(/\s+/).includes('ak-such-auswahl')) aus.push(e)
  for (const k of e?.kinder ?? []) zeilen(k, aus)
  return aus
}
const zeilenText = (z) => (z.kinder ?? []).map((k) => k.textContent ?? '').join('')

const mit = lauf(knoten(FIXTURE))
pruefe('Lauf durch amazon.js ohne Absturz', !mit.absturz, mit.absturz?.message)
const auswahl = mit.angehaengt.flatMap((e) => zeilen(e))
pruefe('die Titelseite bietet alle drei Fassungen an', auswahl.length === 3, auswahl.map(zeilenText))
pruefe('die Fassungen tragen ihre ASIN', ['B01MSMV5MA', 'B01HRLV328', 'B0GVNJRZCM'].every((a) => auswahl.some((z) => zeilenText(z).includes(a))), auswahl.map(zeilenText))
pruefe('Kanal steht zuletzt, nicht vorgekreuzt', /B0GVNJRZCM/.test(zeilenText(auswahl[2] ?? {})) && auswahl.every((z) => z.kinder[0]?.checked === false), auswahl.map(zeilenText))

const prime = lauf(knoten(mitMeldung('B01HRLV328', 'Mit Prime ansehen', false, 'Unentitled')))
const primeAuswahl = prime.angehaengt.flatMap((e) => zeilen(e))
pruefe('die Prime-Fassung steht in der Auswahl vorn', /B01HRLV328/.test(zeilenText(primeAuswahl[0] ?? {})), primeAuswahl.map(zeilenText))

const ohne = lauf(null)
pruefe('ohne Hydration-Knoten läuft der Kasten durch ohne Auswahl', !ohne.absturz && ohne.angehaengt.flatMap((e) => zeilen(e)).length === 0, ohne.absturz?.message)
const ohneAbschn = lauf(knoten(JSON.stringify(ohneAbschnitt)))
pruefe('Seite ohne den Abschnitt ändert den Kasten nicht', !ohneAbschn.absturz && ohneAbschn.angehaengt.flatMap((e) => zeilen(e)).length === 0)

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('\nDie Fassungen aus „Weitere Versionen verfügbar“ halten.')
