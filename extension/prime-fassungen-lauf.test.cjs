/**
 * Prime: die Fassungen im Kasten der Titelseite — der Lauf durch `amazon.js` (24.10.2026).
 *
 * Der Briefkasten antwortet asynchron; der Test wartet die Mikrotasks ab, damit die Weiche
 * „Auswahl schon bestätigt" und die Zugangsart der eigenen Seite (Leser-Nachricht) wirken.
 * Die Zeit ist fest (3000), nie die echte Uhr.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (n) => readFileSync(__dirname + '/' + n, 'utf8')
const FIXTURE = lies('prime-fassungen.fixture.json')
const SUCHE = 'https://www.amazon.de/s?k=Fischen+Impossible&i=instant-video'
const FEST = 32503680000000
const SELBST = '/gp/video/detail/B01MSMV5MA'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = ['box.js', 'melde-sperre.js', 'prime-region.js', 'prime-fassungen.js', 'amazon.js'].map(lies).join('\n')
const GLOBALE = Object.fromEntries(
  [Date, JSON, Math, Set, Map, Number, String, Object, Array, Boolean, RegExp, Promise, Error].map((f) => [f.name, f]),
)
GLOBALE.encodeURIComponent = encodeURIComponent
GLOBALE.decodeURIComponent = decodeURIComponent

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
    hoerer: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    replaceChildren(...neu) { this.kinder = neu },
    appendChild(k) { this.kinder.push(k); return k },
    append(...k) { this.kinder.push(...k) },
    insertBefore(k) { this.kinder.push(k); return k },
    remove() {},
    addEventListener(art, fn) { this.hoerer[art] = fn },
    querySelector(sel) {
      const klasse = String(sel).trim().split(/\s+/).pop().replace(/^\./, '')
      for (const k of this.kinder) {
        if (String(k?.className ?? '').split(/\s+/).includes(klasse)) return k
        const tiefer = k?.querySelector?.(sel)
        if (tiefer) return tiefer
      }
      return null
    },
    querySelectorAll: () => [],
    focus() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  }
}

/** Lädt amazon.js für `pfad`; `seite` kommt als Leser-Nachricht, `erwartungen` vom Briefkasten. */
async function lauf({ hydration, pfad = SELBST, seite = {}, erwartungen = {}, erwartet = undefined } = {}) {
  const angehaengt = []
  const handler = []
  const takte = []
  let geschickt = false
  const auftrag = { titel: 'Fischen Impossible', id: 1, suchUrl: SUCHE, zeit: FEST, erwartet }
  const speicher = { 'ak-prime-suchauftrag': JSON.stringify(auftrag) }
  const fenster = {
    addEventListener(art, fn) { if (art === 'message') handler.push(fn) },
    location: { pathname: pfad, search: '' },
  }
  const antwort = { imBriefkasten: {}, adressen: [], gemeldet: [], gemeldeteSeiten: [], erwartungen }
  const sandkasten = {
    globalThis: null,
    AK_OFFENE_AMAZON: {},
    AK_PRIME_SUCHE: { [SUCHE]: { titel: 'Fischen Impossible', id: 1 } },
    URLSearchParams,
    URL,
    location: { pathname: pfad, search: '', href: 'https://www.amazon.de' + pfad },
    sessionStorage: {
      getItem: (k) => speicher[k] ?? null,
      setItem: (k, v) => { speicher[k] = v },
      removeItem: (k) => { delete speicher[k] },
      clear() {},
    },
    document: {
      documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
      body: { ...element(), appendChild(k) { angehaengt.push(k); return k } },
      title: 'Amazon.de',
      createElement: () => element(),
      createTextNode: (t) => ({ textContent: t }),
      getElementById: (id) => (id === 'dv-web-page-hydration-data' ? hydration : null),
      querySelector: (sel) => (sel === '.ak-amazon-suchhinweis' ? angehaengt.find((e) => String(e.className).includes('ak-amazon-suchhinweis')) ?? null : null),
      querySelectorAll: () => [],
      addEventListener() {},
      head: element(),
    },
    chrome: { runtime: { id: 'test' }, storage: { local: { get: () => ({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() } } },
    window: fenster,
    MutationObserver: class { observe() {} },
    requestAnimationFrame: () => 0,
    fetch: (u) => {
      if (!geschickt && String(u).includes('stand=1')) {
        geschickt = true
        const daten = { marke: 'ak-amazon-folgen', fuerAdresse: pfad, gesamt: 1, seite }
        for (const h of handler) h({ source: fenster, data: daten })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(antwort) })
    },
    setInterval: (fn) => { takte.push(fn); return 0 },
    setTimeout: () => 0,
    clearInterval() {},
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => 0 },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    ...GLOBALE,
  }
  sandkasten.globalThis = sandkasten
  fenster.document = sandkasten.document
  let absturz = null
  try {
    vm.runInNewContext(quelle, sandkasten, { filename: 'amazon.js' })
  } catch (err) {
    absturz = err
  }
  const warte = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)) }
  await warte()
  for (const t of takte) t()
  await warte()
  return { absturz, angehaengt }
}

function zeilen(e, aus = []) {
  if (String(e?.className ?? '').split(/\s+/).includes('ak-such-auswahl')) aus.push(e)
  for (const k of e?.kinder ?? []) zeilen(k, aus)
  return aus
}
const zeilenText = (z) => (z.kinder ?? []).map((k) => k.textContent ?? '').join('')
/** Die Ankreuzzeilen der Fassungsauswahl (die Checkliste einer bestätigten Auswahl hat keine Ankreuzfelder). */
const auswahl = (l) => l.angehaengt.flatMap((e) => zeilen(e)).filter((z) => z.kinder[0]?.type === 'checkbox')
const texte = (l) => auswahl(l).map(zeilenText)
const daten = (f) => JSON.parse(JSON.stringify(f))

async function main() {
  console.log('Zusicherungen für die Fassungen im Kasten der Titelseite\n')
  const knoten = { textContent: FIXTURE }

  const basis = await lauf({ hydration: knoten })
  pruefe('Lauf ohne Absturz', !basis.absturz, basis.absturz?.message)
  const t = texte(basis)
  pruefe('drei Fassungen in der Auswahl', t.length === 3, t)
  pruefe('Kanal-Fassung mit Kanal-Abo-Beschriftung, Hinweis und Kennung',
    t.some((x) => x.includes('Kanal-Abo · Kanal · Originalversion') && x.includes('(B0GVNJRZCM)')), t)
  pruefe('Kauf-Fassung mit Hinweis und Kennung', t.some((x) => x.includes('Kauf/Abo · Kauf · Alternative Audiosprache') && x.includes('(B01HRLV328)')), t)
  pruefe('Reihenfolge: eigene Seite, Kauf, Kanal', /B01MSMV5MA/.test(t[0] ?? '') && /B01HRLV328/.test(t[1] ?? '') && /B0GVNJRZCM/.test(t[2] ?? ''), t)
  pruefe('nichts vorgekreuzt', auswahl(basis).every((z) => z.kinder[0].checked === false))
  pruefe('ohne Seitenstand und Serientitel steht der Auftragstitel für die eigene Seite', /diese Seite · Fischen Impos/.test(t[0] ?? ''), t[0])

  const prime = await lauf({ hydration: knoten, seite: { zugaenge: ['Prime'], serie: 'Zeta' } })
  pruefe('Prime-Zugang der eigenen Seite: Prime vorn, Titel der Seite', /Prime · diese Seite · Zeta/.test(texte(prime)[0] ?? ''), texte(prime))
  const kauf = await lauf({ hydration: knoten, seite: { kaufbar: true, leihbar: true } })
  pruefe('Kaufseite: die eigene Zeile heißt Kauf', /Kauf · diese Seite/.test(texte(kauf)[0] ?? ''), texte(kauf))
  const kanal = await lauf({ hydration: knoten, seite: { zugaenge: ['crunchyrollde'] } })
  pruefe('Kanalseite: die eigene Zeile heißt Kanal und steht hinter Kauf', /Kauf · Alternative/.test(texte(kanal)[0] ?? '') && /Kanal · diese Seite/.test(texte(kanal)[1] ?? ''), texte(kanal))
  pruefe('ohne Zugangsangabe heißt die eigene Zeile Fassung', /Fassung · diese Seite/.test(t.join('|')), t)

  // Weiche: schon bestätigte Auswahl (Briefkasten) schaltet die Fassungsauswahl ab
  const zwei = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA', 'B0BBBBBBBB'] } })
  pruefe('zwei bestätigte Ausgaben: keine Fassungsauswahl', auswahl(zwei).length === 0, texte(zwei))
  const eine = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA'] } })
  pruefe('eine bestätigte Ausgabe reicht nicht: Auswahl bleibt', auswahl(eine).length === 3, texte(eine))
  const drei = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA', 'B0BBBBBBBB', 'B0CCCCCCCC'] } })
  pruefe('drei bestätigte Ausgaben: keine Fassungsauswahl', auswahl(drei).length === 0, texte(drei))

  // A2: Block eines anderen Films nach SPA-Wechsel
  const fremd = await lauf({ hydration: knoten, pfad: '/gp/video/detail/B0ZZZZZZZZ' })
  pruefe('Block gehört zu einer anderen Adresse: keine Fassungen', !fremd.absturz && auswahl(fremd).length === 0, texte(fremd))

  // A3: GTI-Adresse
  const gti = 'amzn1.dv.gti.0a1b2c3d-4e5f-6789-abcd-ef0123456789'
  const gtiLauf = await lauf({ hydration: { textContent: FIXTURE.replace('/detail/B01MSMV5MA', '/detail/' + gti) }, pfad: '/gp/video/detail/' + gti })
  const gtiTexte = texte(gtiLauf)
  pruefe('GTI-Seite: drei Zeilen, die eigene trägt die GTI', gtiTexte.length === 3 && gtiTexte.some((x) => x.includes(`(${gti})`)), gtiTexte)

  // Gegenproben
  const ohneKnoten = await lauf({ hydration: null })
  pruefe('ohne Hydration-Knoten: keine Auswahl, kein Absturz', !ohneKnoten.absturz && auswahl(ohneKnoten).length === 0)
  const roh = daten(JSON.parse(FIXTURE))
  const behaelter = roh.init.preparations.body.btf.state.containers
  for (const k of Object.keys(behaelter)) behaelter[k] = behaelter[k].map((c) => ({ ...c, title: 'Ähnliche Titel' }))
  const ohneAbschnitt = await lauf({ hydration: { textContent: JSON.stringify(roh) } })
  pruefe('Seite ohne den Abschnitt: keine Auswahl', !ohneAbschnitt.absturz && auswahl(ohneAbschnitt).length === 0)

  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) rot.`)
    process.exit(1)
  }
  console.log('\nDie Fassungen im Kasten halten.')
}

main()
