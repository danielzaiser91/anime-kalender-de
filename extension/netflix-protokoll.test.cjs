/**
 * **Das Zustandsprotokoll zeichnet auf, was der Melde-Kasten tut** (4.24.22, 10.10.2026).
 *
 * Der Knopf auf Netflix sprang nach dem Melden zurück, und die Ursache ließ sich weder lesen noch im
 * Sandkasten herstellen (Daniel, 10.10.2026, „Das Band der Unterwelt"). `protokoll.js` führt einen
 * Ringpuffer der letzten 200 Ereignisse, `netflix-protokoll.js` und `netflix-gemeldet.js` füllen ihn,
 * „Bericht laden" nimmt ihn mit. Geprüft wird das echte `melder.js` mit einem Durchlauf über 15 Folgen
 * — und dass das Messen nichts am Verhalten ändert.
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
/** Was ein Browser-Skript an Eingebautem braucht. */
const GLOBALE = [
  'URL', 'URLSearchParams', 'Date', 'JSON', 'Math', 'Promise', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Set', 'WeakMap', 'Map', 'Error', 'RegExp', 'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
]

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
    runtime: { getURL: (p) => p, id: 'test', getManifest: () => ({ version: 'test' }), onMessage: { addListener() {} } },
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
    ...Object.fromEntries(GLOBALE.map((n) => [n, globalThis[n]])),
  }
  umgebung.hoerer = {}
  umgebung.addEventListener = (art, fn) => (umgebung.hoerer[art] ??= []).push(fn)
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
async function seite({ bekannt = null, pruefstandAm = '2026-10-10T16:32:13.472Z', speicher = {}, vorher = [], postOk = true } = {}) {
  const briefkasten = vorher.map((n) => ({ nummer: n, folge: String(82719208 + n), staffel: 1, am: '2026-09-12T10:00:00Z' }))
  const t = ladeSeite('/title/' + REIHE, {}, '', speicher)
  const env = t.umgebung
  env.fetch = async (url, opt) => {
    if (opt?.method === 'POST' && !postOk) return { ok: false, json: async () => ({}) }
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
  /* Die erste Anzeige stößt das Laden von Merker und Prüfstand an (`netflix-gemeldet.js`). */
  run('durchlaufKnopfZeigen()')
  await warte()
  const text = () => run('DURCHLAUF.knopf && DURCHLAUF.knopf.textContent')
  const zeige = async () => { await run('durchlaufStandLaden(gemeinteReihe())'); run('durchlaufKnopfZeigen()') }
  return { run, text, briefkasten, speicher, warte, zeige, env }
}

/** `lade` mit den Dateien, die das Manifest vor `melder.js` stellt, und einem teilbaren Speicher. */
function ladeSeite(pfad, liste, suchteil, speicher) {
  const { umgebung, body, takte } = baueUmgebung(pfad, suchteil, speicher)
  const kontext = vm.createContext(umgebung)
  umgebung.__kontext = kontext
  for (const datei of ['box.js', 'offene-netflix.js', 'pruefstand-zeit.js', 'protokoll.js', 'disney-netz.js', 'netflix-gemeldet.js', 'netflix-durchgang-schutz.js', 'netflix-uebernahme.js', 'netflix-randvoll.js', 'netflix-staffel.js', 'netflix-erinnern.js', 'netflix-zurueckgestellt.js', 'melder.js', 'netflix-bericht.js', 'netflix-protokoll.js']) {
    vm.runInContext(readFileSync(__dirname + '/' + datei, 'utf8'), kontext, { filename: datei })
  }
  return { umgebung, body, takte }
}


const arten = (s) => s.run('akProtokoll.liste()').map((e) => e.art)
const ersterIndex = (s, art) => arten(s).indexOf(art)

async function ablaufFaelle() {
  const a = await seite()
  a.run('durchlaufKnopfZeigen()')
  await a.run('durchlaufStarten()')
  await a.run('durchlaufMelden(DURCHLAUF.folgen[0], [{ code: "de", name: "Deutsch" }], true)')
  await a.run('durchlaufStandLaden(gemeinteReihe())')
  a.run('durchlaufKnopfZeigen()')
  await a.warte()
  const liste = a.run('akProtokoll.liste()')
  const von = (art) => liste.filter((e) => e.art === art)

  pruefe('Lauf-Anfang und -Ende stehen im Protokoll, in der Reihenfolge', ersterIndex(a, 'lauf-start') >= 0 && ersterIndex(a, 'lauf-start') < ersterIndex(a, 'lauf-ende'), arten(a))
  pruefe('die Randprobe nennt ihre Größe: 15 Folgen, 15 gemeldet', von('rand-start')[0]?.anzahl === 15 && von('rand-ende')[0]?.anzahlGemeldet === 15, [von('rand-start'), von('rand-ende')])
  pruefe('eine gemeldete Folge steht mit Kennung und Ergebnis da', von('melden').length === 1 && von('melden')[0].ok === true && von('melden')[0].id === 82719209, von('melden'))
  pruefe('das Urteil am Lauf-Ende nennt Gründe und ungemeldete Folgen', von('lauf-urteil')[0]?.fertig === true && von('lauf-urteil')[0]?.ungemeldet === '', von('lauf-urteil'))
  pruefe('der Merker wird mit Kennung gesetzt', von('merker-gesetzt')[0]?.reihe === REIHE && von('merker-gesetzt')[0]?.merker?.bis === 15, von('merker-gesetzt'))
  const letzterKnopf = von('knopf').pop()
  pruefe('der letzte Knopf-Eintrag: „✓ gemeldet", alle 15 gemeldet, Kasten und Knopf benannt', letzterKnopf?.text === '✓ gemeldet' && letzterKnopf?.gemeldet === '1–15' && letzterKnopf?.nummern === '1–15', letzterKnopf)
  pruefe('der Worker-Stand nach dem Laden steht im Protokoll', von('stand-geladen').some((e) => e.worker === '1–15'), von('stand-geladen'))
  pruefe('Messen ändert das Verhalten nicht: „✓ gemeldet" und nicht klickbar', a.text() === '✓ gemeldet' && a.run('DURCHLAUF.knopf.disabled') === true, a.text())

  /* Der Bericht trägt das Protokoll mit. */
  const bericht = a.run('nfBericht()')
  pruefe('„Bericht laden": Protokoll und Merker im Bericht', Array.isArray(bericht.zustandsprotokoll) && bericht.zustandsprotokoll.length === liste.length && bericht.zustandsprotokoll.some((e) => e.art === 'merker-gesetzt'), Object.keys(bericht))
  /* 13.10.2026: übersprungene Titel stehen mit Grund im Bericht, offene als Liste (nicht nur als Zahl). */
  a.run("offeneTitel['70177034'] = { titel: 'Yu-Gi-Oh!', staffeln: [{ nummer: 1, offen: true, folgen: 52 }] }")
  a.run("selbstUebersprungen.set('70177034', 'keine Folgenliste in 20 s')")
  const durchgang = a.run('nfBericht()').durchgang
  pruefe('Bericht: ein übersprungener Titel nennt Kennung, Namen und Grund', JSON.stringify(durchgang.uebersprungen) === '[{"reihe":"70177034","titel":"Yu-Gi-Oh!","grund":"keine Folgenliste in 20 s"}]', durchgang.uebersprungen)
  pruefe('Bericht: die Liste der offenen Titel steht da, nicht nur die Zahl', durchgang.offen?.some((e) => e.reihe === '70177034' && e.titel === 'Yu-Gi-Oh!'), durchgang.offen)
  pruefe('… und sie hat so viele Einträge wie die Knopfzahl', durchgang.offen?.length === a.run('offeneTitelZahl()'), [durchgang.offen?.length, a.run('offeneTitelZahl()')])
  pruefe('keine personenbezogenen Felder (nur Zahlen, Kennungen, Knopftext)', !/token|mail|name/i.test(JSON.stringify(liste)), liste.length)

  /* Die Liste des Lesers wird mit ihrer Lage nach der Verarbeitung festgehalten. */
  const folgen10 = JSON.parse(a.run('JSON.stringify(DURCHLAUF.folgen)')).slice(0, 10)
  for (const fn of a.env.hoerer.message ?? []) fn({ source: a.run('window'), data: { marke: 'ak-folgenliste', fuerReihe: REIHE, folgen: folgen10 } })
  const l = a.run('akProtokoll.liste()').filter((e) => e.art === 'liste').pop()
  pruefe('eine Folgenliste des Lesers: Anzahl und Nummern im Protokoll', l?.anzahl === 10 && l?.nummern === '1–10' && l?.fuerReihe === REIHE, l)

  /* „Stand verwerfen“ löscht den Merker — und das Protokoll sagt, warum. */
  await a.run('durchlaufStandVergessen()')
  const geloescht = a.run('akProtokoll.liste()').filter((e) => e.art === 'merker-geloescht')
  pruefe('„Stand verwerfen“: merker-geloescht mit Kennung, stand-verworfen davor', geloescht[0]?.reihe === REIHE && arten(a).includes('stand-verworfen'), geloescht)

  /* Neuladen: derselbe Speicher, neue Seite — das Protokoll davor steht vorn. */
  const b = await seite({ speicher: a.speicher })
  const nachNeuladen = b.run('akProtokoll.liste()')
  pruefe('nach dem Neuladen steht das Protokoll davor noch da', nachNeuladen.some((e) => e.art === 'lauf-ende') && nachNeuladen.some((e) => e.art === 'start'), nachNeuladen.map((e) => e.art))
}

/** Der Fall vom 10.10.2026: Der erste Stapel wird gespeichert, aber nicht bestätigt — das Protokoll zeigt es. */
async function stapelFaelle() {
  const s = await seite()
  const echt = s.env.fetch
  let stapel = 0
  s.env.fetch = async (url, opt) => {
    if (opt?.method === 'POST' && JSON.parse(opt.body).stapel && stapel++ === 0) {
      await echt(url, opt)
      return { ok: true, status: 200, json: async () => ({ ergebnisse: JSON.parse(opt.body).stapel.map(() => ({ ok: false, status: 500 })) }) }
    }
    return echt(url, opt)
  }
  s.run('nfpFetchUmhuellen()') /* der Sandkasten tauscht fetch nach dem Laden aus */
  await s.run('durchlaufStarten()')
  await s.warte()
  const posts = s.run('akProtokoll.liste()').filter((e) => e.art === 'worker-post')
  pruefe('jede Meldung an den Worker steht da: Stapel 10 mit 0 bestätigt, Stapel 5 mit 5', posts.length === 2 && posts.some((e) => e.anzahl === 10 && e.bestaetigt === 0 && e.status === 200) && posts.some((e) => e.anzahl === 5 && e.bestaetigt === 5), posts)
  const urteil = s.run('akProtokoll.liste()').find((e) => e.art === 'lauf-urteil')
  pruefe('das Urteil nennt die lokal offenen Folgen: E1–10', urteil?.ungemeldet === '1–10', urteil)
  pruefe('der Abgleich mit dem Briefkasten steht da, am Ende „✓ gemeldet“', arten(s).includes('abgleich') && s.text() === '✓ gemeldet', arten(s))
}

async function grenzFaelle() {
  const s = await seite()
  for (let i = 0; i < 250; i++) s.run(`akProtokoll('probe', { i: ${i} })`)
  await s.warte()
  const liste = s.run('akProtokoll.liste()')
  pruefe('der Ringpuffer hält höchstens 200 Ereignisse', liste.length === 200, liste.length)
  pruefe('… und behält die neuesten', liste[liste.length - 1].i === 249, liste[liste.length - 1])
  pruefe('… auch im Speicher', s.speicher.akZustandsprotokoll?.length === 200, s.speicher.akZustandsprotokoll?.length)

  /* Ein Fehler beim Aufzeichnen darf den Kasten nie stören. */
  const k = await seite()
  k.run('globalThis.akProtokoll = () => { throw new Error("Speicher voll") }')
  await k.run('durchlaufStarten()')
  k.run('durchlaufKnopfZeigen()')
  pruefe('ein Fehler im Protokoll ändert nichts: „✓ gemeldet"', k.text() === '✓ gemeldet', k.text())
  pruefe('… und alle 15 Meldungen liegen im Briefkasten', k.briefkasten.length === 15, k.briefkasten.length)
}

void (async () => {
  console.log('Netflix: Zustandsprotokoll\n')
  await ablaufFaelle()
  await stapelFaelle()
  await grenzFaelle()
  console.log('')
  if (faelle.includes(false)) {
    console.error('Zusicherungen gerissen.')
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Zustandsprotokoll halten.')
})()
