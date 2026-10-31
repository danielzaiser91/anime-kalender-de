/**
 * Der 500-ms-Takt des Prime-Durchgangs, **solange `amazon.js` noch auf eine Titel-Kennung wartet**
 * (11.10.2026). Ganzes Skript im Sandkasten, Uhr und Zeitgeber von Hand gedreht.
 *
 * Zwei Dinge dürfen nicht auseinanderfallen:
 * - Auf der Startseite (nie eine Kennung) muss der Takt laufen, sonst steht "alle durchgehen" ewig
 *   auf "Titel 1/116 · 0 Seiten gemeldet".
 * - Im Durchgangs-Frame darf er in dieser Zeit nicht laufen: `frameSchritt()` liest `frameZustand`,
 *   `knopf` und `gesehen`, die erst nach dem Warten angelegt werden (TDZ), jeder Takt würfe.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = ['box.js', 'melde-sperre.js', 'prime-titelseite.js', 'prime-stand-ziele.js', 'prime-region.js', 'prime-durchgang-suche.js', 'prime-treffer-kopf.js', 'amazon.js'].map((n) => readFileSync(__dirname + '/' + n, 'utf8')).join('\n')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function element() {
  return {
    className: '',
    isConnected: true,
    style: { cssText: '' },
    dataset: {},
    textContent: '',
    title: '',
    type: '',
    disabled: false,
    kinder: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    replaceChildren(...neu) { this.kinder = neu },
    appendChild(k) { this.kinder.push(k); return k },
    append(...neu) { this.kinder.push(...neu) },
    insertBefore(k) { this.kinder.push(k); return k },
    remove() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
  }
}

/** Lädt `amazon.js` einmal und liefert Zeitgeber, Warnungen und die gelesenen Speicherschlüssel. */
function lade({ imFrame, pfad, search = '', suche = {}, karten = [] }) {
  const w = { zeitgeber: [], warnungen: [], gelesen: [], absturz: null, gepostet: [], uhr: 1_000_000 }
  const fenster = { addEventListener() {}, location: { pathname: pfad, search }, name: imFrame ? 'ak-durchgang' : '' }
  fenster.top = imFrame ? {} : fenster
  fenster.parent = { postMessage: (d) => w.gepostet.push(d) }
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: {},
    AK_PRIME_SUCHE: suche,
    URLSearchParams,
    URL,
    location: { pathname: pfad, search, origin: 'https://www.amazon.de', href: 'https://www.amazon.de' + pfad },
    sessionStorage: {
      getItem: (k) => { w.gelesen.push(k); return null },
      setItem() {},
      removeItem() {},
    },
    document: {
      documentElement: { innerHTML: '<html></html>', classList: element().classList },
      body: element(),
      head: element(),
      title: 'Amazon.de',
      createElement: () => element(),
      querySelector: () => null,
      querySelectorAll: (sel) => (sel === 'article[data-testid="card"]' ? karten : []),
      addEventListener() {},
    },
    chrome: { runtime: { id: 'test' }, storage: { local: { get: () => ({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() } } },
    window: fenster,
    MutationObserver: class { observe() {} },
    requestAnimationFrame: () => 0,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    setInterval: () => 0,
    clearInterval() {},
    setTimeout: (fn, ms) => { w.zeitgeber.push({ fn, ms }); return 0 },
    console: { log() {}, warn: (...a) => w.warnungen.push(a.join(' ')), error() {} },
    performance: { now: () => Date.now() },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
  }
  sandkasten.Date = class extends Date {
    static now() {
      return w.uhr
    }
  }
  for (const name of ['JSON', 'Math', 'Set', 'Map', 'Number', 'String', 'Object', 'Array', 'Boolean', 'RegExp', 'Promise', 'Error']) {
    sandkasten[name] = globalThis[name]
  }
  sandkasten.encodeURIComponent = encodeURIComponent
  sandkasten.decodeURIComponent = decodeURIComponent
  sandkasten.globalThis = sandkasten
  fenster.document = sandkasten.document
  const lauf = vm.runInNewContext(quelle, sandkasten, { filename: 'amazon.js' })
  lauf.catch((e) => { w.absturz = e })
  return { w }
}

/** Dreht den Takt `runden` Mal: jeder angemeldete `primeTakt` läuft, seine Nachfolger kommen in die nächste Runde. */
function taktDrehen(w, runden) {
  let gelaufen = 0
  for (let i = 0; i < runden; i++) {
    const dran = w.zeitgeber.splice(0).filter((z) => z.fn.name === 'primeTakt')
    for (const z of dran) {
      z.fn()
      gelaufen++
    }
  }
  return gelaufen
}

const PRIME_LAUF = 'ak-prime-lauf'

async function haupt() {
  console.log('Prime-Durchgang: Takt, solange das Skript auf eine Kennung wartet\n')

  /* Startseite: keine Kennung, das Skript wartet — der Takt muss trotzdem laufen und den Lauf lesen. */
  {
    const { w } = lade({ imFrame: false, pfad: '/' })
    await new Promise((r) => setImmediate(r))
    pruefe('Startseite: das Skript wartet auf die Kennung (läuft ohne Absturz)', !w.absturz, w.absturz?.message)
    pruefe('Startseite: der Takt ist angemeldet, bevor eine Kennung da ist', w.zeitgeber.some((z) => z.fn.name === 'primeTakt' && z.ms === 500), w.zeitgeber.map((z) => z.fn.name))
    const gelaufen = taktDrehen(w, 6)
    pruefe('Startseite: der Takt läuft immer weiter', gelaufen === 6, gelaufen)
    pruefe('Startseite: er sucht den Durchgangs-Auftrag', w.gelesen.includes(PRIME_LAUF), [...new Set(w.gelesen)])
    pruefe('Startseite: der Takt wirft nicht', !w.warnungen.some((x) => /Takt wirft/.test(x)), w.warnungen)
  }

  /* Frame ohne Kennung: nichts darf werfen — der Takt ist hier noch gar nicht angemeldet (sein Zustand fehlt noch). */
  {
    const { w } = lade({ imFrame: true, pfad: '/' })
    await new Promise((r) => setImmediate(r))
    pruefe('Frame: das Skript wartet auf die Kennung (läuft ohne Absturz)', !w.absturz, w.absturz?.message)
    taktDrehen(w, 6)
    pruefe('Frame: beim Warten wirft kein Takt', !w.warnungen.some((x) => /Takt wirft/.test(x)), w.warnungen)
  }

  /* Frame mit Kennung (Titelseite einer Staffel): der Takt startet nach der Initialisierung und läuft. */
  {
    const { w } = lade({ imFrame: true, pfad: '/gp/video/detail/B07VP6VPVR' })
    await new Promise((r) => setImmediate(r))
    pruefe('Frame mit Kennung: das Skript läuft durch', !w.absturz, w.absturz?.message)
    pruefe('Frame mit Kennung: der Takt ist angemeldet', w.zeitgeber.some((z) => z.fn.name === 'primeTakt'), w.zeitgeber.map((z) => z.fn.name))
    taktDrehen(w, 6)
    pruefe('Frame mit Kennung: der Takt wirft nicht', !w.warnungen.some((x) => /Takt wirft/.test(x)), w.warnungen)
    w.uhr += 9000
    taktDrehen(w, 3)
    pruefe('Frame mit Kennung: er geht nicht den Such-Frame-Weg (keine Antwort Suchauftrag nicht erkannt)', !w.gepostet.some((d) => 'treffer' in d), w.gepostet)
  }

  /*
    **Such-Frame (Prüfer A1, 31.10.2026):** Auf `/s` gibt es nie eine Kennung; das Skript wartet dort fünf Minuten, und der Takt
    am Ende wurde nie erreicht. Der Durchgang lief in Wirklichkeit nie durch eine Suche. Hier läuft das ganze Skript.
  */
  {
    const karte = (titel, asin) => ({
      getAttribute: (n) => ({ 'data-card-title': titel, 'data-card-entity-type': 'Movie', 'data-card-entitlement': 'Unentitled' })[n] ?? null,
      closest: () => ({ getAttribute: () => 'Ergebnisse' }),
      querySelector: () => ({ getAttribute: () => `/gp/video/detail/${asin}?sr=1-1` }),
    })
    const karten = [karte('Operation Nussknacker', 'B087Y8ZNF8'), karte('Operation Nußknacker 2 - Voll auf die Nüsse', 'B0FNXJ6WD7'), karte('Voll auf die Nüsse', 'B00HFCZJWU')]
    const suche = {
      'https://www.amazon.de/s?k=Operation%20Nussknacker&i=instant-video': { titel: 'Operation: Nussknacker - Auf die Nüsse, fertig, los!', folgen: 1 },
    }
    const { w } = lade({ imFrame: true, pfad: '/s', search: '?k=Operation%20Nussknacker&i=instant-video', suche, karten })
    await new Promise((r) => setImmediate(r))
    pruefe('Such-Frame: das Skript läuft ohne Absturz', !w.absturz, w.absturz?.message)
    pruefe('Such-Frame: der Takt ist angemeldet, ohne dass eine Kennung da ist', w.zeitgeber.some((z) => z.fn.name === 'primeTakt' && z.ms === 500), w.zeitgeber.map((z) => z.fn.name))
    taktDrehen(w, 3)
    pruefe('Such-Frame: vor Ablauf von 3 s keine Antwort', w.gepostet.length === 0, w.gepostet)
    w.uhr += 3500
    taktDrehen(w, 2)
    pruefe('Such-Frame: der Takt arbeitet die Suche ab und meldet den genauen Treffer', w.gepostet.length === 1 && w.gepostet[0].ok === true && w.gepostet[0].treffer.join() === 'B087Y8ZNF8', w.gepostet)
    pruefe('Such-Frame: der Takt wirft nicht', !w.warnungen.some((x) => /Takt wirft/.test(x)), w.warnungen)
    taktDrehen(w, 2)
    pruefe('Such-Frame: genau eine Antwort', w.gepostet.length === 1, w.gepostet.length)

    /* Gegenprobe: dieselbe Seite als sichtbare Seite (kein Frame) startet keinen Such-Frame-Weg. */
    const sichtbar = lade({ imFrame: false, pfad: '/s', search: '?k=Operation%20Nussknacker&i=instant-video', suche, karten }).w
    await new Promise((r) => setImmediate(r))
    sichtbar.uhr += 3500
    taktDrehen(sichtbar, 3)
    pruefe('Gegenprobe: eine sichtbare Suchseite postet keine Frame-Antwort', sichtbar.gepostet.length === 0, sichtbar.gepostet)
  }

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Takt halten.')
}

haupt()
