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
    if (String(url).endsWith('/vorfall')) return { ok: true, json: async () => ({ ok: true }) }
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
  for (const datei of ['box.js', 'offene-netflix.js', 'pruefstand-zeit.js', 'disney-netz.js', 'netflix-gemeldet.js', 'netflix-durchgang-schutz.js', 'netflix-uebernahme.js', 'netflix-randvoll.js', 'netflix-erinnern.js', 'netflix-zurueckgestellt.js', 'melder.js']) {
    vm.runInContext(readFileSync(__dirname + '/' + datei, 'utf8'), kontext, { filename: datei })
  }
  return { umgebung, body, takte }
}

const knopfText = (s) => s.text()

async function abschlussFaelle() {
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

}

async function neueFolgenFaelle() {
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

  /* 8. Neue Folgen innerhalb der 36 Stunden gewinnen gegen den Merker. */
  const i = await seite({ bekannt: 11 })
  await i.run('durchlaufStarten()')
  i.run('durchlaufKnopfZeigen()')
  pruefe('(Vorbereitung) der Lauf endet mit „✓ gemeldet“', knopfText(i) === '✓ gemeldet', knopfText(i))
  i.run(`DURCHLAUF.folgen = DURCHLAUF.folgen.concat([{ nummer: 16, videoId: 82719224, seasonId: 's1', titel: 'F16' }]); DURCHLAUF.alleFolgen = DURCHLAUF.folgen; durchlaufKnopfZeigen()`)
  pruefe('Folge 16 kommt dazu: „Neue Folge 16“ statt „✓ gemeldet“', knopfText(i) === 'Neue Folge 16 · prüfen und melden', knopfText(i))
  pruefe('… und der Knopf ist wieder klickbar', i.run('DURCHLAUF.knopf.disabled') === false)

}

/**
 * **Der Rücksprung vom 10.10.2026 (4.24.22): Der Worker speichert alle Stapel, bestätigt aber einen nicht.**
 *
 * Die Randprobe über 15 Folgen geht als Stapel 10 + 5 raus; `DURCHLAUF.gemeldet` füllt sich nur aus den
 * Bestätigungen. Fehlte sie beim ersten Stapel, stand lokal "▶ E1 + E10 prüfen → gilt für E1-10" — genau Daniels
 * Text —, obwohl der Briefkasten alle 15 führte. Der Abschluss fragt jetzt den Briefkasten.
 */
async function stapelFaelle() {
  const s = await seite()
  const echt = s.env.fetch
  let stapel = 0
  s.env.fetch = async (url, opt) => {
    if (opt?.method === 'POST' && JSON.parse(opt.body).stapel && stapel++ === 0) {
      await echt(url, opt) /* gespeichert … */
      return { ok: true, json: async () => ({ ergebnisse: JSON.parse(opt.body).stapel.map(() => ({ ok: false, status: 500 })) }) } /* … aber nicht bestätigt */
    }
    return echt(url, opt)
  }
  await s.run('durchlaufStarten()')
  await s.warte()
  pruefe('(Vorbereitung) alle 15 liegen im Briefkasten', s.briefkasten.length === 15, s.briefkasten.length)
  pruefe('erster Stapel nicht bestätigt: trotzdem „✓ gemeldet“ statt „E1 + E10“', knopfText(s) === '✓ gemeldet', knopfText(s))
  pruefe('… mit Merker', s.speicher.netflixGemeldet?.[REIHE]?.bis === 15, s.speicher.netflixGemeldet)
  pruefe('… und der Knopf ist nicht klickbar', s.run('DURCHLAUF.knopf.disabled') === true)

  /* Fehlt die Meldung wirklich im Briefkasten, bleibt der Knopf ehrlich. */
  const f = await seite()
  const echtF = f.env.fetch
  f.env.fetch = async (url, opt) => {
    if (opt?.method === 'POST' && JSON.parse(opt.body).stapel) {
      const b = JSON.parse(opt.body)
      b.stapel = b.stapel.slice(0, 5) /* nur fünf kommen an */
      await echtF(url, { ...opt, body: JSON.stringify(b) })
      return { ok: true, json: async () => ({ ergebnisse: b.stapel.map(() => ({ ok: true })) }) }
    }
    return echtF(url, opt)
  }
  await f.run('durchlaufStarten()')
  await f.warte()
  pruefe('Briefkasten wirklich unvollständig: kein „✓ gemeldet“', knopfText(f) !== '✓ gemeldet', knopfText(f))
  pruefe('… und kein Merker', !f.speicher.netflixGemeldet?.[REIHE], f.speicher.netflixGemeldet)
}

async function fehlerFaelle() {
  /* 9. Fehlerwege zeigen nie „✓ gemeldet“. */
  const ohneAbschluss = (name, s) => pruefe(name, knopfText(s) !== '✓ gemeldet', knopfText(s))
  const fehlschlag = await seite({ postOk: false })
  await fehlschlag.run('durchlaufStarten()')
  fehlschlag.run('durchlaufKnopfZeigen()')
  ohneAbschluss('Worker lehnt die Meldung ab: kein „✓ gemeldet“', fehlschlag)
  pruefe('… und kein Merker im Speicher', !fehlschlag.speicher.netflixGemeldet?.[REIHE], fehlschlag.speicher)

  const ohneTon = await seite()
  ohneTon.run('stand.spuren = null')
  await ohneTon.run('durchlaufStarten()')
  ohneTon.run('durchlaufKnopfZeigen()')
  ohneAbschluss('keine Tonspur gelesen: kein „✓ gemeldet“', ohneTon)

  const gestoert = await seite()
  gestoert.run('stand.spuren = null')
  gestoert.env.document.body.innerText = 'Fehler M7355'
  await gestoert.run('durchlaufStarten()')
  gestoert.run('durchlaufKnopfZeigen()')
  ohneAbschluss('Störung (M7355): kein „✓ gemeldet“', gestoert)

  /* Abbruch und uneinheitliche Randprobe auch dann, wenn alle Folgen gemeldet wären. */
  for (const [name, feld] of [['Abbruch', 'abbruch'], ['uneinheitliche Randprobe', 'randOffen'], ['Störung', 'stoerung']]) {
    const k = await seite()
    k.run("DURCHLAUF.laeuft = true; durchlaufKnopfZeigen(); DURCHLAUF.laeuft = false")
    k.run(`DURCHLAUF.gemeldet = new Set(DURCHLAUF.folgen.map((f) => f.videoId)); DURCHLAUF.${feld} = ${feld === 'randOffen' ? '{ folgen: [] }' : 'true'}; durchlaufKnopfZeigen()`)
    ohneAbschluss(`${name} trotz vollständigem Stand: kein „✓ gemeldet“`, k)
    pruefe(`… und kein Merker (${name})`, !k.speicher.netflixGemeldet?.[REIHE], k.speicher)
  }

}

/**
 * **Uneinheitliche Randprobe (4.30.0, 12.10.2026, Netflix 80174608): Folge 1 deutsch, Folge 9 an nicht.**
 *
 * Im Sammeldurchgang („▶ alle durchgehen") wartet niemand auf das Grenzfeld. Der nächste Anlauf desselben
 * Titels misst deshalb alle 15 Folgen einzeln; von Hand gestartet bleibt es beim Hinweis. Die Player-Seite
 * wird nachgestellt: `gehe('/watch/<id>')` setzt die Tonspuren der Folge.
 */
function gemischtStellen(s) {
  s.posts = []
  s.vorfaelle = []
  const echt = s.env.fetch
  s.env.fetch = async (url, opt) => {
    if (opt?.method === 'POST' && url.endsWith('/vorfall')) s.vorfaelle.push(JSON.parse(opt.body))
    if (opt?.method === 'POST' && !url.endsWith('/vorfall')) s.posts.push(JSON.parse(opt.body))
    return echt(url, opt)
  }
  s.env.history = {
    pushState(_a, _b, pfad) {
      const id = /\/watch\/(\d+)/.exec(String(pfad))?.[1]
      if (!id) return
      const deutsch = Number(id) - 82719208 < 9
      const spuren = deutsch ? [{ code: 'de', name: 'Deutsch' }, { code: 'ja', name: 'Japanisch' }] : [{ code: 'ja', name: 'Japanisch' }]
      s.run(`stand.spuren = ${JSON.stringify(spuren)}`)
    },
  }
}

/** Sammeldurchgang so weit nachgestellt, dass `selbstStartenSchritt()` diese Seite aufnimmt. */
function sammelnStellen(s) {
  s.run(`selbstAn = true; selbstGesammelt.add('${REIHE}'); DURCHLAUF.listeFuer = '${REIHE}'`)
  s.run(`offeneTitel['${REIHE}'] = { titel: 'Test', staffeln: [{ seq: 1, offen: true }] }`)
}

/** Alle Meldungen des Laufs als Einzel- oder Stapelmeldung: Folgennummer → `true`, wenn Deutsch dabei war. */
const gemeldeteSprachen = (s) =>
  new Map(
    s.posts
      .flatMap((b) => b.stapel ?? [b])
      .map((d) => [Number(d.folge_nr ?? d.rohfolgen?.[0]?.nummer), (d.sprachen ?? []).some((x) => x.startsWith('de|'))]),
  )

async function randvollFaelle() {
  /* 10. Sammeldurchgang: gemischte Randprobe → kein Warten auf das Feld, der nächste Anlauf misst alle 15. */
  const a = await seite()
  gemischtStellen(a)
  sammelnStellen(a)
  await a.run('selbstStartenSchritt()')
  await a.warte()
  const gemeldet = gemeldeteSprachen(a)
  pruefe('Sammeldurchgang: alle 15 Folgen liegen im Briefkasten', a.briefkasten.length === 15, a.briefkasten.length)
  const zaehlungen = a.vorfaelle.filter((v) => v.art === 'durchgang-zaehlung')
  const zahlen = zaehlungen[0] ? JSON.parse(zaehlungen[0].text) : null
  pruefe('Durchgang-Ende: genau ein /vorfall durchgang-zaehlung, Text = JSON der Zahlen', zaehlungen.length === 1 && zahlen && ['besucht', 'gemessen', 'wartend', 'uebersprungen'].every((k) => Number.isFinite(zahlen[k])), a.vorfaelle)
  const groessen = a.posts.map((b) => b.stapel?.length ?? 0)
  pruefe('… in zwei Stapel-POSTs gesendet (8 mit Deutsch, 7 ohne), nicht 15 einzeln', groessen.length === 2 && groessen.includes(8) && groessen.includes(7), groessen)
  const notizen = a.posts.flatMap((b) => b.stapel ?? []).map((d) => d.notiz)
  pruefe('… alle als gemessen, keine Annahme in der Notiz', notizen.length === 15 && notizen.every((n) => /^Gemessen im vollen Lauf/.test(n) && !/ANGENOMMEN/.test(n)), notizen.slice(0, 2))
  pruefe('… Folge 1–8 mit Deutsch, Folge 9–15 ohne', [...gemeldet].every(([nr, de]) => de === nr <= 8) && gemeldet.size === 15, [...gemeldet])
  pruefe('… kein Grenzfeld offen', a.run('DURCHLAUF.randOffen') === null, a.run('DURCHLAUF.randOffen'))
  pruefe('… der Merker ist verbraucht', a.run('DURCHLAUF.vollLauf') === null, a.run('DURCHLAUF.vollLauf'))

  /* 11. Von Hand gestartet: es bleibt beim Hinweis, nichts wird gemeldet, nichts läuft von allein weiter. */
  const b = await seite()
  gemischtStellen(b)
  await b.run('durchlaufStarten()')
  await b.warte()
  pruefe('Einzeltitel: nichts gemeldet', b.briefkasten.length === 0 && b.posts.length === 0, b.posts.length)
  pruefe('… das Grenzfeld wartet auf Daniel (`randOffen`)', Boolean(b.run('DURCHLAUF.randOffen')), b.run('DURCHLAUF.randOffen'))
  pruefe('… kein Merker für einen vollen Lauf', !b.run('DURCHLAUF.vollLauf'), b.run('DURCHLAUF.vollLauf'))

  /* 12. Der echte Limit-Pfad: `tageslimit.js` liest die 429 des Workers, `AK_TAGESLIMIT.fehlgeschlagen` setzt `abbruch`. */
  const c = await seite()
  gemischtStellen(c)
  sammelnStellen(c)
  const echtC = c.env.fetch
  c.env.fetch = async (url, opt) => {
    if (opt?.method !== 'POST' || url.endsWith('/vorfall')) return echtC(url, opt)
    c.posts.push(JSON.parse(opt.body))
    const inhalt = { tageslimit: true, retryAfter: 3600 }
    return { ok: false, status: 429, clone: () => ({ json: async () => inhalt }), json: async () => inhalt }
  }
  vm.runInContext(readFileSync(__dirname + '/tageslimit.js', 'utf8'), c.env.__kontext, { filename: 'tageslimit.js' })
  await c.run('selbstStartenSchritt()')
  await c.warte()
  pruefe('Tageslimit (429 des Workers): nur der erste Stapel geht raus, die zweite Gruppe entfällt', c.posts.length === 1, c.posts.length)
  pruefe('… das Limit ist erkannt (`AK_TAGESLIMIT.aktiv`)', c.run('AK_TAGESLIMIT.aktiv()') === true)
  pruefe('… nichts im Briefkasten, nichts als gemeldet vermerkt', c.briefkasten.length === 0 && c.run('DURCHLAUF.gemeldet.size') === 0, c.briefkasten.length)

  /* 13. Stoppt Daniel zwischen Lauf 1 und Lauf 2, bleibt kein Merker für einen vollen Lauf stehen. */
  const d = await seite()
  gemischtStellen(d)
  d.run('selbstAn = true; DURCHLAUF.selbst = true; DURCHLAUF.erzwungen = true')
  await d.run('durchlaufStarten()')
  pruefe('(Vorbereitung) nach Lauf 1 wartet der Merker auf Lauf 2', d.run('DURCHLAUF.vollLauf') === REIHE, d.run('DURCHLAUF.vollLauf'))
  d.run("laufBeenden('von Hand')")
  pruefe('Stopp von Hand löscht den Merker', d.run('DURCHLAUF.vollLauf') === null, d.run('DURCHLAUF.vollLauf'))
}

/**
 * **Randprobe über 15 Folgen (4.30.2): die zwei Randfolgen gehen als gemessen raus, nur die dazwischen als Annahme.**
 *
 * Bis 4.30.1 trug jede Folge die Notiz „ANGENOMMEN aus Randprobe"; `fetch-urteile.ts` machte daraus auch für
 * E1 und E15 eine Annahme. Jetzt sagt das die `art` der Meldung (und der Rohfolge), die Notiz der Randfolgen
 * trägt das Wort nicht. Und die Stapel (10 + 5) gehen nacheinander raus: bei einer 429 kommt der zweite nicht mehr an.
 */
async function annahmeFaelle() {
  const s = await seite()
  s.posts = []
  const echt = s.env.fetch
  s.env.fetch = async (url, opt) => {
    if (opt?.method === 'POST' && !url.endsWith('/vorfall')) s.posts.push(JSON.parse(opt.body))
    return echt(url, opt)
  }
  await s.run('durchlaufStarten()')
  await s.warte()
  const meldungen = s.posts.flatMap((b) => b.stapel ?? [b])
  const je = (nr) => meldungen.find((d) => d.folge_nr === nr)
  const randfolgen = [1, 15].map(je)
  const dazwischen = meldungen.filter((d) => d.folge_nr > 1 && d.folge_nr < 15)
  pruefe('Randprobe: 15 Meldungen in zwei Stapeln (10 + 5)', meldungen.length === 15 && s.posts.map((b) => b.stapel.length).join() === '10,5', s.posts.map((b) => b.stapel?.length))
  pruefe('… E1 und E15 gehen als gemessen raus', randfolgen.every((d) => d.art === 'gemessen'), randfolgen.map((d) => d?.art))
  pruefe('… ihre Notiz trägt nicht das Wort ANGENOMMEN, nennt aber die Randprobe', randfolgen.every((d) => !/ANGENOMMEN/.test(d.notiz) && /^Gemessen in der Randprobe — gemessen: Folge 1 und 15/.test(d.notiz)), randfolgen.map((d) => d?.notiz))
  pruefe('… ihre Rohfolge ist nicht angenommen', randfolgen.every((d) => d.rohfolgen[0].art === 'gemessen' && d.rohfolgen[0].roh.angenommen === false), randfolgen.map((d) => d.rohfolgen[0].roh))
  pruefe('… E2–E14 gehen als angenommen raus (Meldung, Notiz, Rohfolge)', dazwischen.length === 13 && dazwischen.every((d) => d.art === 'angenommen' && /^ANGENOMMEN aus Randprobe/.test(d.notiz) && d.rohfolgen[0].art === 'angenommen' && d.rohfolgen[0].roh.angenommen === true), dazwischen.map((d) => d.art))

  /* Bei einer 429 des ersten Stapels kommt der zweite nicht mehr an den Worker. */
  const c = await seite()
  c.posts = []
  const echtC = c.env.fetch
  c.env.fetch = async (url, opt) => {
    if (opt?.method !== 'POST' || url.endsWith('/vorfall')) return echtC(url, opt)
    c.posts.push(JSON.parse(opt.body))
    const inhalt = { tageslimit: true, retryAfter: 3600 }
    return { ok: false, status: 429, clone: () => ({ json: async () => inhalt }), json: async () => inhalt }
  }
  vm.runInContext(readFileSync(__dirname + '/tageslimit.js', 'utf8'), c.env.__kontext, { filename: 'tageslimit.js' })
  await c.run('durchlaufStarten()')
  await c.warte()
  pruefe('Randprobe über 15 Folgen, 429 beim ersten Stapel: nur ein POST', c.posts.length === 1 && c.posts[0].stapel.length === 10, c.posts.map((b) => b.stapel?.length))
  pruefe('… das Limit ist erkannt, nichts als gemeldet vermerkt', c.run('AK_TAGESLIMIT.aktiv()') === true && c.run('DURCHLAUF.gemeldet.size') === 0)
}

void (async () => {
  console.log('Netflix: Abschluss „✓ gemeldet“ und „Neue Folgen“\n')
  await abschlussFaelle()
  await neueFolgenFaelle()
  await stapelFaelle()
  await fehlerFaelle()
  await randvollFaelle()
  await annahmeFaelle()
  console.log('')
  if (faelle.includes(false)) {
    console.error('Zusicherungen gerissen.')
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Abschluss halten.')
})()
