/**
 * Netflix-Durchgang: eine Meldung je Titel, gemeldet heißt fertig, Zähler aus einer Menge (Issue 4071, Schnitt 1).
 *
 * Anlass (Bericht vom 16.11.2026, 23:08): Für die ersten vier Titel gingen sieben Meldungen „nicht bei Netflix“ hinaus,
 * der Film 81757599 lief nach seiner Meldung noch in den Player, „besucht 14“ bei zehn Titeln. Zwei Wege rufen `selbstWeiter`
 * für denselben Titel (der Sekundentakt `akNetflixUmgeleitet` und die Vorprüfung im Sprung), und der Titel gilt erst als
 * erledigt, wenn der Post des Workers fertig ist.
 *
 * Geprüft wird mit den echten Funktionen aus `melder.js` (`selbstWeiter`, `naechsterAuftrag`, die Verdrahtung `nichtDaTun`) und
 * `netflix-erinnern.js` auf einer virtuellen Uhr: Antworten des Netzes brauchen Zeit, der Takt tickt je Sekunde.
 *
 * Aufruf: `node extension/netflix-durchgang-doppelt.test.cjs`
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
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
function netzBauen({ zeit, w, frisch, uebersprungen, probeMs, postMs, probeHaengt, beiProbe }) {
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
    await zeit.warte(postMs(i))
    frisch.add(String(id))
    return { ok: true, text: 'ok' }
  }
  return { antwort, totMelden }
}

/** Die echten Teile aus `melder.js`: `selbstWeiter`, `naechsterAuftrag` und die Zeile `const nichtDaTun = …`, verdrahtet mit Attrappen. */
function melderBauen(k, a) {
  const bauen = new Function(
    'akNetflixNichtDaTun', 'akNetflixZaehlerStand', 'akNetflixZaehlerSetze', 'akNetflixErledigtZaehlen', 'akNetflixBericht', 'akDurchgangSchutz',
    'totMelden', 'offeneTitel', 'selbstUebersprungen', 'spur', 'gehe', 'selbstAn', 'bremse', 'akProfilwahlSeite', 'document', 'fetch', 'fertig',
    'laufBeenden', 'titelBericht', 'speicherSchreiben', 'meinTab', 'LAUF_SCHLUESSEL', 'LAUF_HOECHSTENS_MS', 'Date', 'console', 'frisch', 'istErledigt', 'gemeinteReihe',
    `let selbstGezaehlt = akNetflixZaehlerStand().gezaehlt
let selbstGrenze = akNetflixZaehlerStand().grenze
let zuletztGeoeffnet = null
${zeile('const nichtDaTun = ')}
${funktion('naechsterAuftrag')}
${funktion('selbstWeiter')}
return { selbstWeiter, nichtDaTun, zuletzt: () => zuletztGeoeffnet, gezaehlt: () => selbstGezaehlt, grenze: () => selbstGrenze }`,
  )
  return bauen(
    k.akNetflixNichtDaTun, k.akNetflixZaehlerStand, k.akNetflixZaehlerSetze, k.akNetflixErledigtZaehlen, k.akNetflixBericht, () => null,
    a.totMelden, a.offeneTitel, a.uebersprungen, (...x) => a.w.spur.push(x), a.gehe, true, a.bremse, () => false, {},
    (u, i) => a.antwort(String(u).replace('/title/', ''), i.signal),
    (id) => a.frisch.has(String(id)),
    (g) => a.w.beendet.push(g), { beginn() {} }, async () => {}, 'tab', 'k', 1, k.Date, k.console, a.frisch, () => false, () => a.ziel()?.id,
  )
}

/** Was ein Durchgang ergeben hat; der Kontext `k` steht nicht in der Ausgabe eines roten Falls (zirkulär). */
function ergebnisAus(k, w, bauteil) {
  const proTitel = {}
  for (const [id] of w.posts) proTitel[id] = (proTitel[id] ?? 0) + 1
  const fortschritt = k.akNetflixFortschrittStand(bauteil.gezaehlt(), bauteil.grenze())
  const ergebnis = {
    posts: w.posts.length,
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
async function durchgang({ probeMs, postMs, probeHaengt = () => false, beiProbe = null, dauerMs = 60000 }) {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const w = { posts: [], proben: [], gehe: [], spur: [], beendet: [] }
  let pfad = '/browse' // `gehe` ist die Navigation ohne Neuladen: danach steht die Seite auf dem Titel
  const gehe = (p) => { w.gehe.push(p); pfad = p }
  const offeneTitel = Object.fromEntries(TITEL.map((id) => [id, { titel: `Titel ${id}`, staffeln: [{ nr: 1, offen: true }] }]))
  const uebersprungen = Object.assign(new Map(), { nichtOffen: () => false })
  const frisch = new Set() // `frischGemeldetNetflix`: die Meldung dieser Sitzung, nach dem Post
  const netz = netzBauen({ zeit, w, frisch, uebersprungen, probeMs, postMs, probeHaengt, beiProbe })
  let bauteil = null
  const bremse = { pause: () => null, offen: () => 0, ausgeschlossen: () => false, beleg() {} }
  bauteil = melderBauen(k, { ...netz, w, gehe, frisch, offeneTitel, uebersprungen, bremse, ziel: () => bauteil?.zuletzt() })

  /* Der Sekundentakt von `vielleichtSelbstStarten`: steht die Seite auf der Startseite, geht `akNetflixUmgeleitet` weiter. */
  const takt = () => {
    const z = bauteil.zuletzt()
    const o = { selbstAn: true, laeuft: false, pfad, ziel: z, jetzt: zeit.uhr.t, offen: offeneTitel[String(z?.id)] !== undefined, profilwahl: false }
    k.akNetflixUmgeleitet(o, { spur: (...a) => w.spur.push(a), uebersprungen, weiter: bauteil.selbstWeiter, nichtDa: bauteil.nichtDaTun })
  }
  const tickt = () => { zeit.setTimeoutV(() => { takt(); tickt() }, 1000) }
  tickt()
  bauteil.selbstWeiter()
  await zeit.vor(dauerMs)
  return ergebnisAus(k, w, bauteil)
}

/** Ein Urteil gegen den echten Meldeweg: `melden` hängt, bis `fertigMelden()` es beendet (gelingt oder scheitert, je nach `ok`). */
function urteilsprobe() {
  const k = { console, globalThis: null, sessionStorage: null }
  k.globalThis = k
  vm.createContext(k)
  vm.runInContext(lies('netflix-erinnern.js'), k)
  const gemeldet = []
  let weiter = null
  const ort = (ok = true) => ({
    melden: (id) => new Promise((fertig) => { gemeldet.push(id); weiter = () => fertig({ ok, text: ok ? 'ok' : 'Kein Token' }) }),
    titel: (id) => id,
    nichtDa: new Map(),
    unterwegs: new Set(),
    uebersprungen: new Map(),
    spur: () => {},
  })
  return { k, gemeldet, ort, fertigMelden: () => weiter() }
}

const reihe = [130, 470, 300, 220, 410, 150, 380, 260, 440, 190]
const normal = (i) => reihe[i % reihe.length]
const langsam = (i) => [130, 470, 2200, 220, 2600, 150, 380, 2100, 440, 190][i % 10]
const zusammen = (r) => JSON.stringify({ posts: r.posts, doppelt: r.doppelt, besucht: r.besucht, gehe: r.gehe })

/** Fall A, wie vorgegeben: Antworten brauchen 130 bis 470 ms, der Takt tickt je Sekunde. */
async function teilA() {
  const r = await durchgang({ probeMs: normal, postMs: normal })
  console.log(`   Fall A (schnell): ${zusammen(r)}`)
  pruefe('A: elf Titel, zehn Umleitungen → genau zehn Meldungen', r.posts === 10, r)
  pruefe('A: kein Titel wird zweimal gemeldet', r.doppelt.length === 0, r.doppelt)
  pruefe('A: besucht 11', r.besucht === 11, r.besucht)
  pruefe('A: nur der Film, den Netflix hat, öffnet den Titel (kein Sprung auf einen beurteilten Titel)', r.gehePlayerBeurteilt.length === 0 && r.echtGeoeffnet === 1, r.gehe)
}

/** Fall A2: der Bericht vom 16.11. — einzelne Antworten brauchen Sekunden (dritte Meldung für 81748512 zwei Sekunden nach der ersten), der Takt greift ein. */
async function teilA2() {
  const r = await durchgang({ probeMs: normal, postMs: langsam })
  console.log(`   Fall A2 (einzelne Posts 2 s): ${zusammen(r)}`)
  pruefe('A2: genau zehn Meldungen, auch wenn Posts Sekunden brauchen und der Takt dazwischen tickt', r.posts === 10, r)
  pruefe('A2: kein Titel wird zweimal gemeldet', r.doppelt.length === 0, r.doppelt)
  pruefe('A2: besucht 11', r.besucht === 11, r.besucht)
  pruefe('A2: kein Sprung auf einen beurteilten Titel', r.gehePlayerBeurteilt.length === 0, r.gehe)
  pruefe('A2: die zehn Titel werden der Reihe nach gemeldet, keiner übersprungen', JSON.stringify(r.postIds) === JSON.stringify(ZEHN), r.postIds)
  pruefe('A2: „erledigt“ führt die zehn Kennungen (die Kennung läuft bis zum Zähler durch)', JSON.stringify(r.erledigtIds) === JSON.stringify(ZEHN), r.erledigtIds)
}

/** Fall B: die Vorprüfung des ersten Titels antwortet nie, der Takt urteilt nach 1,5 s, nach 5 s bricht die Frist die Probe ab — danach darf kein Sprung auf den gemeldeten Titel folgen. */
async function teilB() {
  const r = await durchgang({ probeMs: normal, postMs: normal, probeHaengt: (id) => id === '101' })
  console.log(`   Fall B (Probe läuft ab): ${zusammen(r)}`)
  pruefe('B: die abgelaufene Probe führt zu keinem Sprung auf den gemeldeten Titel', r.gehePlayerBeurteilt.length === 0, r.gehe)
  pruefe('B: der Titel wird genau einmal gemeldet', r.doppelt.length === 0, r.doppelt)
  pruefe('B: alle zehn Titel werden der Reihe nach gemeldet (kein zweites weiter, kein übersprungener Titel)', JSON.stringify(r.postIds) === JSON.stringify(ZEHN) && r.besucht === 11, [r.postIds, r.besucht])
}

/** Fall C und D: Der Titel gilt während der Vorprüfung anderweitig als erledigt (von Hand gemeldet) oder übersprungen — kein Sprung, kein Urteil, der Durchgang geht weiter. */
async function teilCD() {
  let r = await durchgang({ probeMs: normal, postMs: normal, beiProbe: (id, w) => { if (id === '101') w.frisch.add('101') } })
  console.log(`   Fall C (von Hand gemeldet): ${JSON.stringify({ posts: r.posts, besucht: r.besucht, gehe: r.gehe })}`)
  pruefe('C: ein Titel, der während der Vorprüfung gemeldet wird, bekommt weder Sprung noch Urteil', r.gehePlayerBeurteilt.length === 0 && r.doppelt.length === 0 && r.posts === 9, r)
  pruefe('C: der Durchgang geht weiter (alle elf besucht, der Film geöffnet)', r.besucht === 11 && r.echtGeoeffnet === 1, r)
  r = await durchgang({ probeMs: normal, postMs: normal, beiProbe: (id, w) => { if (id === '101') w.uebersprungen.set('101', 'Grund') } })
  pruefe('D: ein Titel, der während der Vorprüfung übersprungen wird, bekommt weder Sprung noch Urteil, der Durchgang geht weiter', r.gehePlayerBeurteilt.length === 0 && r.posts === 9 && r.besucht === 11 && r.echtGeoeffnet === 1, r)
}

/** Die Zahlen kommen aus einer Quelle: Zeile „n von m“, Knopf „n/m“ und `gezaehlt` im Bericht (Befund 3: „5“ neben „11 von 11“). */
async function teilZaehler() {
  const r = await durchgang({ probeMs: normal, postMs: langsam })
  pruefe('Zähler: zehn zurückgegebene Titel, der elfte läuft → „10 von 11 geprüft“', r.fortschritt?.text.startsWith('Durchgang: 10 von 11 geprüft'), r.fortschritt)
  pruefe('Zähler: der Knopf zeigt dieselbe Zahl „10/11“', r.knopf === '10/11', r.knopf)
  pruefe('Zähler: „besucht“ und „erledigt“ zählen verschiedene Titel (11 und 10)', r.besucht === 11 && r.k.akNetflixErledigtStand() === 10, [r.besucht, r.k.akNetflixErledigtStand()])
  pruefe('Bericht: `gezaehlt` kommt aus derselben Funktion wie „n von m“', /gezaehlt: akNetflixFortschrittStand\(selbstGezaehlt, selbstGrenze\)\?\.geprueft/.test(melder))
}

/** Zählmengen: derselbe Titel zählt einmal, auch bei doppeltem Aufruf; ohne Kennung zählt jeder Aufruf. */
function teilZaehlmengen() {
  const sp = {}
  const speicher = { getItem: (n) => sp[n] ?? null, setItem: (n, w) => { sp[n] = String(w) }, removeItem: (n) => { delete sp[n] } }
  const k = vm.createContext({ console, sessionStorage: speicher })
  k.globalThis = k
  vm.runInContext(lies('netflix-durchgang-steuerung.js'), k)
  k.akNetflixBesuchtZaehlen(speicher, '5')
  k.akNetflixBesuchtZaehlen(speicher, '5')
  k.akNetflixBesuchtZaehlen(speicher, '6')
  pruefe('Zählmenge: derselbe Titel zweimal gezählt ist einmal besucht', k.akNetflixBesuchtStand(speicher) === 2, sp)
  k.akNetflixErledigtZaehlen(true, speicher, '5')
  k.akNetflixErledigtZaehlen(true, speicher, '5')
  k.akNetflixErledigtZaehlen(false, speicher, '6')
  pruefe('Zählmenge: ein zurückgegebener Titel zählt einmal, `zaehlen` false zählt nichts', k.akNetflixErledigtStand(speicher) === 1, sp)
  k.akNetflixZaehlerSetze(1, 9, speicher, 'Name', false, '7')
  k.akNetflixZaehlerSetze(2, 9, speicher, 'Name', false, '7')
  pruefe('Zählmenge: der Sprung zählt unter der Kennung, nicht unter dem Namen', k.akNetflixBesuchtStand(speicher) === 3 && JSON.parse(sp['ak-netflix-besucht']).includes('7'), sp)
  k.akNetflixZaehlerSetze(0, 9, speicher)
  pruefe('Zählmenge: ein neuer Lauf beginnt wieder bei 0', k.akNetflixBesuchtStand(speicher) === 0 && k.akNetflixErledigtStand(speicher) === 0, sp)
  k.akNetflixBesuchtZaehlen(speicher)
  k.akNetflixBesuchtZaehlen(speicher)
  pruefe('Zählmenge: ohne Kennung zählt jeder Aufruf als neuer Titel', k.akNetflixBesuchtStand(speicher) === 2, sp)
}

/** Das Urteil selbst: ein Post je Titel, `unterwegs` bremst den zweiten Aufruf, ein gescheiterter Post gibt den Titel wieder frei. */
async function teilUrteil() {
  const p = urteilsprobe()
  const o = p.ort()
  const erster = p.k.akNetflixNichtDaUrteil('9', 'Umleitung', o)
  pruefe('Urteil: während der erste Post läuft, ist der Titel „unterwegs“', o.unterwegs.has('9'))
  const zweiter = await p.k.akNetflixNichtDaUrteil('9', 'Umleitung', o)
  pruefe('Urteil: ein zweiter Aufruf kehrt mit false zurück und schickt keinen Post', zweiter === false && p.gemeldet.length === 1, p.gemeldet)
  p.fertigMelden()
  pruefe('Urteil: der erste Aufruf meldet true (er geht danach weiter)', (await erster) === true)
  pruefe('Urteil: danach steht der Titel in „nicht bei Netflix“, nicht mehr „unterwegs“', o.nichtDa.has('9') && !o.unterwegs.has('9'))
  pruefe('Urteil: auch nach dem Post kehrt ein weiterer Aufruf zurück (false, kein dritter Post)', (await p.k.akNetflixNichtDaUrteil('9', 'Umleitung', o)) === false && p.gemeldet.length === 1, p.gemeldet)
  const q = urteilsprobe()
  const o2 = q.ort(false)
  const schlecht = q.k.akNetflixNichtDaUrteil('8', 'Umleitung', o2)
  q.fertigMelden()
  await schlecht
  pruefe('Urteil: scheitert der Post, ist der Titel übersprungen und wieder frei (nicht auf ewig „unterwegs“)', o2.uebersprungen.has('8') && !o2.unterwegs.has('8') && !o2.nichtDa.has('8'))
}

/* Ein Fall, der auf eine Antwort wartet, die nie kommt, lässt den Prozess still mit Exit 0 enden: das gilt als rot. */
let durchgelaufen = false
process.on('exit', (code) => {
  if (!durchgelaufen && code === 0) {
    console.log('  ✗ der Test lief nicht bis zum Ende (ein Aufruf wartete auf eine Antwort, die nie kam)')
    process.exitCode = 1
  }
})

async function haupt() {
  console.log('Netflix: eine Meldung je Titel (4071, Schnitt 1)')
  await teilA()
  await teilA2()
  await teilB()
  await teilCD()
  await teilZaehler()
  teilZaehlmengen()
  await teilUrteil()
  durchgelaufen = true
  if (fehler.length) {
    console.log(`\n${fehler.length} Fall/Fälle rot`)
    process.exit(1)
  }
  console.log('\nNetflix eine Meldung je Titel: alle Fälle grün')
}

haupt().catch((e) => {
  console.error(e)
  process.exit(1)
})
