/**
 * **Nach der Meldung steht „✓ gemeldet“ — und neue Folgen heißen „Neue Folgen“** (4.24.21, 10.10.2026).
 *
 * Daniel am 10.10.2026 (Das Band der Unterwelt, Netflix 82719204): Nach „2/2" sprang der Knopf zurück auf
 * „▶ E1 + E15 prüfen → gilt für E1–15", obwohl alle 15 Meldungen im Briefkasten lagen. Der Rücksprung ließ
 * sich im Sandkasten nicht herstellen; der Abschluss hängt deshalb an einem eigenen Merker
 * (`netflix-gemeldet.js`), der auch einen zurückgesetzten Stand und das Neuladen übersteht.
 *
 * Der Sandkasten läuft das echte `melder.js` samt Durchlauf (Randprobe über 15 Folgen) gegen einen
 * Worker-Ersatz, der Meldungen entgegennimmt und im Briefkasten wiedergibt.
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
function baueUmgebung(pfad, suche = '', speicher = {}) {
  const body = macheElement('body')
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
  }
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
    URL, URLSearchParams, Date, JSON, Math, Promise, Object, Array, String, Number, Boolean, Set, WeakMap, Map, Error, RegExp,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  }
  umgebung.addEventListener = () => {}
  umgebung.removeEventListener = () => {}
  umgebung.dispatchEvent = () => true
  umgebung.window = umgebung
  umgebung.globalThis = umgebung
  umgebung.self = umgebung
  return { umgebung, body, takte }
}

const REIHE = '82719204'
const folgenListe = () =>
  Array.from({ length: 15 }, (_, i) => ({ nummer: i + 1, videoId: 82719209 + i, seasonId: 's1', titel: `F${i + 1}` }))

/**
 * Eine Netflix-Seite mit dem Worker-Ersatz. `bekannt`: höchste Folge laut Prüfstand (`null`: kein Eintrag).
 * `speicher` ist der gemeinsame Speicher — wer ihn weitergibt, simuliert ein Neuladen.
 */
async function seite({ bekannt = null, pruefstandAm = '2026-10-10T16:32:13.472Z', speicher = {}, vorher = [] } = {}) {
  const briefkasten = vorher.map((n) => ({ nummer: n, folge: String(82719208 + n), staffel: 1, am: '2026-09-12T10:00:00Z' }))
  const t = ladeSeite('/title/' + REIHE, {}, '', speicher)
  const env = t.umgebung
  env.fetch = async (url, opt) => {
    if (opt?.method === 'POST') {
      const b = JSON.parse(opt.body)
      const arr = b.stapel ?? [b]
      for (const d of arr) briefkasten.push({ nummer: d.folge_nr, folge: String(d.folge), staffel: 1, am: new Date().toISOString() })
      return { ok: true, json: async () => ({ ergebnisse: arr.map(() => ({ ok: true })) }) }
    }
    if (/gemeldet=/.test(String(url))) {
      const paare = briefkasten.map((s) => ({ nummer: s.nummer, staffel: 1, staffelBekannt: true, folge: s.folge, am: s.am }))
      return { ok: true, json: async () => ({ nummern: [...new Set(briefkasten.map((s) => s.nummer))], paare }) }
    }
    const netflix = { plattform: 'netflix', ziele: [], ...(bekannt ? { bekannt: { [REIHE]: bekannt } } : {}) }
    return { ok: true, json: async () => ({ anbieter: [netflix], pruefstandAm }) }
  }
  env.history = { pushState() {} }
  env.postMessage = () => {}
  env.PopStateEvent = class {}
  const run = (c) => vm.runInContext(c, env.__kontext)
  const warte = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)) }
  await warte()
  run(`anbieterStaffeln['${REIHE}'] = [{ seq: 1, folgen: 8, erste: 1 }]`)
  run(`DURCHLAUF.folgen = ${JSON.stringify(folgenListe())}; DURCHLAUF.alleFolgen = DURCHLAUF.folgen`)
  run("stand.spuren = [{ code: 'de', name: 'Deutsch' }, { code: 'ja', name: 'Japanisch' }]; stand.reihe = '" + REIHE + "'")
  const text = () => run('DURCHLAUF.knopf && DURCHLAUF.knopf.textContent')
  const zeige = async () => { await run('durchlaufStandLaden(gemeinteReihe())'); run('durchlaufKnopfZeigen()') }
  return { run, text, briefkasten, speicher, warte, zeige, env }
}

/** `lade` mit den Dateien, die das Manifest vor `melder.js` stellt, und einem teilbaren Speicher. */
function ladeSeite(pfad, liste, suchteil, speicher) {
  const { umgebung, body, takte } = baueUmgebung(pfad, suchteil, speicher)
  const kontext = vm.createContext(umgebung)
  umgebung.__kontext = kontext
  for (const datei of ['box.js', 'offene-netflix.js', 'pruefstand-zeit.js', 'netflix-gemeldet.js', 'melder.js']) {
    vm.runInContext(readFileSync(__dirname + '/' + datei, 'utf8'), kontext, { filename: datei })
  }
  return { umgebung, body, takte }
}

const knopfText = (s) => s.text()

;(async () => {
  console.log('Netflix: Abschluss „✓ gemeldet“ und „Neue Folgen“\n')

  /* 1. Der Fall vom 10.10.2026: Titel ohne Prüflisten-Eintrag, 15 Folgen, Randprobe E1 + E15. */
  const a = await seite()
  a.run('durchlaufKnopfZeigen()')
  pruefe('vorher: der Ausgangsknopf', /E1 \+ E15 prüfen/.test(knopfText(a)), knopfText(a))
  await a.run('durchlaufStarten()')
  a.run('durchlaufKnopfZeigen()')
  pruefe('alle 15 Folgen liegen im Briefkasten', a.briefkasten.length === 15, a.briefkasten.length)
  pruefe('nach dem Lauf: „✓ gemeldet“', knopfText(a) === '✓ gemeldet', knopfText(a))
  pruefe('der Knopf ist nicht mehr klickbar', a.run('DURCHLAUF.knopf.disabled') === true)

  /* Was auch immer den Stand zurücksetzt — der Abschluss bleibt. */
  a.run('DURCHLAUF.gemeldet = new Set(); durchlaufKnopfZeigen()')
  pruefe('ein zurückgesetzter Stand ändert den Abschluss nicht', knopfText(a) === '✓ gemeldet', knopfText(a))

  /* 2. Neuladen: derselbe Speicher, neue Seite — der Merker steht noch. */
  const b = await seite({ speicher: a.speicher, vorher: a.briefkasten.map((s) => s.nummer) })
  b.run('DURCHLAUF.gemeldet = new Set(); durchlaufKnopfZeigen()')
  pruefe('nach dem Neuladen steht der Abschluss noch', knopfText(b) === '✓ gemeldet', knopfText(b))

  /* 3. Der Prüfstand ist nach der Meldung neu entstanden: der Datensatz trägt die Antwort, der Merker fällt. */
  const c = await seite({ speicher: a.speicher, pruefstandAm: '2099-01-01T00:00:00.000Z' })
  c.run('DURCHLAUF.gemeldet = new Set(); durchlaufKnopfZeigen()')
  pruefe('Prüfstand nach der Meldung: der Merker gilt nicht mehr', knopfText(c) !== '✓ gemeldet', knopfText(c))

  /* 4. Ein neuer Lauf löscht den Merker (Rechtsklick „Stand verwerfen“). */
  const d = await seite({ speicher: a.speicher })
  d.run('durchlaufKnopfZeigen()')
  await d.run('durchlaufStandVergessen()')
  pruefe('„Stand verwerfen“ löscht den Abschluss', knopfText(d) !== '✓ gemeldet', knopfText(d))

  /* 5. Die Plattform hat mehr Folgen als der Datensatz: „Neue Folgen“, und der Lauf meldet alles. */
  const e = await seite({ bekannt: 11, vorher: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
  await e.zeige()
  pruefe('Briefkasten bis E11, Datensatz bis E11: „Neue Folgen 12–15“', knopfText(e) === 'Neue Folgen 12–15 · prüfen und melden', knopfText(e))
  await e.run('durchlaufStarten()')
  pruefe('der Lauf meldet alle 15 erneut, nicht nur E12–15', e.briefkasten.length === 11 + 15, e.briefkasten.length)
  e.run('durchlaufKnopfZeigen()')
  pruefe('danach „✓ gemeldet“', knopfText(e) === '✓ gemeldet', knopfText(e))

  /* 6. Ohne Eintrag im Prüfstand, oder bei gleich vielen Folgen, bleibt es beim bisherigen Knopf. */
  const f = await seite()
  await f.zeige()
  pruefe('ohne `bekannt`: kein „Neue Folgen“', !/Neue Folgen/.test(knopfText(f)), knopfText(f))
  const g = await seite({ bekannt: 15 })
  await g.zeige()
  pruefe('Datensatz kennt alle 15: kein „Neue Folgen“', !/Neue Folgen/.test(knopfText(g)), knopfText(g))

  /* 7. Zwei geladene Staffeln: Nummern nicht vergleichbar, kein Hinweis und kein Merker. */
  const h = await seite({ bekannt: 11 })
  h.run(`DURCHLAUF.alleFolgen = DURCHLAUF.folgen.concat([{ nummer: 1, videoId: 99, seasonId: 's2', titel: 'X' }])`)
  await h.zeige()
  pruefe('zwei Staffeln geladen: kein „Neue Folgen“', !/Neue Folgen/.test(knopfText(h)), knopfText(h))

  console.log('')
  if (faelle.includes(false)) {
    console.error('Zusicherungen gerissen.')
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Abschluss halten.')
})()
