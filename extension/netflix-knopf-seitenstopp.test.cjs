/**
 * Netflix-Melde-Knopf auf der Profilauswahl-Seite: die Seite stoppt `click` per Capture-Listener am Dokument,
 * bevor der Knopf ihn erreicht (Messung 03.11.2026). Gespielt wird das echte `box.js` + `melder.js` mit
 * einer Ereigniskette Fenster-Capture -> Dokument-Capture (stopPropagation) -> Knopf; ein Listener direkt
 * am Knopf (alter Weg) bekommt den Klick dort nie.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

function macheElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
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
    hoerer: [],
    attribute: new Map(),
    classList: {
      _: new Set(),
      add(...n) { n.forEach((x) => this._.add(x)) },
      remove(...n) { n.forEach((x) => this._.delete(x)) },
      toggle(n, an) { if (an) this._.add(n); else this._.delete(n) },
      contains(n) { return this._.has(n) },
    },
    appendChild(k) { this.kinder.push(k); return k },
    append(...k) { this.kinder.push(...k) },
    insertBefore(k) { this.kinder.unshift(k); return k },
    after() {},
    contains(k) {
      if (!k) return false
      return k === this || this.kinder.some((x) => x === k || (typeof x.contains === 'function' && x.contains(k)))
    },
    remove() { this.isConnected = false },
    addEventListener(art, f) { if (art === 'click') this.hoerer.push(f) },
    removeEventListener() {},
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
    setAttribute(k, v) { this.attribute.set(k, String(v)) },
    getAttribute(k) { return this.attribute.get(k) ?? null },
    removeAttribute(k) { this.attribute.delete(k) },
    closest() { return null },
    click() {},
    focus() {},
    insertAdjacentHTML() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 } },
  }
  return el
}

const GLOBALE = [
  'URL', 'URLSearchParams', 'Date', 'JSON', 'Math', 'Promise', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Set', 'WeakMap', 'Map', 'Error', 'RegExp', 'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
]

/** Seite mit Ereigniskette; `seitenStopp`: Dokument-Capture-Listener, der click stoppt wie Netflix. */
function seiteNeu({ seitenStopp }) {
  const body = macheElement('body')
  body.innerText = 'Erinnern'
  const fensterCapture = []
  const dokumentCapture = []
  const meldungen = []
  const doc = {
    body,
    head: macheElement('head'),
    documentElement: macheElement('html'),
    readyState: 'complete',
    title: 'Netflix',
    createElement: macheElement,
    createTextNode: (t) => ({ textContent: t }),
    addEventListener(art, f, capture) { if (art === 'click' && capture) dokumentCapture.push(f) },
    removeEventListener() {},
    dispatchEvent() { return true },
    querySelector(sel) { return body.querySelector(sel) },
    querySelectorAll() { return [] },
    getElementById() { return null },
  }
  doc.kinder = [body]
  const chrome = {
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      sync: { get: async () => ({ token: 'test-token' }), set: async () => {} },
      onChanged: { addListener() {}, removeListener() {} },
    },
    runtime: { getURL: (p) => p, id: 'test', onMessage: { addListener() {} } },
  }
  const umgebung = {
    document: doc,
    location: { pathname: '/title/81234', search: '', href: 'https://www.netflix.com/title/81234', hostname: 'www.netflix.com' },
    navigator: { userAgent: 'test' },
    chrome,
    console,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame: () => 0,
    fetch: async (url, opt) => {
      if (opt?.method === 'POST' && !String(url).endsWith('/vorfall')) meldungen.push(opt.body)
      return { ok: true, json: async () => ({ ok: true, anbieter: [] }), text: async () => '' }
    },
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class {},
    history: { pushState() {} },
    postMessage() {},
    ...Object.fromEntries(GLOBALE.map((n) => [n, globalThis[n]])),
  }
  umgebung.addEventListener = (art, f, capture) => { if (art === 'click' && capture) fensterCapture.push(f) }
  umgebung.removeEventListener = () => {}
  umgebung.dispatchEvent = () => true
  umgebung.window = umgebung
  umgebung.globalThis = umgebung
  umgebung.self = umgebung
  const kontext = vm.createContext(umgebung)
  if (seitenStopp) doc.addEventListener('click', (e) => e.stopPropagation(), true)
  for (const datei of ['box.js', 'offene-netflix.js', 'pruefstand-zeit.js', 'disney-netz.js', 'netflix-gemeldet.js', 'netflix-durchgang-schutz.js', 'netflix-uebernahme.js', 'netflix-randvoll.js', 'netflix-seitentreue.js', 'netflix-staffel.js', 'netflix-erinnern.js', 'netflix-zurueckgestellt.js', 'melder.js']) {
    vm.runInContext(readFileSync(__dirname + '/' + datei, 'utf8'), kontext, { filename: datei })
  }
  const run = (c) => vm.runInContext(c, kontext)
  /** Echte Reihenfolge: Fenster-Capture, Dokument-Capture, dann Listener am Ziel. */
  const klick = (ziel) => {
    const e = { target: ziel, gestoppt: false, stopPropagation() { this.gestoppt = true }, preventDefault() {} }
    for (const stufe of [fensterCapture, dokumentCapture, ziel.hoerer ?? []]) {
      if (e.gestoppt) break
      for (const f of [...stufe]) f(e)
    }
  }
  const warte = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)) }
  return { run, klick, warte, meldungen, fensterCapture }
}

const BEREIT = "offeneTitel['81234'] = { titel: 'Test' }; stand.reihe = '81234'; stand.folgeNr = 3; stand.staffel = 1; stand.spuren = null"

async function fall() {
  const s = seiteNeu({ seitenStopp: true })
  await s.warte()
  s.run(BEREIT)
  s.run('knopfZeigen()')
  const knopf = s.run('knopf')
  pruefe('Knopf gezeichnet und klickbar', knopf && knopf.hidden === false && knopf.disabled === false, knopf && { h: knopf.hidden, d: knopf.disabled })
  pruefe('Verdrahtung: kein Listener direkt am Knopf (Seite stoppt dort)', knopf.hoerer.length === 0, knopf.hoerer.length)
  pruefe('vor dem Klick keine Meldung', s.meldungen.length === 0, s.meldungen.length)
  s.klick(knopf)
  await s.warte()
  pruefe('Klick trotz Seitenstopp (Dokument-Capture) löst genau eine Meldung aus', s.meldungen.length === 1, s.meldungen.length)

  /* Takt zeichnet neu: nach „gesendet“ gesperrt, ein zweiter Klick meldet nichts. */
  s.run('knopfZeigen()')
  pruefe('nach dem Neuzeichnen gesperrt (disabled)', s.run('knopf').disabled === true)
  s.klick(s.run('knopf'))
  await s.warte()
  pruefe('zweiter Klick löst keine Meldung aus', s.meldungen.length === 1, s.meldungen.length)
  const gesperrt = s.run('knopf')
  gesperrt.disabled = false
  gesperrt.setAttribute('aria-disabled', 'true')
  gesperrt.ariaDisabled = 'true'
  s.klick(gesperrt)
  await s.warte()
  pruefe('aria-disabled sperrt ebenfalls', s.meldungen.length === 1, s.meldungen.length)

  /* Zwei Zeichenläufe: Knopf entfernt, neu erzeugt -> genau ein Eintrag, ein Fenster-Listener. */
  const vorher = s.run('akKlickZiele.size')
  s.run('knopfEntfernen()')
  pruefe('Knopf entfernt: Klick-Eintrag gelöst', s.run('akKlickZiele.size') === vorher - 1, s.run('akKlickZiele.size'))
  s.run(BEREIT)
  s.run('knopfZeigen()')
  pruefe('neu gezeichnet: wieder genau ein Eintrag', s.run('akKlickZiele.size') === vorher, s.run('akKlickZiele.size'))
  pruefe('über zwei Zeichenläufe genau ein Fenster-Listener', s.fensterCapture.length === 1, s.fensterCapture.length)
  const neu = s.run('knopf')
  pruefe('neuer Knopf ist ein anderer', neu !== knopf)
}

fall().then(() => {
  const rot = faelle.filter((x) => !x).length
  if (rot) {
    console.error(`\n${rot} Zusicherung(en) verletzt`)
    process.exit(1)
  }
  console.log(`\nalle ${faelle.length} Zusicherungen erfüllt`)
})
