#!/usr/bin/env node
/**
 * **Lädt jedes Content-Skript der Erweiterung einmal — mehr nicht.**
 *
 * Die teuerste Fehlerklasse dieses Projekts braucht keine echte Seite, um
 * aufzutreten, und keine, um gefunden zu werden: ein Zugriff auf ein `let` oder
 * `const` **vor** seiner Deklaration. Der Name ist gehoben, der Wert nicht;
 * jeder Zugriff davor wirft.
 *
 * Dreimal in vier Wochen passiert, jedes Mal mit stiller Wirkung:
 *
 * | Datum | Name | was ausfiel |
 * |---|---|---|
 * | 25.08.2026 | `listenId` | der Dialog öffnete sich auf keiner Seite ohne Kennung |
 * | 28.08.2026 | `knopf` | der Takt warf 500 ms lang eine Zusage weg — Daniels Rechner wurde langsam |
 * | 01.09.2026 | `wiedervorlageBeantwortet` | dieselbe Klasse, diesmal als reine Zuweisung |
 *
 * Der zweite kostete einen halben Nachmittag, weil er wie ein
 * Leistungsproblem aussah. Alle drei hätte ein Ladeversuch in einer Sekunde
 * gefunden.
 *
 * Geprüft wird deshalb nur eines: **Läuft die Datei einmal durch?** Was sie
 * danach tut, prüfen die anderen Werkzeuge (`amazon-startseite-pruefen.cjs`
 * klickt, `melder-leiste-pruefen.cjs` sieht sich den Leisten-Zweig an,
 * `melder-kasten-bild.mjs` und `melder-leiste-bild.mjs` messen das Aussehen).
 *
 * Aufruf: `node tools/extension-laden-pruefen.cjs`
 */
const { readFileSync, existsSync } = require('node:fs')
const vm = require('node:vm')

/*
  Die Content-Skripte laut Manifest — die Leser laufen in derselben Seite und
  gehören dazu, `ruhig.js` ebenfalls: Es liegt auf **jeder** Amazon-Seite, ein
  Absturz dort trifft alles.

  **`optionen.js` bleibt draußen**, und das ist eine Abwägung, keine Lücke: Es
  greift beim Laden auf die Elemente seiner eigenen HTML-Seite zu, die hier
  alle null sind. Dafür bräuchte es ein zweites, nachgebautes DOM — für vierzig
  Zeilen Optionsseite mehr Gerüst als Gewinn. Sie lädt nur, wenn Daniel sie
  selbst öffnet, und ein Fehler dort fällt sofort auf.
*/
/**
 * Welche Dateien laut Manifest **vor** dieser geladen werden.
 *
 * Nur die derselben Gruppe: Ein Skript in `world: 'MAIN'` teilt seinen Scope
 * nicht mit den übrigen, und ein anderer Anbieter ohnehin nicht.
 */
function manifestGruppe(datei) {
  const name = datei.replace(/^extension\//, '')
  const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'))
  for (const gruppe of manifest.content_scripts ?? []) {
    const js = gruppe.js ?? []
    const platz = js.indexOf(name)
    if (platz > 0) return js.slice(0, platz)
    if (platz === 0) return []
  }
  return []
}

const SKRIPTE = [
  'extension/melder.js',
  'extension/amazon.js',
  'extension/disney.js',
  'extension/leser.js',
  'extension/amazon-leser.js',
  'extension/disney-leser.js',
  /* Läuft laut Manifest auf jeder Amazon-Seite — ein Absturz hier trifft alle. */
  'extension/ruhig.js',
]

const fehler = []

/** Ein Element, das genug kann, damit ein Aufbau durchläuft. */
function machElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: '',
    textContent: '',
    innerText: '',
    innerHTML: '',
    value: '',
    type: '',
    href: '',
    src: '',
    hidden: false,
    title: '',
    placeholder: '',
    min: '',
    max: '',
    disabled: false,
    dataset: {},
    style: {},
    kinder: [],
    hoerer: {},
    parentNode: null,
    get isConnected() {
      return Boolean(this.parentNode)
    },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(k) {
      k.parentNode = this
      this.kinder.push(k)
      return k
    },
    insertBefore(k) {
      k.parentNode = this
      this.kinder.unshift(k)
      return k
    },
    after(k) {
      if (this.parentNode) {
        k.parentNode = this.parentNode
        this.parentNode.kinder.push(k)
      }
      return k
    },
    replaceChildren(...neu) {
      this.kinder = neu
    },
    remove() {
      this.parentNode = null
    },
    addEventListener(art, fn) {
      this.hoerer[art] = fn
    },
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 30 }),
    focus() {},
    click() {},
    setAttribute() {},
    getAttribute: () => null,
    closest: () => null,
    contains: () => false,
  }
  return el
}

function baueSandkasten(host, pfad) {
  const body = machElement('body')
  const html = machElement('html')
  const s = {
    globalThis: null,
    AK_OFFENE_AMAZON: [],
    AK_OFFENE_NETFLIX: [],
    AK_OFFENE_DISNEY: [],
    location: { hostname: host, pathname: pfad, search: '', href: `https://${host}${pfad}` },
    document: {
      documentElement: html,
      body,
      head: machElement('head'),
      createElement: (tag) => machElement(tag),
      createTextNode: (t) => ({ textContent: t }),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {},
      getElementById: () => null,
      elementFromPoint: () => null,
      dispatchEvent: () => true,
      hidden: false,
      visibilityState: 'visible',
      readyState: 'complete',
    },
    navigator: { userAgent: 'node', clipboard: { writeText: async () => undefined } },
    console: { log() {}, warn() {}, error() {}, info() {}, table() {}, groupCollapsed() {}, groupEnd() {} },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    requestAnimationFrame: () => 0,
    queueMicrotask: (fn) => fn(),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }),
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    CustomEvent: class {
      constructor(art, o) {
        this.type = art
        this.detail = o?.detail
      }
    },
    Event: class {
      constructor(art) {
        this.type = art
      }
    },
    URL,
    URLSearchParams,
    /* Die Seite selbst hört mit — ohne diese beiden steigen drei Skripte beim Laden aus. */
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    /* Die Leser reichen ihren Fund per `postMessage` an das Content-Skript weiter. */
    postMessage() {},
    /* `disney-leser.js` hängt sich in XHR ein, um die Playback-Antwort mitzulesen. */
    XMLHttpRequest: class {
      open() {}
      send() {}
      setRequestHeader() {}
      addEventListener() {}
      get readyState() { return 4 }
      get status() { return 200 }
      get responseText() { return '' }
    },
    XMLHttpRequestEventTarget: class {},
    TextEncoder,
    TextDecoder,
    chrome: {
      storage: {
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        /* Die Optionsseite legt das Token in `sync` ab, nicht in `local`. */
        sync: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        onChanged: { addListener() {} },
      },
      runtime: {
        id: 'test',
        sendMessage: async () => undefined,
        onMessage: { addListener() {} },
        getURL: (p) => `chrome-extension://test/${p}`,
      },
    },
  }
  s.globalThis = s
  s.self = s
  s.window = s
  return s
}

console.log('Jedes Content-Skript einmal laden:\n')

for (const datei of SKRIPTE) {
  if (!existsSync(datei)) {
    console.log(`  – ${datei} — gibt es nicht (mehr)`)
    continue
  }
  /*
    **Vorgeladen wird, was das Manifest vorlädt.**

    Seit dem 10.09.2026 steht das gemeinsame Kastengerüst in `box.js`, und die
    drei Melder rufen seine Funktionen. Im Browser liegen alle Dateien einer
    `content_scripts`-Gruppe im selben Scope; wer hier nur die eine Datei lädt,
    misst einen Zustand, den es nicht gibt — und bekommt „akBox is not defined"
    für Code, der im Browser einwandfrei läuft.

    Gelesen wird die Reihenfolge aus dem Manifest selbst, nicht aus einer
    zweiten Liste hier: Zwei Listen laufen auseinander, und die im Manifest ist
    die, nach der Chrome sich richtet.
  */
  const vorlauf = manifestGruppe(datei)
    .map((n) => readFileSync('extension/' + n, 'utf8'))
    .join(String.fromCharCode(10))
  const quelle = vorlauf + String.fromCharCode(10) + readFileSync(datei, 'utf8')
  /* Die Seite, auf der das Skript wirklich läuft — sonst steigt es sofort aus. */
  const host = datei.includes('amazon')
    ? 'www.amazon.de'
    : datei.includes('disney')
      ? 'www.disneyplus.com'
      : 'www.netflix.com'
  const pfad = host === 'www.amazon.de' ? '/gp/video/detail/B0DJYJBNWF' : '/title/82757009'
  try {
    vm.runInContext(quelle, vm.createContext(baueSandkasten(host, pfad)), { filename: datei, timeout: 10_000 })
    console.log(`  ✓ ${datei}`)
  } catch (e) {
    console.log(`  ✗ ${datei} — ${e.message}`)
    fehler.push(`${datei}: ${e.message}`)
  }
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Skript(e) laufen beim Laden auf einen Fehler.`)
  process.exit(1)
}
console.log('Alle Content-Skripte laden durch.')
