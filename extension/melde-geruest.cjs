/**
 * Gemeinsames Gerüst für Verhaltenstests der Melde-Handler (kein Test, wird eingebunden).
 *
 * Der echte Handler wird als Text aus der Quelle geschnitten und gegen eine Kulisse gespielt: benannte Werte
 * (Speicher, `fetch`, Knopf) sind echt, alles andere ist ein stummer Platzhalter. Der Speicher überlebt
 * die „Seite“, so lässt sich nach dem Melden eine neue Seite aufbauen und fragen, was sie liest.
 */
const { readFileSync } = require('node:fs')

const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')

/** Ein stummer Platzhalter für alles, was ein Handler nebenbei anfasst. */
function stummNeu() {
  const ziel = function () {}
  const stumm = new Proxy(ziel, {
    get: (_, name) => (name === 'then' || name === Symbol.iterator ? undefined : name === Symbol.toPrimitive ? () => '' : stumm),
    apply: () => stumm,
    construct: () => stumm,
    set: () => true,
  })
  return stumm
}

const NATIV = new Set(['Promise', 'Math', 'JSON', 'Object', 'Date', 'Error', 'String', 'Number', 'Array', 'Map', 'Set',
  'undefined', 'console', 'Symbol', 'Boolean', 'arguments', 'NaN', 'Infinity', 'isNaN', 'parseInt', 'RegExp', 'Intl', 'Reflect'])

function knopfNeu() {
  const attribute = new Map()
  return {
    dataset: {},
    style: { display: '' },
    disabled: false,
    textContent: 'melden',
    title: '',
    setAttribute: (k, v) => attribute.set(k, String(v)),
    removeAttribute: (k) => attribute.delete(k),
    getAttribute: (k) => attribute.get(k) ?? null,
  }
}

/** Der Text nach `anfang` bis einschließlich des ersten `ende` danach; leer, wenn eins fehlt. */
function ausschnitt(quelle, anfang, ende) {
  const von = quelle.indexOf(anfang)
  const bis = von < 0 ? -1 : quelle.indexOf(ende, von)
  return von < 0 || bis < 0 ? '' : quelle.slice(von + anfang.length, bis + ende.length)
}

/** Ein Speicher wie `chrome.storage.local`: schreiben mischt, lesen liefert den Stand — er überlebt jede „Seite“. */
function speicherNeu() {
  const inhalt = {}
  return {
    inhalt,
    lesen: async () => JSON.parse(JSON.stringify(inhalt)),
    schreiben: async (teil) => Object.assign(inhalt, JSON.parse(JSON.stringify(teil))),
  }
}

/** Eine feste Uhr: `uhr.Date.now()` liefert `uhr.t`. */
function uhrNeu(t) {
  const uhr = { t }
  uhr.Date = class extends Date {
    static now() {
      return uhr.t
    }
  }
  return uhr
}

/**
 * Macht aus dem Handler-Text eine Funktion, die in der Kulisse läuft. `werteObjekt` (Name → Wert) ist echt,
 * jeder andere Name ist stumm; setzt der Handler einen Namen, landet er in `werte`. `DateDerSeite` ersetzt `Date`.
 */
function handlerKompilieren(handler, werteObjekt, DateDerSeite = Date) {
  const werte = new Map(Object.entries(werteObjekt))
  const stumm = stummNeu()
  const kulisse = new Proxy({}, {
    has: (_, name) => typeof name === 'string' && !NATIV.has(name),
    get: (_, name) => (werte.has(name) ? werte.get(name) : name === Symbol.unscopables ? undefined : stumm),
    set: (_, name, wert) => { werte.set(name, wert); return true },
  })
  const klick = new Function('kulisse', 'Date', `with (kulisse) { return (${handler}) }`)(kulisse, DateDerSeite)
  return { klick, werte }
}

module.exports = { lies, stummNeu, knopfNeu, ausschnitt, speicherNeu, uhrNeu, handlerKompilieren }
