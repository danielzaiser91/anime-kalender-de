/**
 * **Erscheint die Prüfliste auf einer Netflix-Titelseite?**
 *
 * Der Knopf unten rechts („Anime-Kalender N") ist der einzige Einstieg in die
 * Liste. Am 06.09.2026 fehlte er dreimal hintereinander auf Daniels Bildschirm,
 * und die Fehlersuche lief jedes Mal über Vermutungen: die Liste sei leer, die
 * Erweiterung nicht neu geladen, der Knopf vom Netflix-Overlay verdeckt.
 *
 * Keine davon ließ sich prüfen, weil `melder.js` nur im Browser lief. Dieser
 * Sandkasten stellt so viel Netflix nach, wie das Skript zum Starten braucht —
 * DOM, `chrome.storage`, `fetch` — und beantwortet die eine Frage: Entsteht der
 * Knopf?
 *
 * Geprüft wird mit der **echten** `offene-netflix.js`, also mit dem Stand, den
 * die Erweiterung ausliefert. Was hier grün ist, kann auf der Seite immer noch
 * verdeckt sein; was hier rot ist, kann dort gar nicht erscheinen.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}

/** Ein Element, das nur kann, was `melder.js` von ihm verlangt. */
function macheElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
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
    querySelector() { return null },
    querySelectorAll() { return [] },
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
function baueUmgebung(pfad) {
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
    querySelector() { return null },
    querySelectorAll() { return [] },
    getElementById() { return null },
  }
  const speicher = {}
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
    location: { pathname: pfad, search: '', href: 'https://www.netflix.com' + pfad, hostname: 'www.netflix.com' },
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

function lade(pfad) {
  const { umgebung, body, takte } = baueUmgebung(pfad)
  const kontext = vm.createContext(umgebung)
  vm.runInContext(readFileSync(__dirname + '/offene-netflix.js', 'utf8'), kontext)
  let fehler = null
  try {
    vm.runInContext(readFileSync(__dirname + '/melder.js', 'utf8'), kontext)
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

console.log('Netflix-Prüfliste: erscheint der Knopf?\n')

const auftraege = JSON.parse(
  readFileSync(__dirname + '/offene-netflix.js', 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''),
)
pruefe(
  'die ausgelieferte Liste trägt überhaupt Aufträge',
  Object.keys(auftraege).length > 0,
  Object.keys(auftraege).length,
)

const titelseite = lade('/title/81186100')
pruefe('melder.js läuft auf einer Titelseite durch', !titelseite.fehler, titelseite.fehler?.message)

/*
  Der Knopf entsteht asynchron: `uebersichtZeigen()` hängt an `erledigtGeladen`,
  und das kommt aus `chrome.storage`. Ein Durchlauf der Microtask-Warteschlange
  genügt — im Browser sind es Millisekunden.
*/
;(async () => {
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))

  const knopf = suche(titelseite.body, 'ak-uebersicht')
  pruefe(
    'der Prüflisten-Knopf steht auf der Titelseite',
    Boolean(knopf),
    titelseite.body.kinder.map((k) => k.className),
  )
  if (knopf) {
    pruefe(
      'er nennt die Zahl der offenen Aufträge',
      /Anime-Kalender/.test(String(knopf.textContent)),
      knopf.textContent,
    )
  }

  /*
    **Der Fall, an dem die erste Fassung dieses Tests vorbeigemessen hat.**

    Netflix ist eine Einseiten-Anwendung und baut Teile des `body` neu auf, ohne
    dass sich der Pfad ändert. Nimmt jemand den Knopf dabei mit, muss der
    nächste Takt ihn wieder anhängen — die Bedingung `if (!uebersichtKnopf)`
    tat das nicht, denn die Variable zeigte weiter auf das herausgelöste
    Element.

    Der Test nimmt den Knopf deshalb selbst heraus und ruft die Zeichenfunktion
    erneut auf. Ein Test, der nur den frisch geladenen Zustand prüft, trifft
    genau die Hälfte des Lebens, in der ohnehin alles stimmt.
  */
  if (knopf) {
    titelseite.body.kinder = titelseite.body.kinder.filter((k) => k !== knopf)
    for (const takt of titelseite.takte) {
      try {
        takt()
      } catch {
        /* Ein Takt, der stolpert, hält den Test nicht auf. */
      }
    }
    const wieder = suche(titelseite.body, 'ak-uebersicht')
    pruefe(
      'nach einem Umbau der Seite kommt der Knopf zurück',
      Boolean(wieder),
      'nach dem Entfernen blieb er weg',
    )
  }

  /* Im Player bleibt die Erweiterung unsichtbar — Daniels Vorgabe vom 22.08.2026. */
  const player = lade('/watch/81186102')
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
  pruefe('im Player erscheint kein Knopf', !suche(player.body, 'ak-uebersicht'), 'Knopf im Player gefunden')

  const schlecht = faelle.filter((x) => !x).length
  console.log(schlecht ? `\n${schlecht} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
  process.exit(schlecht ? 1 : 0)
})()
