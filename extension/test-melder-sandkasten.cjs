/**
 * Sandkasten für `melder.js` auf einer Netflix-Seite (DOM, `chrome.storage`, `fetch` nachgestellt), aus
 * `melder-uebersicht.test.cjs` herausgelöst, damit weitere Tests ihn nutzen (Dateien kommen in Manifest-Reihenfolge).
 */
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const vm = require('node:vm')

/** Ein Element, das nur kann, was `melder.js` von ihm verlangt. */
function macheElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    /* Angehaengt gilt als verbunden — akBox() prueft es, seit es den Kasten merkt. */
    isConnected: true,
    className: '',
    id: '',
    hidden: false,
    disabled: false,
    textContent: '',
    title: '',
    style: {},
    dataset: {},
    kinder: [],
    classList: {
      _: new Set(),
      add(...n) { n.forEach((x) => this._.add(x)) },
      remove(...n) { n.forEach((x) => this._.delete(x)) },
      toggle(n, an) { if (an) this._.add(n); else this._.delete(n) },
      contains(n) { return this._.has(n) },
    },
    appendChild(k) { this.kinder.push(k); return k },
    append(...k) { this.kinder.push(...k) },
    /* Die Tabelle der Zurückgestellten zeichnet ihren Rumpf damit neu (netflix-liste-ansicht.js). */
    replaceChildren(...k) { this.kinder = k },
    get children() { return this.kinder },
    insertBefore(k, vor) {
      const i = vor ? this.kinder.indexOf(vor) : -1
      if (i < 0) this.kinder.push(k)
      else this.kinder.splice(i, 0, k)
      return k
    },
    /*
      `contains` ist der Griff, mit dem `uebersichtZeigen()` seit dem 06.09.2026
      fragt, ob sein Knopf noch im Dokument hängt. Fehlt er hier, wirft der
      Aufruf, der Takt fängt es ab — und der Test meldet „blieb weg", obwohl der
      Fix greift. Dieselbe Falle wie bei `window.addEventListener` weiter unten.
    */
    contains(k) {
      if (!k) return false
      return this.kinder.some((x) => x === k || (typeof x.contains === 'function' && x.contains(k)))
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    /*
      **Sucht wirklich** — seit dem 10.09.2026 baut box.js einen Kasten mit
      Zeilen und Fuss, und der Melder haengt seine Knoepfe ueber querySelector
      hinein. Ein querySelector, der immer null gibt, laesst alles leer.
    */
    querySelector(sel) {
      const klasse = String(sel).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of this.kinder ?? []) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(sel)
        if (tiefer) return tiefer
      }
      return null
    },
    /* Nur reine Klassenlisten („.a, .b“), wie sie die Sperre in netflix-liste-ansicht.js fragt; alles andere bleibt leer. */
    querySelectorAll(sel) {
      const klassen = String(sel).split(',').map((s) => /^\.([\w-]+)$/.exec(s.trim())?.[1])
      if (klassen.some((k) => !k)) return []
      const treffer = []
      const suchen = (el) => {
        for (const k of el.kinder ?? []) {
          if (klassen.some((c) => String(k?.className ?? '').split(/\s+/).includes(c))) treffer.push(k)
          suchen(k)
        }
      }
      suchen(this)
      return treffer
    },
    setAttribute() {},
    getAttribute() { return null },
    closest() { return null },
    click() {},
    focus() {},
    insertAdjacentHTML() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 } },
  }
}

/**
 * Netflix so weit nachstellen, dass `melder.js` startet.
 *
 * Alles, was hier fehlt, fällt beim Laden als `ReferenceError` auf — und genau
 * das ist der Zweck: Ein Skript, das im Sandkasten nicht durchläuft, läuft auch
 * im Browser nicht durch.
 */
function baueUmgebung(pfad, suche = '', start = {}) {
  const body = macheElement('body')
  /** Alles, was das Skript per setInterval anmeldet — der Test löst es selbst aus. */
  const takte = []
  const doc = {
    body,
    head: macheElement('head'),
    documentElement: macheElement('html'),
    readyState: 'complete',
    title: 'Fate/Grand Order — Netflix',
    createElement: macheElement,
    createTextNode: (t) => ({ textContent: t }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true },
    /*
      **Sucht wirklich** — seit dem 10.09.2026 baut box.js einen Kasten mit
      Zeilen und Fuss, und der Melder haengt seine Knoepfe ueber querySelector
      hinein. Ein querySelector, der immer null gibt, laesst alles leer.
    */
    querySelector(sel) {
      const klasse = String(sel).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of this.kinder ?? []) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(sel)
        if (tiefer) return tiefer
      }
      return null
    },
    querySelectorAll() { return [] },
    getElementById() { return null },
    contains: (k) => body.contains(k),
  }
  /* Eigene Wurzeln hängen an <html> (akWurzelAnhaengen); die Sucher des Tests lesen den body. */
  doc.documentElement.appendChild = (k) => body.appendChild(k)
  const speicher = { ...start }
  const chrome = {
    storage: {
      local: {
        get: async (k) => (typeof k === 'string' ? { [k]: speicher[k] } : { ...speicher }),
        set: async (o) => Object.assign(speicher, o),
      },
      sync: {
        get: async () => ({ token: 'test-token' }),
        set: async () => {},
      },
      /* `melder.js` hört auf Änderungen am Speicher — ohne das bricht es ab. */
      onChanged: { addListener() {}, removeListener() {} },
    },
    runtime: { getURL: (p) => p, id: 'test', onMessage: { addListener() {} } },
  }
  const umgebung = {
    document: doc,
    location: { pathname: pfad, search: suche, href: 'https://www.netflix.com' + pfad + suche, hostname: 'www.netflix.com' },
    navigator: { userAgent: 'test' },
    chrome,
    console,
    /*
      **Der Takt wird gesammelt, nicht verworfen.**

      Ein Sandkasten ohne Takt prüft nur den Zustand direkt nach dem Laden —
      und genau dort war nie etwas kaputt. Die Callbacks landen deshalb in
      einer Liste, die der Test von Hand auslösen kann.
    */
    setInterval: (fn) => {
      if (typeof fn === 'function') takte.push(fn)
      return takte.length
    },
    clearInterval: () => {},
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0 },
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => { fn(); return 0 },
    fetch: async () => ({ ok: true, json: async () => ({ anbieter: [] }), text: async () => '' }),
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i?.detail } },
    URL,
    URLSearchParams,
    Date,
    JSON,
    Math,
    Promise,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Set,
    WeakMap,
    Map,
    Error,
    RegExp,
    isNaN,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
  }
  /*
    Auch `window` hört zu. Ohne diese drei Zeilen bricht `melder.js` mit
    „window.addEventListener is not a function" ab — und ein Sandkasten, der an
    seiner eigenen Umgebung scheitert, verdeckt genau den Fehler, den er finden
    soll (dieselbe Falle wie bei `URLSearchParams` am 28.08.2026).
  */
  umgebung.addEventListener = () => {}
  umgebung.removeEventListener = () => {}
  umgebung.dispatchEvent = () => true
  umgebung.window = umgebung
  umgebung.globalThis = umgebung
  umgebung.self = umgebung
  return { umgebung, body, takte }
}

/**
 * @param liste Ersetzt die ausgelieferte Auftragsliste. Wird gebraucht, um den
 *   leeren Fall zu prüfen, ohne dass die Zusicherung am Datenstand hängt.
 */
function lade(pfad, liste, suchteil = '', start = {}) {
  const { umgebung, body, takte } = baueUmgebung(pfad, suchteil, start)
  const kontext = vm.createContext(umgebung)
  /* `box.js` lädt im Browser vor `melder.js` — hier genauso, sonst fehlt akBox(). */
  ladeSkripte(kontext, skripteBis('melder.js', { nur: ['kontext.js', 'box.js', 'titel-bindung.js', 'offene-netflix.js', 'netflix-zurueckgestellt.js', 'netflix-liste-ansicht.js', 'netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-staffel.js', 'netflix-uebernahme.js', 'netflix-stand.js', 'netflix-seitentreue.js', 'netflix-staffelzaehlung.js'] }))
  if (liste) umgebung.AK_OFFENE_TITEL = liste
  let fehler = null
  try {
    ladeSkripte(kontext, ['melder.js'])
  } catch (e) {
    fehler = e
  }
  return { umgebung, body, fehler, takte }
}

/** Sucht rekursiv nach einem Element mit dieser Klasse. */
function suche(el, klasse) {
  if (!el) return null
  if (String(el.className ?? '').split(/\s+/).includes(klasse)) return el
  for (const k of el.kinder ?? []) {
    const t = suche(k, klasse)
    if (t) return t
  }
  return null
}

/** Die Klassen jeder Listenzeile (`ak-zeile`) in Anzeigereihenfolge. */
function zeilenKlassen(body) {
  const klassen = []
  const sammle = (el) => {
    if (String(el?.className).split(/\s+/).includes('ak-zeile')) klassen.push([...el.classList._])
    for (const k of el?.kinder ?? []) sammle(k)
  }
  sammle(body)
  return klassen
}

/** Alle Elemente unter `el`, in Dokumentreihenfolge. */
function alleElemente(el, alle = []) {
  alle.push(el)
  for (const k of el?.kinder ?? []) alleElemente(k, alle)
  return alle
}

module.exports = { baueUmgebung, lade, suche, alleElemente, zeilenKlassen }
