#!/usr/bin/env node
/**
 * **Erscheint der Melde-Knopf, wenn die Randprobe uneinheitlich ist?**
 *
 * Daniel am 07.09.2026 an „Kill Blue" auf Netflix: „ich prüfe also manuell und
 * merke bis 8 ist de, ich gebe in input feld 8 ein, aber es erscheint kein
 * melde button." Der Knopf steht im Code, das CSS trägt (`npm run
 * check:leiste` misst es), und trotzdem war er nicht da.
 *
 * Was fehlte, ist die Prüfung der **Logik**: Wird der Zweig überhaupt
 * erreicht, der ihn anlegt? Diese Frage beantwortet kein Bild und kein
 * Stylesheet — nur das Ausführen.
 *
 * **Zwei Stufen, und die erste ist die wichtigere.** Der Sandkasten lädt
 * `melder.js` wie `tools/amazon-startseite-pruefen.cjs` es für `amazon.js` tut
 * — das allein fängt jeden Absturz beim Laden, und genau daran ist die
 * Erweiterung im August dreimal gescheitert (`listenId`, `knopf`,
 * `wiedervorlageBeantwortet`, alle „Cannot access before initialization").
 *
 * Danach wird der Zweig **am Quelltext** geprüft, nicht am laufenden Zustand:
 * `DURCHLAUF` lebt im Modulscope einer IIFE und ist von außen nicht
 * erreichbar. Das ist weniger als ein Ausführen und mehr als nichts — es fängt
 * den Fall, dass jemand den Knopf aus dem Zweig nimmt oder hinter eine
 * zusätzliche Bedingung legt.
 *
 * **Was es nicht kann:** sagen, ob der Knopf auf Daniels Bildschirm erscheint.
 * Dafür müsste der Zweig wirklich laufen, mit einer echten Randprobe.
 *
 * Aufruf: `node tools/melder-leiste-pruefen.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync('extension/melder.js', 'utf8')

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? '✓' : '✗'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

/** Ein Element, das genug kann, damit der Aufbau durchläuft. */
function machElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: '',
    textContent: '',
    value: '',
    type: '',
    hidden: false,
    title: '',
    placeholder: '',
    min: '',
    max: '',
    disabled: false,
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

const body = machElement('body')
const html = machElement('html')

const sandkasten = {
  globalThis: null,
  location: { pathname: '/title/82757009', search: '', href: 'https://www.netflix.com/title/82757009' },
  document: {
    documentElement: html,
    body,
    createElement: (tag) => machElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => null,
    hidden: false,
    visibilityState: 'visible',
  },
  window: { location: { href: 'https://www.netflix.com/title/82757009' }, addEventListener() {} },
  navigator: { userAgent: 'node' },
  console: { log() {}, warn() {}, error() {}, table() {}, groupCollapsed() {}, groupEnd() {} },
  setTimeout: () => 0,
  clearTimeout() {},
  setInterval: () => 0,
  clearInterval() {},
  requestAnimationFrame: () => 0,
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  CustomEvent: class {
    constructor(art, o) {
      this.type = art
      this.detail = o?.detail
    }
  },
  chrome: {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => undefined,
      },
      onChanged: { addListener() {} },
    },
    runtime: { id: 'test', sendMessage: async () => undefined, onMessage: { addListener() {} } },
  },
}
sandkasten.globalThis = sandkasten
sandkasten.self = sandkasten

console.log('Sandkasten: melder.js laden')
const kontext = vm.createContext(sandkasten)
try {
  vm.runInContext(quelle, kontext, { filename: 'melder.js' })
  pruefe('melder.js lädt ohne Absturz', true)
} catch (e) {
  pruefe('melder.js lädt ohne Absturz', false, e.message)
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}

console.log('\nDie Leiste nach einer uneinheitlichen Randprobe:')

/*
  `DURCHLAUF` und `durchlaufKnopfZeigen` sind im Modulscope von `melder.js` und
  von außen nicht erreichbar — die Datei läuft als IIFE. Geprüft wird deshalb
  am Quelltext, was sich am Quelltext prüfen lässt: dass der Zweig existiert,
  dass er Feld **und** Knopf anlegt, und dass beide sichtbar geschaltet werden.

  Das ist weniger als ein Ausführen, aber mehr als nichts — und es fängt genau
  den Fall ab, der hier gefehlt hätte: dass jemand den Knopf aus dem Zweig
  entfernt oder hinter eine zusätzliche Bedingung legt.
*/
const zweig = /if \(DURCHLAUF\.randOffen && !DURCHLAUF\.laeuft\) \{([\s\S]*?)\n  \} else \{/.exec(quelle)?.[1] ?? ''
pruefe('es gibt einen Zweig für die uneinheitliche Randprobe', zweig.length > 0)
pruefe('er legt das Grenzfeld an', zweig.includes("DURCHLAUF.grenzFeld = document.createElement('input')"))
pruefe('er legt den Melde-Knopf an', zweig.includes("DURCHLAUF.grenzKnopf = document.createElement('button')"))
pruefe('beide werden sichtbar geschaltet', zweig.includes('DURCHLAUF.grenzKnopf.hidden = false') && zweig.includes('DURCHLAUF.grenzFeld.hidden = false'))
pruefe(
  'der Knopf hängt am Feld, nicht an der Leiste',
  zweig.includes('DURCHLAUF.grenzFeld.after(DURCHLAUF.grenzKnopf)'),
  'sonst steht er woanders, sobald das Feld umzieht',
)
/*
  **Der Riegel, an dem es hing.** Die Leiste wird im Player abgeräumt, und mit
  ihr Feld und Knopf. Wer danach zur Titelseite zurückkehrt, sieht sie nur
  wieder, wenn beide Referenzen genullt wurden — sonst hält der Aufbau sie für
  vorhanden (Daniel, 31.08.2026: „das input ist weg").
*/
pruefe(
  'beim Abräumen der Leiste werden Feld und Knopf genullt',
  /DURCHLAUF\.grenzFeld = null/.test(quelle) && /DURCHLAUF\.grenzKnopf = null/.test(quelle),
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('Leisten-Logik: alle Zusicherungen erfüllt.')
