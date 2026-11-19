/**
 * Verlässt die Seite den Titel, wird für ihn nichts mehr gemeldet (19.11.2026, Meldung 27504: „weg“ für Landei II mit 12
 * deutschen Folgen — das Panel trug noch den Titel der verlassenen Seite).
 *
 * Gespielt wird der echte Quelltext: die Regel (`titel-bindung.js`), Netflix (`melder.js` im Sandkasten) und der Klick-Handler
 * samt Zurücksetzen von Prime (`amazon.js`). Disney und ADN setzen dieselbe Regel ein (`titelBindung.karte()` / `gueltig()`).
 *
 * Aufruf: `node --require ./extension/test-kontext.cjs extension/titel-verlassen.test.cjs`
 */
const vm = require('node:vm')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const { baueUmgebung } = require('./test-melder-sandkasten.cjs')
const { lies, knopfNeu, ausschnitt, handlerKompilieren } = require('./melde-geruest.cjs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const tick = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r))
}

function regelLaden() {
  const k = vm.createContext({})
  k.globalThis = k
  vm.runInContext(lies('titel-bindung.js'), k)
  return k.akTitelBindung
}

function regel() {
  console.log('Regel: titel-bindung.js')
  const adresse = { kennung: 'A' }
  const aufrufe = []
  const b = regelLaden().fuer({ kennung: () => adresse.kennung, beiWechsel: (alt, neu) => aufrufe.push([alt, neu]) })
  const karte = b.karte()
  pruefe('auf der Titelseite gibt es eine Karte', karte !== null)
  pruefe('… und sie gilt, solange der Titel bleibt', b.gueltig(karte) === true)
  adresse.kennung = 'B'
  pruefe('Wechsel von Titel zu Titel entwertet die Karte nicht (das prüft der Anbieter selbst)', b.gueltig(karte) === true)
  adresse.kennung = null
  pruefe('Verlassen: die Karte gilt nicht mehr', b.gueltig(karte) === false)
  pruefe('… und eine neue Karte gibt es ohne Titel nicht', b.karte() === null)
  pruefe('… beiWechsel lief je Wechsel einmal (A→B, B→leer)', JSON.stringify(aufrufe) === JSON.stringify([['A', 'B'], ['B', null]]), aufrufe)
  b.pruefen()
  b.pruefen()
  pruefe('… und wiederholt nicht', aufrufe.length === 2, aufrufe)
  adresse.kennung = 'A'
  pruefe('Rückkehr zum selben Titel: die alte Karte bleibt entwertet', b.gueltig(karte) === false)
  pruefe('… eine neue gilt', b.gueltig(b.karte()) === true)
}

const ID = '80000001'
async function netflix() {
  console.log('Netflix: melder.js')
  const { umgebung, body } = baueUmgebung(`/title/${ID}`, '', {})
  umgebung.AbortController = AbortController
  umgebung.setTimeout = (fn) => { if (typeof fn === 'function') setImmediate(fn); return 0 }
  umgebung.history = { pushState() {}, replaceState() {} }
  umgebung.PopStateEvent = class { constructor(t) { this.type = t } }
  const kontext = vm.createContext(umgebung)
  ladeSkripte(kontext, skripteBis('melder.js').slice(0, -1))
  umgebung.AK_OFFENE_TITEL = { [ID]: { titel: 'Eins', staffeln: [{ nr: 1, folgen: 1, film: false, offen: true }] } }
  ladeSkripte(kontext, ['melder.js', 'netflix-bericht.js'])
  const posts = []
  umgebung.fetch = async (adresse, init) => {
    if (init?.method === 'POST') posts.push(JSON.parse(init.body))
    if (String(adresse).includes('stand=1')) return { ok: true, json: async () => ({ anbieter: [] }) }
    return { ok: true, json: async () => ({ paare: [] }), text: async () => '' }
  }
  await tick()
  const im = (code) => vm.runInContext(code, kontext)
  im(`stand.reihe = '${ID}'`)
  im('zeigeErgebnis = () => {}')
  body.innerText = 'Erinnern Ab 19. November'
  const gehe = (pfad) => {
    umgebung.location.pathname = pfad
    umgebung.location.href = `https://www.netflix.com${pfad}`
    im('pfadPruefen()')
  }

  await im('melden()')
  await tick()
  pruefe('Kontrolle: auf der Titelseite geht die Meldung raus', posts.length === 1 && String(posts[0].url).endsWith(`/title/${ID}`), posts)

  gehe('/browse')
  pruefe('Stöberseite: der Stand gehört keinem Titel mehr', im('stand.reihe') === null, im('stand.reihe'))
  const vor = posts.length
  await im('melden()')
  await tick()
  pruefe('… und ein Klick meldet nichts', posts.length === vor, posts.slice(vor))

  gehe(`/title/${ID}`)
  im(`stand.reihe = '${ID}'`)
  const mitten = im('melden()')
  gehe('/browse')
  await mitten
  await tick()
  pruefe('Wechsel mitten im Klick (während der Token geholt wird): nichts gesendet', posts.length === vor, posts.slice(vor))

  /* Im Player springt die Seite absichtlich: dort bleibt der Stand. */
  gehe(`/title/${ID}`)
  im(`stand.reihe = '${ID}'`)
  gehe(`/watch/${ID}`)
  pruefe('Player: der Stand bleibt', im('stand.reihe') === ID, im('stand.reihe'))
  /* Im Durchlauf ebenso, auch auf einer Seite ohne Titel. */
  im('DURCHLAUF.laeuft = true')
  gehe('/browse')
  pruefe('Durchlauf: der Stand bleibt auch auf der Stöberseite', im('stand.reihe') === ID, im('stand.reihe'))
  im('DURCHLAUF.laeuft = false')
  gehe(`/title/${ID}`)
  im('DURCHLAUF.alleFolgen = [1]; DURCHLAUF.folgen = [1]')
  gehe('/browse')
  pruefe('Verlassen leert auch die gesammelten Folgen', im('DURCHLAUF.alleFolgen.length') === 0 && im('DURCHLAUF.folgen.length') === 0)
}

const quelle = lies('amazon.js')
const A = 'B0LANDEI02'
const handler = ausschnitt(quelle, "knopf.addEventListener('click', meldeSperre.mitSperre(", '\n  }))\n').replace(/\)\)\n$/, '')

async function primeKlick({ vorKlick, mittendrin, mischung }) {
  const adresse = { kennung: A }
  const bindung = regelLaden().fuer({ kennung: () => adresse.kennung })
  const knopf = knopfNeu()
  const gesendet = []
  const gruende = []
  let tokenFreigabe
  const token = new Promise((r) => (tokenFreigabe = r))
  const echt = {
    knopf,
    meldeSperre: { mitSperre: (f) => f, vermerken: () => {} },
    verbindungLebt: () => true,
    standGeladen: true,
    erledigt: {},
    listenId: A,
    liste: {},
    location: { pathname: `/dp/${A}` },
    staffelSchluessel: () => 's1',
    staffelZahl: () => 1,
    seitenTitel: () => 'Landei II',
    deutschInFolgen: () => true,
    geladeneFolgen: () => 12,
    sprachenAusFolgen: () => ['Deutsch'],
    seitenLage: () => ({ folgenLautSeite: 12 }),
    gesehen: { gesamt: 2, jeFolge: mischung ? new Map([[1, ['Deutsch']], [2, ['日本語']]]) : null },
    hatDeutsch: (namen) => namen.includes('Deutsch'),
    eintrag: { url: `https://www.amazon.de/dp/${A}`, titel: 'Landei II' },
    quelltextVonFruehererSeite: () => false,
    asinAusAdresse: () => adresse.kennung,
    asinAusSeite: () => A,
    titelVerlassen: null,
    titelBindung: bindung,
    document: { querySelector: () => null },
    abweisen: (g) => gruende.push(g),
    abweisenMitGrund: (g) => gruende.push(g),
    WORKER: 'https://worker.test/pruefung',
    chrome: { storage: { sync: { get: () => token.then(() => ({ token: 'tok' })) } } },
    setTimeout: () => 0,
    fetch: async (url, opt) => {
      gesendet.push(String(opt?.body ?? url))
      if (mischung) adresse.kennung = null
      return { ok: true, status: 200, clone() { return this }, json: async () => ({}) }
    },
    speicherLesen: async () => ({}),
    speicherSchreiben: async () => {},
    briefkastenAdressen: new Set(),
    frischGemeldet: new Set(),
    uebersichtZeichnen: () => {},
    vorfallMelden: async () => {},
  }
  /* Die echten Prime-Hilfen (Widerspruch, Erlaubnis) wie im Browser. */
  const welt = vm.createContext({ Date, String, Number, Boolean, Object, JSON, Math, Set, setTimeout: () => 0 })
  welt.globalThis = welt
  for (const d of ['prime-stand.js', 'prime-region.js']) vm.runInContext(lies(d), welt)
  echt.globalThis = welt
  if (vorKlick) adresse.kennung = null
  const lauf = handlerKompilieren(handler, echt).klick(null)
  if (mittendrin) adresse.kennung = null
  tokenFreigabe()
  await lauf
  return { gesendet, gruende }
}

async function prime() {
  console.log('Prime: Klick')
  const gut = await primeKlick({})
  pruefe('Kontrolle: auf der Titelseite geht die Meldung raus', gut.gesendet.length === 1 && gut.gesendet[0].includes(A), gut)
  const nach = await primeKlick({ vorKlick: true })
  pruefe('nach dem Verlassen (Startseite): nichts gesendet', nach.gesendet.length === 0, nach)
  pruefe('… mit Grund', nach.gruende[0] === 'Kein Titel geöffnet', nach.gruende)
  const mitten = await primeKlick({ mittendrin: true })
  pruefe('Wechsel, während der Token geholt wird: nichts gesendet', mitten.gesendet.length === 0, mitten)
  /* Gemischte Staffel: je Folge eine Meldung; nach der ersten verlässt die Seite den Titel, die zweite bleibt aus. */
  const gemischt = await primeKlick({ mischung: true })
  pruefe('Wechsel zwischen zwei Folgenmeldungen: nur die erste ging raus', gemischt.gesendet.length === 1, gemischt.gesendet.length)
}

/** Das Zurücksetzen von Prime: so, als startete die Seite ohne Titel (`id` leer, Zählstand leer, Knopf gesperrt). */
function primeZuruecksetzen() {
  console.log('Prime: Zurücksetzen')
  const text = ausschnitt(quelle, 'globalThis.akTitelBindung.fuer({', '\n  })\n')
  const adresse = { kennung: A }
  const knopf = knopfNeu()
  const { klick: bindung, werte } = handlerKompilieren(`globalThis.akTitelBindung.fuer({${text.replace(/\n$/, '')}`, {
    knopf,
    asinAusAdresse: () => adresse.kennung,
    id: A,
    letzteKennung: 'x',
    gesehen: { alt: true },
    leererStand: () => ({ leer: true }),
    listenSchluessel: () => null,
    eintragFuer: () => ({ unbekannt: true }),
    letzterStand: 'x',
    eintrag: { titel: 'Landei II' },
    listenId: A,
    globalThis: { akTitelBindung: regelLaden() },
  })
  adresse.kennung = null
  bindung.pruefen()
  pruefe('ohne Titel in der Adresse ist die Kennung leer', werte.get('id') === null, werte.get('id'))
  pruefe('… der Zählstand ist leer', werte.get('gesehen')?.leer === true, werte.get('gesehen'))
  pruefe('… der Eintrag gehört nicht mehr zu Landei II', werte.get('eintrag')?.titel !== 'Landei II', werte.get('eintrag'))
  pruefe('… und der Knopf ist gesperrt', knopf.disabled === true, knopf.disabled)
  pruefe('… die Listenkennung ist leer', werte.get('listenId') === null, werte.get('listenId'))
  pruefe('… der letzte Stand ist vergessen (neu zeichnen)', werte.get('letzterStand') === '', werte.get('letzterStand'))
  pruefe('… und die Staffelkennung ist leer, damit die Rückkehr neu bindet', werte.get('letzteKennung') === '', werte.get('letzteKennung'))
  adresse.kennung = 'B0ANDERER'
  werte.set('id', 'B0ANDERER')
  bindung.pruefen()
  pruefe('Rückkehr auf einen Titel: nichts wird geleert, nur die Staffelkennung neu gelesen', werte.get('id') === 'B0ANDERER' && werte.get('letzteKennung') === '', werte.get('id'))
}

/** `beiStaffelwechsel()` darf ohne Titel in der Adresse keine Kennung aus dem veralteten Quelltext holen. */
function primeStaffelwechsel() {
  console.log('Prime: Staffelwechsel ohne Titelseite')
  const text = ausschnitt(quelle, 'function beiStaffelwechsel() {', '\n  }\n')
  const lauf = (imTitel) => {
    const { klick, werte } = handlerKompilieren(`function beiStaffelwechsel() {${text}`, {
      staffelKennung: () => 'neu',
      letzteKennung: 'alt',
      notiere: () => {},
      asin: () => 'B0VERALTET',
      titelBindung: { pruefen: () => imTitel },
      id: A,
      knopf: knopfNeu(),
      location: { search: '' },
    })
    klick()
    return werte.get('id')
  }
  pruefe('Kontrolle: auf einer Titelseite zieht die Kennung nach', lauf(true) === 'B0VERALTET')
  pruefe('ohne Titelseite bleibt `id` unberührt (kein Quelltext der alten Seite)', lauf(false) === A, lauf(false))
}

/** Die Adresswache fragt die Bindung bei jedem Wechsel der Adresse. */
function primeWache() {
  console.log('Prime: Adresswache')
  const text = ausschnitt(quelle, 'function adresseNeuPruefen() {', '\n  }\n')
  let gefragt = 0
  const { klick } = handlerKompilieren(`function adresseNeuPruefen() {${text}`, {
    location: { href: 'https://www.amazon.de/gp/video/storefront' },
    letzteAdresse: 'https://www.amazon.de/dp/B0LANDEI02',
    htmlNeuLesen: () => {},
    adressKennungFortschreiben: () => {},
    titelBindung: { pruefen: () => { gefragt++ } },
    langsam: false,
    taktSchritt: () => {},
  })
  klick()
  pruefe('ein Wechsel der Adresse fragt die Bindung', gefragt === 1, gefragt)
}

/** Disney+: der echte `melden()` aus disney.js; Adresse und Token von außen. */
async function disney() {
  console.log('Disney+: melden()')
  const text = lies('disney.js')
  const funktion = ausschnitt(text, 'async function melden() {', '\n  }\n')
  const lauf = async ({ verlassenVorKlick, verlassenMittendrin }) => {
    const adresse = { kennung: 'abc' }
    const gesendet = []
    let tokenFreigabe
    const token = new Promise((r) => (tokenFreigabe = r))
    const welt = {
      akTitelBindung: regelLaden(),
      akKontext: { lesen: () => token.then(() => ({ token: 'tok' })), keinTokenText: () => '' },
      AK_DISNEY_NETZ: { sende: async (url, init) => { gesendet.push(init.body); return { ok: true } } },
      AK_DISNEY_STAFFELN: { staffelnDerMeldung: () => [], titelIdFuer: () => null },
    }
    const bindung = welt.akTitelBindung.fuer({ kennung: () => adresse.kennung })
    const { klick } = handlerKompilieren(`async function melden() {${funktion}`, {
      titelBindung: bindung,
      ergebnisse: [{ staffel: 1, nummer: 1, sprachen: ['de'], titel: 'x' }],
      gemeldeteNummern: new Set(),
      folgenSchluessel: (s, n) => `${s}-${n}`,
      inBahnen: async (liste, arbeit) => { for (const x of liste) await arbeit(x) },
      eintrag: { url: 'https://www.disneyplus.com/browse/entity-abc', titel: 'Landei II' },
      location: { href: 'https://www.disneyplus.com/x' },
      anbieterStaffeln: [],
      WORKER: 'https://worker.test/pruefung',
      folgen: [],
      globalThis: welt,
    })
    if (verlassenVorKlick) adresse.kennung = null
    const l = klick()
    if (verlassenMittendrin) adresse.kennung = null
    tokenFreigabe()
    await l
    return gesendet
  }
  pruefe('Kontrolle: auf der Titelseite geht die Meldung raus', (await lauf({})).length === 1)
  pruefe('nach dem Verlassen: nichts gesendet', (await lauf({ verlassenVorKlick: true })).length === 0)
  pruefe('Wechsel, während der Token geholt wird: nichts gesendet', (await lauf({ verlassenMittendrin: true })).length === 0)
}

async function haupt() {
  regel()
  await netflix()
  await prime()
  await disney()
  primeZuruecksetzen()
  primeStaffelwechsel()
  primeWache()
  const rot = faelle.filter((f) => !f).length
  console.log(rot ? `\n${rot} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(rot ? 1 : 0)
}
haupt()
