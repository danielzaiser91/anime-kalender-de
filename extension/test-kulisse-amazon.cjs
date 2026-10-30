/**
 * Gemeinsame Kulisse für Tests, die `amazon.js` ganz im Sandkasten (`vm.runInNewContext`) laufen lassen.
 *
 * Der Briefkasten (`fetch`) antwortet asynchron: Alles, was `briefkastenHolen()` setzt (Erwartungen, gemeldete
 * Seiten, Stand), gilt erst nach einigen Mikrotasks. `durchlaufen()` lässt sie ab, bevor ein Test liest.
 * Die Kulisse bringt nur das Gemeinsame mit; Dokument, Fenster, Adresse und `fetch` bestimmt der Test.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (name) => readFileSync(`${__dirname}/${name}`, 'utf8')

const GLOBALE = Object.fromEntries(
  [Date, JSON, Math, Set, Map, Number, String, Object, Array, Boolean, RegExp, Promise, Error, Intl].map((f) => [f.name, f]),
)
GLOBALE.encodeURIComponent = encodeURIComponent
GLOBALE.decodeURIComponent = decodeURIComponent

/** Ein DOM-Element, das Kinder, Hörer und Klassensuche kennt; `alle` sammelt jedes erzeugte Element. */
function element(dokument, alle = []) {
  const el = {
    className: '',
    isConnected: true,
    style: { cssText: '' },
    dataset: {},
    _text: '',
    get textContent() {
      return el._text
    },
    set textContent(wert) {
      el._text = wert
      if (wert === '') el.kinder = []
    },
    title: '',
    type: '',
    disabled: false,
    kinder: [],
    hoerer: {},
    ownerDocument: dokument,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    replaceChildren(...neu) { el.kinder = neu },
    appendChild(k) { el.kinder.push(k); return k },
    append(...neu) { el.kinder.push(...neu) },
    insertBefore(k) { el.kinder.push(k); return k },
    remove() {},
    addEventListener(art, fn) { el.hoerer[art] = fn },
    setAttribute() {},
    getAttribute: () => null,
    querySelector(wahl) {
      const klasse = String(wahl).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of el.kinder) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(wahl)
        if (tiefer) return tiefer
      }
      return null
    },
    querySelectorAll: () => [],
    focus() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  }
  alle.push(el)
  return el
}

/**
 * Der Sandkasten ohne Dokument und Adresse. `speicher` ist der Tab-Speicher als einfaches Objekt;
 * `takte` sammelt, was `setInterval` bekommt (`takt()` ruft sie alle).
 */
function sandkasten({ speicher = {}, fetch, chromeLokal } = {}) {
  const k = {
    takte: [],
    AK_OFFENE_AMAZON: {},
    AK_PRIME_SUCHE: {},
    URLSearchParams,
    URL,
    sessionStorage: {
      getItem: (n) => speicher[n] ?? null,
      setItem: (n, v) => { speicher[n] = String(v) },
      removeItem: (n) => { delete speicher[n] },
      clear() {},
    },
    chrome: {
      runtime: { id: 'test' },
      storage: {
        local: chromeLokal ?? { get: () => Promise.resolve({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() },
        onChanged: { addListener() {} },
      },
    },
    MutationObserver: class { observe() {} },
    requestAnimationFrame: () => 0,
    fetch: fetch ?? (() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })),
    setInterval: (fn) => k.takte.push(fn),
    clearInterval() {},
    setTimeout: () => 0,
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => 0 },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    takt: () => k.takte.forEach((fn) => fn()),
    ...GLOBALE,
  }
  k.globalThis = k
  return k
}

/** Lässt alle anstehenden Mikrotasks und Briefkasten-Antworten durchlaufen (mehrere Runden, jede hinter `setImmediate`). */
async function durchlaufen(runden = 5) {
  for (let i = 0; i < runden; i++) await new Promise((r) => setImmediate(r))
}

/** Führt Quelltexte (z. B. aus `lies`) als ein Skript aus; ein Absturz wird zurückgegeben, nicht geworfen. */
function laufen(quellen, k) {
  try {
    const ergebnis = vm.runInNewContext(quellen.join('\n'), k, { filename: 'amazon.js' })
    ergebnis?.catch?.(() => {})
    return { absturz: null, ergebnis }
  } catch (err) {
    return { absturz: err, ergebnis: null }
  }
}

module.exports = { lies, element, sandkasten, durchlaufen, laufen }
