/*
  Testhilfe (kein Test, vom Läufer nicht gefahren): ein Durchgang über elf Titel auf virtueller Uhr mit den echten Funktionen aus
  `melder.js` (`selbstWeiter`, `naechsterAuftrag`, die Verdrahtung `nichtDaTun`) und den echten Dateien des Durchgangs. Geteilt von
  `netflix-durchgang-doppelt.test.cjs` (4071 Schnitt 1) und `netflix-durchgang-tabs.test.cjs` (Schnitt 2).
*/
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const lies = (datei) => readFileSync(resolve(__dirname, datei), 'utf8')
const melder = lies('melder.js')

/** Der Text der Funktion `name` aus `melder.js` (bis zur schließenden Klammer in Spalte 0). */
const funktion = (name) => {
  const von = melder.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  if (von < 0) throw new Error(`${name}() nicht in melder.js`)
  return melder.slice(von, melder.indexOf('\n}\n', von) + 2)
}
const zeile = (anfang) => melder.split('\n').find((z) => z.startsWith(anfang))

const TITEL = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111']
const FILM_ECHT = '111' // der elfte Titel ist bei Netflix da, die zehn davor leitet Netflix auf die Startseite um
const ZEHN = TITEL.slice(0, 10)

/** Eine virtuelle Uhr: `setTimeout` läuft nur, wenn `vor(ms)` die Zeit vorrückt; zwischen zwei Timern laufen alle Promises durch. */
function virtuelleUhr() {
  const uhr = { t: 1000000, timers: [], n: 0 }
  const setTimeoutV = (fn, ms) => { const id = ++uhr.n; uhr.timers.push({ id, at: uhr.t + ms, fn }); return id }
  const clearTimeoutV = (id) => { uhr.timers = uhr.timers.filter((x) => x.id !== id) }
  const fluss = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
  const vor = async (ms) => {
    const ende = uhr.t + ms
    for (;;) {
      await fluss()
      const naechster = uhr.timers.filter((x) => x.at <= ende).sort((a, b) => a.at - b.at || a.id - b.id)[0]
      if (!naechster) break
      uhr.timers = uhr.timers.filter((x) => x !== naechster)
      uhr.t = naechster.at
      naechster.fn()
    }
    await fluss()
    uhr.t = ende
  }
  const warte = (ms) => new Promise((fertig) => setTimeoutV(fertig, ms))
  return { uhr, setTimeoutV, clearTimeoutV, vor, warte }
}

/** Der Kontext der Erweiterung mit den echten Dateien des Durchgangs und einem `sessionStorage`. */
function kontextBauen(zeit) {
  const speicher = {}
  const k = {
    console: { log() {}, warn() {}, error() {} },
    AbortController,
    URL,
    Date: class extends Date { static now() { return zeit.uhr.t } },
    setTimeout: zeit.setTimeoutV,
    clearTimeout: zeit.clearTimeoutV,
    sessionStorage: { getItem: (n) => speicher[n] ?? null, setItem: (n, w) => { speicher[n] = String(w) }, removeItem: (n) => { delete speicher[n] } },
  }
  k.globalThis = k
  vm.createContext(k)
  for (const datei of ['netflix-erinnern.js', 'netflix-uebernahme.js', 'netflix-durchgang-steuerung.js', 'netflix-bericht.js']) vm.runInContext(lies(datei), k)
  return k
}

/** Das Netz und der Worker: Antwortzeiten aus `probeMs(i)` / `postMs(i)`; `probeHaengt(id)`: die Vorprüfung antwortet nie (die Frist von 5 s bricht sie ab). */
function netzBauen({ zeit, w, frisch, uebersprungen, probeMs, postMs, probeHaengt, beiProbe, beiPost, lebendig }) {
  let probeNr = 0
  let postNr = 0
  const antwort = (id, signal) => new Promise((ok, nein) => {
    const i = probeNr++
    w.proben.push([id, zeit.uhr.t])
    beiProbe?.(id, { frisch, uebersprungen })
    signal.addEventListener('abort', () => nein(new Error('signal is aborted without reason')))
    if (probeHaengt(id)) return
    zeit.setTimeoutV(() => ok(id === FILM_ECHT ? { redirected: false, url: `https://www.netflix.com/title/${id}` } : { redirected: true, url: 'https://www.netflix.com/browse' }), probeMs(i))
  })
  const totMelden = async (id) => {
    const i = postNr++
    w.posts.push([id, zeit.uhr.t])
    beiPost?.(id, lebendig)
    await zeit.warte(postMs(i))
    frisch.add(String(id))
    return { ok: true, text: 'ok' }
  }
  return { antwort, totMelden }
}

/** Die echten Teile aus `melder.js`: `selbstWeiter`, `naechsterAuftrag` und die Zeile `const nichtDaTun = …`, verdrahtet mit Attrappen. */
function melderBauen(k, a) {
  let teil = null
  const bauen = new Function(
    'akNetflixNichtDaTun', 'akNetflixZaehlerStand', 'akNetflixZaehlerSetze', 'akNetflixErledigtZaehlen', 'akNetflixBericht', 'akDurchgangSchutz',
    'totMelden', 'offeneTitel', 'selbstUebersprungen', 'spur', 'gehe', 'bremse', 'akProfilwahlSeite', 'document', 'fetch', 'fertig',
    'laufBeenden', 'titelBericht', 'speicherSchreiben', 'meinTab', 'LAUF_SCHLUESSEL', 'LAUF_HOECHSTENS_MS', 'Date', 'console', 'frisch', 'istErledigt', 'gemeinteReihe', 'verbindungLebt', 'akNetflixEigenerSprungMerken',
    `let selbstAn = true
let selbstGezaehlt = akNetflixZaehlerStand().gezaehlt
let selbstGrenze = akNetflixZaehlerStand().grenze
let zuletztGeoeffnet = null
${zeile('const nichtDaTun = ')}
${funktion('naechsterAuftrag')}
${funktion('selbstWeiter')}
return { selbstWeiter, nichtDaTun, laeuft: () => selbstAn, aus: () => { selbstAn = false }, zuletzt: () => zuletztGeoeffnet, gezaehlt: () => selbstGezaehlt, grenze: () => selbstGrenze }`,
  )
  teil = bauen(
    k.akNetflixNichtDaTun, k.akNetflixZaehlerStand, k.akNetflixZaehlerSetze, k.akNetflixErledigtZaehlen, k.akNetflixBericht, () => null,
    a.totMelden, a.offeneTitel, a.uebersprungen, (...x) => a.w.spur.push(x), a.gehe, a.bremse, () => false, {},
    (u, i) => a.antwort(String(u).replace('/title/', ''), i.signal),
    (id) => a.frisch.has(String(id)),
    (g) => { a.w.beendet.push(g); teil?.aus() }, { beginn() {} }, async () => {}, 'tab', 'k', 1, k.Date, k.console, a.frisch, () => false, () => (a.seiteReihe === undefined ? a.ziel()?.id : a.seiteReihe), () => a.lebendig.an, k.akNetflixEigenerSprungMerken,
  )
  return teil
}

/** Was ein Durchgang ergeben hat; der Kontext `k` steht nicht in der Ausgabe eines roten Falls (zirkulär). */
function ergebnisAus(k, w, bauteil) {
  const proTitel = {}
  for (const [id] of w.posts) proTitel[id] = (proTitel[id] ?? 0) + 1
  const fortschritt = k.akNetflixFortschrittStand(bauteil.gezaehlt(), bauteil.grenze())
  const ergebnis = {
    posts: w.posts.length,
    proben: w.proben.length,
    postIds: w.posts.map(([id]) => id),
    erledigtIds: k.akNetflixLaufLesen(k.sessionStorage, 'ak-netflix-erledigt'),
    doppelt: Object.entries(proTitel).filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`),
    besucht: k.akNetflixBesuchtStand(),
    gehe: w.gehe,
    gehePlayerBeurteilt: w.gehe.filter((p) => p !== `/title/${FILM_ECHT}`),
    echtGeoeffnet: w.gehe.filter((p) => p === `/title/${FILM_ECHT}`).length,
    zuletzt: bauteil.zuletzt()?.id,
    fortschritt,
    knopf: k.akNetflixKnopfZahl(fortschritt),
  }
  Object.defineProperty(ergebnis, 'k', { value: k, enumerable: false })
  return ergebnis
}

/**
 * Ein Durchgang über elf Titel auf virtueller Uhr. `probeMs(i)` / `postMs(i)`: Antwortzeit der i-ten Vorprüfung und des i-ten
 * Posts (ms); `probeHaengt(id)`; `beiProbe(id, { frisch, uebersprungen })`: etwas geschieht, während die Vorprüfung dieses Titels läuft.
 */
async function durchgang({ dauerMs = 60000, ...o }) {
  const tab = tabAufbauen(o)
  tab.starten()
  await tab.zeit.vor(dauerMs)
  return ergebnisAus(tab.k, tab.w, tab.bauteil)
}

/** Ein Tab des Durchgangs, noch nicht gestartet; `zeit` und `w` (Posts, Proben, Sprünge) lassen sich zwischen Tabs teilen (eine Uhr, ein Worker). */
function tabAufbauen({ seiteReihe, zeit = virtuelleUhr(), w = { posts: [], proben: [], gehe: [], spur: [], beendet: [] }, probeMs, postMs, probeHaengt = () => false, beiProbe = null, beiPost = null }) {
  const k = kontextBauen(zeit)
  let pfad = '/browse' // `gehe` ist die Navigation ohne Neuladen: danach steht die Seite auf dem Titel
  const gehe = (p) => { w.gehe.push(p); pfad = p }
  const offeneTitel = Object.fromEntries(TITEL.map((id) => [id, { titel: `Titel ${id}`, staffeln: [{ nr: 1, offen: true }] }]))
  const uebersprungen = Object.assign(new Map(), { nichtOffen: () => false })
  const frisch = new Set() // `frischGemeldetNetflix`: die Meldung dieser Sitzung, nach dem Post
  const lebendig = { an: true } // die Verbindung der Erweiterung (`akKontext.lebt()`)
  const netz = netzBauen({ zeit, w, frisch, uebersprungen, probeMs, postMs, probeHaengt, beiProbe, beiPost, lebendig })
  let bauteil = null
  const bremse = { pause: () => null, offen: () => 0, ausgeschlossen: () => false, beleg() {} }
  bauteil = melderBauen(k, { ...netz, w, gehe, frisch, offeneTitel, uebersprungen, bremse, lebendig, seiteReihe, ziel: () => bauteil?.zuletzt() })

  /* Der Sekundentakt von `vielleichtSelbstStarten`: steht die Seite auf der Startseite, geht `akNetflixUmgeleitet` weiter. */
  const takt = () => {
    const z = bauteil.zuletzt()
    const o = { selbstAn: bauteil.laeuft(), laeuft: false, pfad, ziel: z, jetzt: zeit.uhr.t, offen: offeneTitel[String(z?.id)] !== undefined, profilwahl: false }
    k.akNetflixUmgeleitet(o, { spur: (...a) => w.spur.push(a), uebersprungen, weiter: bauteil.selbstWeiter, nichtDa: bauteil.nichtDaTun })
  }
  const tickt = () => { zeit.setTimeoutV(() => { if (bauteil.laeuft()) takt(); tickt() }, 1000) }
  return { zeit, k, w, bauteil, starten: () => { tickt(); bauteil.selbstWeiter() } }
}


module.exports = { tabAufbauen, lies, melder, funktion, zeile, TITEL, FILM_ECHT, ZEHN, virtuelleUhr, kontextBauen, netzBauen, melderBauen, ergebnisAus, durchgang }
