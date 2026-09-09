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

/*
  **Ein Suchauftrag als Kulisse — die echte Liste hat gerade keinen.**

  Der Suchkasten mit seinen Ankreuz-Feldern entsteht nur, wenn ein Auftrag auf
  **diese** Suchadresse zeigt. `extension/offene-amazon.js` ist eine
  Arbeitsliste: Sie schwankt täglich und ist am Ende leer — sie als Kulisse zu
  nehmen hieße, die Prüfung an den Datenstand zu hängen (CLAUDE.md, 25.08.2026:
  „Testdaten gehören in den Test, nicht in den Datenbestand").

  Die Werte sind Daniels echter Fall vom 09.09.2026: „Death Note: Relight" ist
  **ein** Eintrag mit zwei Folgen, den Prime als zwei Kauftitel führt.
*/
const SUCH_ADRESSE = 'https://www.amazon.de/s?k=Death%20Note%20Relight&i=instant-video'
liste[SUCH_ADRESSE] = {
  titel: 'Death Note: Relight',
  url: SUCH_ADRESSE,
  suchUrl: SUCH_ADRESSE,
  eintraege: [{ id: 2994, name: 'Death Note: Relight', folgen: 2, offen: true }],
}

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

/**
 * Zwei Trefferkarten, wie Amazon sie auf einer Suchseite ausliefert.
 *
 * Gelesen werden genau drei Dinge: `data-card-title`, `data-card-entitlement`
 * und der Verweis auf die Titelseite. Die Werte sind Daniels echter Fall vom
 * 09.09.2026 — „Death Note: Relight" ist ein Eintrag mit zwei Folgen, den Prime
 * als zwei Kauftitel mit eigenen Kennungen führt.
 */
function baueKarten(mach) {
  const karte = (titel, kennung) => {
    const k = mach()
    const attr = {
      'data-card-title': titel,
      'data-card-entitlement': 'Purchase',
      'data-testid': 'card',
    }
    k.getAttribute = (n) => attr[n] ?? null
    k.querySelector = (sel) =>
      sel.includes('/gp/video/detail/')
        ? { getAttribute: () => `https://www.amazon.de/gp/video/detail/${kennung}` }
        : null
    k.querySelectorAll = () => []
    return k
  }
  return [
    karte('Death Note Relight 1: Visions of a God', 'B0FVDZ286F'),
    karte("Death Note Relight 2: L's Successors", 'B0FWYWSS3M'),
  ]
}

for (const { pfad, suche } of PFADE) {
  const { mach, body } = baueDom()
  /* Karten gibt es nur auf der Suchseite — sonst wäre der Kasten dort falsch. */
  const karten = pfad === '/s' ? baueKarten(mach) : []
  /* Der Takt sammelt sich hier; ausgelöst wird er nach dem Laden. */
  const takte = []
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
      /* Der Takt fragt danach; ohne sie wirft er, bevor er etwas prüft. */
      getElementById: () => null,
      /*
        **Auf der Suchseite stehen Trefferkarten — sonst läuft der halbe
        Suchkasten nie.**

        `suchTreffer()` liest `article[data-testid="card"]` und daraus
        `data-card-title`, `data-card-entitlement` und den Verweis auf die
        Titelseite. Ohne Karten steigt die Auswertung sofort aus, und alles
        dahinter — Trefferbewertung, Ankreuz-Felder, der Kasten selbst — wird
        nie ausgeführt.

        Genau daran ist am 09.09.2026 ein Absturz vorbeigelaufen: `istKanalKarte`
        wurde vor seiner Deklaration gerufen, die Erweiterung war auf jeder
        Suchseite weg, und dieser Sandkasten meldete grün. Die Gegenprobe (den
        Fehler wieder einbauen) blieb ebenfalls grün — der Zweig war unerreichbar.

        Die beiden Karten sind Daniels echter Fall: „Death Note: Relight" ist
        **ein** Eintrag mit zwei Folgen, den Prime als zwei Kauftitel führt.
      */
      querySelectorAll: (sel) => (sel === 'article[data-testid="card"]' ? karten : []),
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
    /*
      **Der Takt wird gesammelt, nicht gestartet.**

      `amazon.js` baut seinen Hinweiskasten nicht beim Laden, sondern im Takt —
      ohne ihn bleibt der halbe Suchkasten unerreicht, und genau dort lag am
      09.09.2026 der Absturz, den dieser Sandkasten grün gemeldet hat.

      Sofort auszuführen wäre falsch: Der Takt ruft sich über `setTimeout`
      selbst wieder auf, und die Prüfung liefe endlos. Gesammelt wird deshalb,
      und der erste Durchlauf wird unten einmal von Hand ausgelöst.
    */
    setInterval: (fn) => {
      if (typeof fn === 'function') takte.push(fn)
      return 0
    },
    setTimeout: (fn) => {
      if (typeof fn === 'function') takte.push(fn)
      return 0
    },
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

  /*
    **Ein Takt-Durchlauf von Hand — dort entsteht der Kasten.**

    Das Laden allein baut nur den Übersichts-Knopf. Alles Weitere — Hinweiskasten,
    Trefferbewertung, Ankreuz-Felder — hängt am Takt, und der ist im Sandkasten
    eine Attrappe. Ein einziger Durchlauf genügt und kann nicht in eine Schleife
    geraten: Was er selbst wieder einplant, sammeln wir nur.

    Ein Wurf hier ist genau der Fund, um den es geht — er wird gezählt, nicht
    verschluckt.
  */
  let taktFehler = null
  for (const fn of takte.slice(0, 3)) {
    try {
      const r = fn()
      if (r && typeof r.catch === 'function') r.catch((e) => { taktFehler ??= e })
    } catch (err) {
      taktFehler ??= err
    }
  }

  const uebersicht = angehaengt.find((e) => (e.className || '').includes('ak-amazon-uebersicht'))
  let klickFehler = null
  if (uebersicht?.hoerer?.click) {
    try { uebersicht.hoerer.click() } catch (err) { klickFehler = err }
  }

  console.log(`\n=== Adresse ${pfad} ===`)
  console.log('  Aufbau:', fehler ? 'FEHLER — ' + fehler.message : 'durchgelaufen')
  console.log('  Knopf:', uebersicht ? JSON.stringify(uebersicht.textContent) : 'FEHLT')
  console.log('  Takt:', taktFehler ? 'FEHLER — ' + taktFehler.message : takte.length + ' gesammelt, ' + Math.min(3, takte.length) + ' gelaufen')
  console.log('  Klick:', klickFehler ? 'FEHLER — ' + klickFehler.message : uebersicht?.hoerer?.click ? 'ok' : 'kein Handler')
}
