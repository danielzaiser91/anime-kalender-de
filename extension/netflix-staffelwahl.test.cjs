/**
 * **Die Netflix-Meldung trägt die Staffel: Nummer, Folgenzahl und Menütext** (16.10.2026).
 *
 * Netflix hat eine Adresse für alle Staffeln; die Nummer links in der Folgenliste beginnt je Staffel bei 1,
 * und das Kästchen neben der Überschrift ist die Altersfreigabe (Daniel, Vinland Saga, The Dangers in My Heart,
 * Unicorn Academy mit „Kapitel N"). Die Kulisse bildet das Auswahlfeld nach (`netflix-staffelwahl.fixture.json`);
 * der Sandkasten läuft das echte `melder.js` und liest zurück, was beim Worker ankommt.
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
    insertBefore(k) { this.kinder.unshift(k); return k },
    after() {},
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
    ...Object.fromEntries(GLOBALE.map((n) => [n, globalThis[n]])),
  }
  umgebung.addEventListener = () => {}
  umgebung.removeEventListener = () => {}
  umgebung.dispatchEvent = () => true
  umgebung.window = umgebung
  umgebung.globalThis = umgebung
  umgebung.self = umgebung
  return { umgebung, body, takte }
}


const FX = JSON.parse(readFileSync(__dirname + '/netflix-staffelwahl.fixture.json', 'utf8'))

/** Die Dateien, die das Manifest vor `melder.js` stellt — samt dem Staffelleser. */
function ladeSeite(pfad) {
  const { umgebung } = baueUmgebung(pfad, '', {})
  const kontext = vm.createContext(umgebung)
  umgebung.__kontext = kontext
  const dateien = ['box.js', 'offene-netflix.js', 'pruefstand-zeit.js', 'disney-netz.js', 'netflix-gemeldet.js', 'netflix-durchgang-schutz.js', 'netflix-uebernahme.js', 'netflix-randvoll.js', 'netflix-staffel.js', 'netflix-erinnern.js', 'netflix-zurueckgestellt.js', 'netflix-alle-staffeln.js', 'melder.js']
  for (const datei of dateien) vm.runInContext(readFileSync(__dirname + '/' + datei, 'utf8'), kontext, { filename: datei })
  return umgebung
}

/** Das Auswahlfeld der Titelseite: Knopf mit dem Kopftext, dazu die Einträge des Menüs. */
function auswahlfeld(env, fx, kopf) {
  const knopf = { textContent: kopf, getAttribute: () => 'false', click() {} }
  const eintraege = fx.menue.map((text) => ({ textContent: text, click() {} }))
  const doc = env.document
  const original = doc.querySelector.bind(doc)
  doc.querySelector = (sel) => (/dropdown-toggle/.test(sel) ? (kopf == null ? null : knopf) : original(sel))
  doc.querySelectorAll = (sel) => (/dropdown-menu/.test(sel) ? eintraege : [])
}

/** `n` Folgen einer Netflix-Staffel; die Nummer zählt je Staffel neu, `ab` verschiebt nur den Titel. */
const staffelFolgen = (seasonId, n, ab = 1) =>
  Array.from({ length: n }, (_, i) => ({ nummer: i + 1, videoId: Number(seasonId) * 100 + i, seasonId: String(seasonId), titel: `Karte ${ab + i}` }))

/** Läuft den Durchlauf über `gruppe` und gibt alle Rohfolgen zurück, die beim Worker ankommen. */
async function gemeldet({ fx, kopf, gruppe, alle, vorlauf = '', einzel = false, davor = null }) {
  const env = ladeSeite('/title/' + fx.reihe)
  const posts = []
  env.fetch = async (url, opt) => {
    if (opt?.method === 'POST') {
      const b = JSON.parse(opt.body)
      posts.push(b)
      return { ok: true, json: async () => ({ ergebnisse: (b.stapel ?? [b]).map(() => ({ ok: true })) }) }
    }
    return { ok: true, json: async () => ({ anbieter: [{ plattform: 'netflix', ziele: [] }] }) }
  }
  env.history = { pushState() {} }
  env.postMessage = () => {}
  env.PopStateEvent = class {}
  const run = (c) => vm.runInContext(c, env.__kontext)
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
  if (davor) {
    auswahlfeld(env, davor.fx, davor.kopf)
    run(`stand.reihe = '${davor.fx.reihe}'`)
    await run('netflixStaffelnImMenue()')
  }
  auswahlfeld(env, fx, kopf)
  run(`DURCHLAUF.folgen = ${JSON.stringify(gruppe)}; DURCHLAUF.alleFolgen = ${JSON.stringify(alle ?? gruppe)}`)
  if (vorlauf) run(vorlauf)
  run(`stand.spuren = [{ code: 'de', name: 'Deutsch' }, { code: 'ja', name: 'Japanisch' }]; stand.reihe = '${fx.reihe}'`)
  if (einzel) {
    await run('netflixStaffelnImMenue()')
    run(`DURCHLAUF.staffelLabel = ${JSON.stringify(kopf)}`)
    await run('durchlaufMelden(DURCHLAUF.folgen[3], [{ code: "de", name: "Deutsch" }], true)')
  } else await run('durchlaufStarten()')
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
  return posts.flatMap((b) => (b.stapel ?? [b]).flatMap((d) => d.rohfolgen ?? []))
}

const eindeutig = (roh, feld) => [...new Set(roh.map((r) => r[feld]))]

function parseFaelle() {
  const lade = vm.createContext({ globalThis: null })
  lade.globalThis = lade
  vm.runInContext(readFileSync(__dirname + '/netflix-staffel.js', 'utf8'), lade)
  const lies = (t) => lade.akNetflixStaffelEintraege(t)
  const [a, b] = lies(FX.dangers.menue)
  pruefe('Dangers: Staffel 1 hat 12 Folgen', a.nr === 1 && a.folgen === 12, a)
  pruefe('Dangers: Staffel 2 hat 13 Folgen', b.nr === 2 && b.folgen === 13, b)
  const alle = lies(FX.dangers.menue)[2]
  pruefe('„Alle Folgen anzeigen“ hat weder Nummer noch Folgenzahl', alle.nr === null && alle.folgen === null, alle)
  const [k1, k2] = lies(FX.unicorn.menue)
  pruefe('„Kapitel 1 (8 Folgen)“ wird wie eine Staffel gelesen', k1.nr === 1 && k1.folgen === 8, k1)
  pruefe('„Kapitel 2“ ebenso (Treffer hinten)', k2.nr === 2 && k2.folgen === 12, k2)
  const v = lies(FX.varianten.menue)
  pruefe('„Teil 2“: Nummer 2, 12 Folgen', v[0].nr === 2 && v[0].folgen === 12, v[0])
  pruefe('„Volume 3“: Nummer 3, 10 Folgen', v[1].nr === 3 && v[1].folgen === 10, v[1])
  pruefe('„Season 2 (13 Episodes)“: Nummer 2, 13 Folgen', v[2].nr === 2 && v[2].folgen === 13, v[2])
  pruefe('Altersfreigabe im Eintrag („Staffel 1 16 (12 Folgen)“) ist weder Nummer noch Folgenzahl', v[3].nr === 1 && v[3].folgen === 12, v[3])
  pruefe('benannte Staffel („Golden Wind“): keine Nummer, 39 Folgen', v[4].nr === null && v[4].folgen === 39, v[4])
  pruefe('benannte Staffel ohne Leerzeichen vor der Klammer: 26 Folgen', v[5].nr === null && v[5].folgen === 26, v[5])
  pruefe('„Extras 8 Folgen“: die Folgenzahl ist keine Nummer', v[6].nr === null && v[6].folgen === 8, v[6])
  pruefe('vierstellige Zahl ist keine Staffelnummer', lade.akNetflixStaffelNr('Staffel 2026') === null)
  const [ohneWort] = lies(['Staffel 2: 16'])
  pruefe('Überschrift „Staffel 2: 16“: die 16 ist keine Folgenzahl', ohneWort.nr === 2 && ohneWort.folgen === null, ohneWort)
  pruefe('Überschrift „Kapitel 1:“ mit Kästchen 6 → Nummer 1', lade.akNetflixStaffelNr('Kapitel 1: 6') === 1)
  pruefe('kein Eintrag: leere Liste', lies([]).length === 0)
}

async function meldungsFaelle() {
  const d = FX.dangers
  const anzeige = ladeSeite('/title/' + d.reihe)
  auswahlfeld(anzeige, d, 'Kapitel 2: 6')
  pruefe('Auswahlfeld „Kapitel 2: 6“ (Kästchen daneben): angezeigt wird Staffel 2', vm.runInContext('angezeigteNetflixStaffel()', anzeige.__kontext) === 2)
  const roh = await gemeldet({ fx: d, kopf: d.kopf, gruppe: staffelFolgen(2, 13, 13), alle: [...staffelFolgen(1, 12), ...staffelFolgen(2, 13, 13)] })
  pruefe('Dangers Staffel 2: Rohfolgen kommen an', roh.length > 0, roh.length)
  pruefe('… alle mit Staffelnummer 2', eindeutig(roh, 'staffelNr').join() === '2', eindeutig(roh, 'staffelNr'))
  pruefe('… und dem Menütext samt Folgenzahl', eindeutig(roh, 'staffelText').join() === 'Staffel 2 (13 Folgen) · von 2', eindeutig(roh, 'staffelText'))
  pruefe('… die Nummer innerhalb der Staffel beginnt bei 1', Math.min(...roh.map((r) => r.nummer)) === 1, roh.map((r) => r.nummer))
  pruefe('… und der Folgentitel geht mit', roh.every((r) => /^Karte \d+$/.test(r.titel ?? '')), roh.map((r) => r.titel))

  const s1 = await gemeldet({ fx: d, kopf: 'Staffel 1', gruppe: staffelFolgen(1, 12), alle: [...staffelFolgen(1, 12), ...staffelFolgen(2, 13, 13)] })
  pruefe('Dangers Staffel 1 (Treffer vorn): Nummer 1, „Staffel 1 (12 Folgen)“', eindeutig(s1, 'staffelNr').join() === '1' && eindeutig(s1, 'staffelText').join() === 'Staffel 1 (12 Folgen) · von 2', [eindeutig(s1, 'staffelNr'), eindeutig(s1, 'staffelText')])

  const v = FX.vier
  const lang = { 1: 25, 2: 13, 3: 9, 4: 7 }
  const alleVier = Object.entries(lang).flatMap(([nr, n]) => staffelFolgen(nr, n))
  for (const nr of [1, 2, 3, 4]) {
    /* Im Durchgang zeigt das Feld „Alle Folgen anzeigen“: die Gruppe findet ihren Eintrag über die Folgenzahl. */
    const r = await gemeldet({ fx: v, kopf: 'Alle Folgen anzeigen', gruppe: staffelFolgen(nr, lang[nr]), alle: alleVier })
    pruefe(`vier Staffeln, Gruppe ${nr} über die Folgenzahl: Nummer ${nr}`, eindeutig(r, 'staffelNr').join() === String(nr), eindeutig(r, 'staffelNr'))
    pruefe(`… Text „Staffel ${nr} (${lang[nr]} Folgen)“`, eindeutig(r, 'staffelText').join() === `Staffel ${nr} (${lang[nr]} Folgen) · von 4`, eindeutig(r, 'staffelText'))
  }

  return roh
}

/** Zwei Staffeln gleicher Länge, Kennungen aus dem Player, Kapitel. */
async function vinlandFaelle() {
  const d = FX.dangers
  const vi = FX.vinland
  const gleich = [...staffelFolgen(1, 24), ...staffelFolgen(2, 24)]
  const zwei = await gemeldet({ fx: vi, kopf: vi.kopf, gruppe: staffelFolgen(2, 24), alle: gleich })
  pruefe('Vinland, zwei Staffeln zu 24, Feld zeigt „Staffel 2“: Nummer 2', eindeutig(zwei, 'staffelNr').join() === '2', eindeutig(zwei, 'staffelNr'))
  const ratlos = await gemeldet({ fx: vi, kopf: 'Alle Folgen anzeigen', gruppe: staffelFolgen(2, 24), alle: gleich })
  pruefe('Vinland, Feld zeigt „Alle Folgen anzeigen“: keine geratene Nummer', eindeutig(ratlos, 'staffelNr').join() === '', eindeutig(ratlos, 'staffelNr'))

  const u = FX.unicorn
  const kapitel = await gemeldet({ fx: u, kopf: u.kopf, gruppe: staffelFolgen(2, 12), alle: [...staffelFolgen(1, 8), ...staffelFolgen(2, 12)] })
  pruefe('Unicorn Academy „Kapitel 2“: Nummer 2, „Kapitel 2 (12 Folgen)“', eindeutig(kapitel, 'staffelNr').join() === '2' && eindeutig(kapitel, 'staffelText').join() === 'Kapitel 2 (12 Folgen) · von 2', [eindeutig(kapitel, 'staffelNr'), eindeutig(kapitel, 'staffelText')])

}

/** Einstaffel-Titel, veraltetes Menü, Lücken und Rückfälle. */
async function einstaffelFaelle() {
  const d = FX.dangers
  const e = FX.einstaffel
  const ein = await gemeldet({ fx: e, kopf: e.kopf, gruppe: staffelFolgen(7, 15) })
  pruefe('Einstaffel-Titel ohne Auswahlfeld: Rohfolgen kommen an, ohne Nummer', ein.length > 0 && eindeutig(ein, 'staffelNr').join() === '', [ein.length, eindeutig(ein, 'staffelNr')])
  pruefe('… der Text bleibt die Netflix-Kennung der Staffel', eindeutig(ein, 'staffelText').join() === '7', eindeutig(ein, 'staffelText'))
  /* Unsere eigene Nummer (ein Eintrag im Bestand) bleibt der Rückfall, wo das Feld nichts nennt. */
  const unsere = await gemeldet({ fx: e, kopf: e.kopf, gruppe: staffelFolgen(7, 15), vorlauf: `offeneTitel['${e.reihe}'] = { staffeln: [{ id: 5, nr: 1 }] }` })
  pruefe('Einstaffel-Titel mit einem Eintrag im Bestand: dessen Nummer', eindeutig(unsere, 'staffelNr').join() === '1', eindeutig(unsere, 'staffelNr'))

  /* Zwei Staffeln, aber nur ein Eintrag im Bestand: unsere Nummer 1 darf Netflix' Staffel 2 nicht überschreiben. */
  const ueber = await gemeldet({ fx: d, kopf: d.kopf, gruppe: staffelFolgen(2, 13, 13), alle: [...staffelFolgen(1, 12), ...staffelFolgen(2, 13, 13)], vorlauf: `offeneTitel['${d.reihe}'] = { staffeln: [{ id: 5, nr: 1 }] }` })
  pruefe('Netflix-Staffel 2, im Bestand nur Nummer 1: es bleibt Staffel 2', eindeutig(ueber, 'staffelNr').join() === '2', eindeutig(ueber, 'staffelNr'))

  /* Die Folgenkennungen des Players sind sicher: sie gewinnen gegen die Folgenzahl. */
  const sicher = await gemeldet({ fx: d, kopf: 'Alle Folgen anzeigen', gruppe: staffelFolgen(2, 13, 13), alle: [...staffelFolgen(1, 12), ...staffelFolgen(2, 13, 13)], vorlauf: `stand.staffeln = [{ seq: 1, ids: ${JSON.stringify(staffelFolgen(1, 12).map((f) => f.videoId))} }, { seq: 2, ids: ${JSON.stringify(staffelFolgen(2, 13).map((f) => f.videoId))} }]` })
  pruefe('Kennungen aus dem Player: Staffel 2', eindeutig(sicher, 'staffelNr').join() === '2' && eindeutig(sicher, 'staffelText').join() === 'Staffel 2 (13 Folgen) · von 2', [eindeutig(sicher, 'staffelNr'), eindeutig(sicher, 'staffelText')])

  /* Zwei Staffeln gleicher Länge: nur die Kennungen aus dem Player sagen, welche gemeint ist. */
  const vi2 = FX.vinland
  const gleich2 = [...staffelFolgen(1, 24), ...staffelFolgen(2, 24)]
  const ids24 = (n) => JSON.stringify(staffelFolgen(n, 24).map((f) => f.videoId))
  const tiefe = await gemeldet({ fx: vi2, kopf: 'Alle Folgen anzeigen', gruppe: staffelFolgen(2, 24), alle: gleich2, vorlauf: `stand.staffeln = [{ seq: 1, ids: ${ids24(1)} }, { seq: 2, ids: ${ids24(2)} }]` })
  pruefe('Vinland mit Kennungen aus dem Player: Staffel 2, Text „Staffel 2 (24 Folgen)“', eindeutig(tiefe, 'staffelNr').join() === '2' && eindeutig(tiefe, 'staffelText').join() === 'Staffel 2 (24 Folgen) · von 2', [eindeutig(tiefe, 'staffelNr'), eindeutig(tiefe, 'staffelText')])

  /* Der Einzelweg (`durchlaufMelden`, voller Lauf) trägt dieselben Angaben. */
  const eins = await gemeldet({ fx: d, kopf: d.kopf, gruppe: staffelFolgen(2, 13, 13), alle: [...staffelFolgen(1, 12), ...staffelFolgen(2, 13, 13)], einzel: true })
  pruefe('Einzelmeldung einer Folge: Staffel 2, „Staffel 2 (13 Folgen)“, Nummer 4', eins.length === 1 && eins[0].staffelNr === 2 && eins[0].staffelText === 'Staffel 2 (13 Folgen) · von 2' && eins[0].nummer === 4, eins.map((r) => [r.staffelNr, r.staffelText, r.nummer]))

  /* Das Menü des vorigen Titels gilt nicht für den nächsten: Einstaffel-Titel mit 12 Folgen nach Dangers (12 + 13). */
  const nach = await gemeldet({ fx: e, kopf: e.kopf, gruppe: staffelFolgen(7, 12), davor: { fx: d, kopf: d.kopf }, einzel: true })
  pruefe('Einstaffel-Titel nach Dangers: kein fremdes Menü (keine Nummer, kein Menütext)', nach.length === 1 && nach[0].staffelNr === null && nach[0].staffelText === '7', nach.map((r) => [r.staffelNr, r.staffelText]))
  const nachStapel = await gemeldet({ fx: e, kopf: e.kopf, gruppe: staffelFolgen(7, 12), davor: { fx: d, kopf: d.kopf } })
  pruefe('… ebenso im Stapel der Randprobe', nachStapel.length > 0 && eindeutig(nachStapel, 'staffelNr').join() === '' && eindeutig(nachStapel, 'staffelText').join() === '7', [eindeutig(nachStapel, 'staffelNr'), eindeutig(nachStapel, 'staffelText')])

  /* Zwei Einträge im Bestand, kein Menü: unsere Nummer 1 wäre geraten. */
  const zwei2 = await gemeldet({ fx: e, kopf: e.kopf, gruppe: staffelFolgen(7, 15), vorlauf: `offeneTitel['${e.reihe}'] = { staffeln: [{ id: 5, nr: 1 }, { id: 6, nr: 2 }] }` })
  pruefe('zwei Einträge im Bestand ohne Menü: keine Nummer', eindeutig(zwei2, 'staffelNr').join() === '', eindeutig(zwei2, 'staffelNr'))

  /* Nummer aus den Kennungen ohne Menüeintrag: Nummer ja, aber kein Menütext einer anderen Staffel. */
  const luecke = await gemeldet({ fx: d, kopf: 'Alle Folgen anzeigen', gruppe: staffelFolgen(5, 13), alle: [...staffelFolgen(1, 12), ...staffelFolgen(5, 13)], vorlauf: `stand.staffeln = [{ seq: 5, ids: ${JSON.stringify(staffelFolgen(5, 13).map((f) => f.videoId))} }]` })
  pruefe('Kennungen nennen Staffel 5, das Menü hat nur 1 und 2: Nummer 5, Text ohne Folgenzahl', eindeutig(luecke, 'staffelNr').join() === '5' && !/Folgen/.test(eindeutig(luecke, 'staffelText').join()), [eindeutig(luecke, 'staffelNr'), eindeutig(luecke, 'staffelText')])

  /* Das Feld zeigt „Staffel 3“, die Gruppe hat 24 Folgen, Staffel 3 hat 10: die Anzeige gilt nicht. */
  const u2 = FX.ungleich
  const falsch = await gemeldet({ fx: u2, kopf: 'Staffel 3', gruppe: staffelFolgen(2, 24), alle: [...staffelFolgen(1, 24), ...staffelFolgen(2, 24), ...staffelFolgen(3, 10)] })
  pruefe('Anzeige „Staffel 3“, Gruppe mit 24 Folgen: keine Nummer geraten', eindeutig(falsch, 'staffelNr').join() === '', eindeutig(falsch, 'staffelNr'))
}

/** Der Worker liest nur, was in `rohZeile` steht; ein Feld, das er nicht liest, ginge verloren. */
function workerFelder(roh) {
  const quelle = readFileSync(__dirname + '/../worker/src/pruefung-rohfolgen-speichern.ts', 'utf8')
  const gelesen = new Set([...quelle.matchAll(/\bf\.([A-Za-z_]+)/g)].map((m) => m[1]))
  const gesendet = new Set(roh.flatMap((r) => Object.keys(r)))
  /* `art` steckt in der Beobachtung und gehört der Meldung (`index.ts`), nicht der Rohzeile. */
  const verloren = [...gesendet].filter((k) => !gelesen.has(k) && k !== 'art')
  pruefe('der Worker liest `staffelNr` und `staffelText`', gelesen.has('staffelNr') && gelesen.has('staffelText'), [...gelesen])
  pruefe('jedes gesendete Feld der Rohfolge liest der Worker', verloren.length === 0, verloren)
}

void (async () => {
  console.log('Netflix: Staffelwahl in der Meldung\n')
  parseFaelle()
  const roh = await meldungsFaelle()
  await vinlandFaelle()
  await einstaffelFaelle()
  workerFelder(roh)
  console.log('')
  if (faelle.includes(false)) {
    console.error('Zusicherungen gerissen.')
    process.exit(1)
  }
  console.log('Alle Zusicherungen zur Staffelwahl halten.')
})()
