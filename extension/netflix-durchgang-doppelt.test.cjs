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
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const { lies, melder, ZEHN, durchgang } = require('./test-durchgang-welt.cjs')

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

/**
 * Fall B (17.11.2026 umgekehrt, Prüfer Runde 1): Die Vorprüfung des ersten Titels antwortet nie. Solange sie läuft (Frist 5 s), steht die Seite auf
 * `/browse`, aber das ist keine Umleitung: der Takt urteilt nicht (früher meldete er nach 1,5 s „nicht bei Netflix“, auch für vorhandene Titel).
 * Nach 5 s bricht die Frist die Probe ab (kein Urteil, `false`), der Sprung öffnet den Titel.
 */
async function teilB() {
  const waehrend = await durchgang({ probeMs: normal, postMs: normal, probeHaengt: (id) => id === '101', dauerMs: 4500 })
  console.log(`   Fall B (Probe läuft noch): ${zusammen(waehrend)}`)
  pruefe('B: während die Vorprüfung läuft, urteilt der Takt nicht (kein Post)', waehrend.posts === 0, waehrend.postIds)
  pruefe('B: während die Vorprüfung läuft, wird nichts geöffnet', waehrend.gehe.length === 0, waehrend.gehe)
  const danach = await durchgang({ probeMs: normal, postMs: normal, probeHaengt: (id) => id === '101', dauerMs: 10000 })
  console.log(`   Fall B (Probe abgelaufen): ${zusammen(danach)}`)
  pruefe('B: nach der Frist wird der Titel geöffnet statt gemeldet (keine Auskunft ist kein Urteil)', danach.posts === 0 && JSON.stringify(danach.gehe) === '["/title/101"]', [danach.postIds, danach.gehe])
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
