/**
 * Netflix-Durchgang bleibt nie auf /browse stehen (Bericht Daniel 17.11.2026 18:34, 2 von 12 geprüft).
 *
 * Ursache aus dem Bericht: Die Vorprüfung des Titels A antwortet langsam (> 1,5 s). Der Sekundentakt urteilt „Umleitung“ für A und ruft
 * `selbstWeiter()`, bevor das Urteil fertig ist; `naechsterAuftrag` überspringt A nicht (Urteil unterwegs) und wählt A noch einmal. Die
 * Vorprüfung dieses zweiten Sprungs sieht A als beurteilt und geht nicht weiter, der Takt hält A nach dem Urteil für erledigt: niemand löst
 * den nächsten Sprung aus (Zustandsprotokoll: zwei Posts 17:31:53, danach nichts; Titelbericht: 81909977 zweimal gestartet).
 * Dazu: (2) die Stillstandssicherung — bleibt ein eigener Sprung länger als eine Minute auf /browse, geht der Durchgang weiter; (3) die
 * Vorprüfung geht nicht ein zweites Mal weiter, wenn der Takt schon weiter ist; der Takt urteilt nicht, solange die Vorprüfung läuft.
 *
 * Aufruf: `node extension/netflix-durchgang-haengt.test.cjs`
 */
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const { ZEHN, durchgang, kontextBauen, virtuelleUhr } = require('./test-durchgang-welt.cjs')

/* Fall 1: jede Vorprüfung braucht 3 s (länger als die 1,5 s des Takts). Alle zehn umgeleiteten Titel werden genau einmal gemeldet, der vorhandene Film nie. */
async function fall1() {
  const r = await durchgang({ seiteReihe: null, probeMs: () => 3000, postMs: () => 1200, dauerMs: 240000 })
  console.log(`   Fall 1: posts ${JSON.stringify(r.postIds)} gezaehlt ${r.fortschritt?.geprueft}`)
  pruefe('1: genau die zehn umgeleiteten Titel gemeldet, keiner doppelt, der vorhandene Film wird geöffnet statt gemeldet', JSON.stringify(r.postIds) === JSON.stringify(ZEHN) && r.doppelt.length === 0 && r.echtGeoeffnet === 1, r.postIds)
}

/* Fall 2: Stillstandssicherung und „Vorprüfung läuft“ an der reinen Funktion `akNetflixUmgeleitet`. */
function fall2(k) {
  const basis = { selbstAn: true, laeuft: false, pfad: '/browse', ziel: { id: '7', zeit: 1000, durchgang: true }, jetzt: 1000 + 60001, offen: true, profilwahl: false }
  const lauf = (o, vorher = [], besetzt = false) => {
    const w = { weiter: 0, spur: 0 }
    const u = new Map(vorher)
    const tun = { spur: () => w.spur++, uebersprungen: u, weiter: () => w.weiter++, nichtDa: { besetzt: () => besetzt, urteil: () => {} } }
    return { r: k.akNetflixUmgeleitet({ ...basis, ...o }, tun), u, w }
  }
  const probe = (probt, o = {}) => {
    const w = { weiter: 0, urteil: 0 }
    const nichtDa = { probt: () => probt, besetzt: () => false, urteil: () => w.urteil++ }
    const r = k.akNetflixUmgeleitet({ ...basis, jetzt: 1000 + 5000, ...o }, { spur() {}, uebersprungen: new Map(), weiter: () => w.weiter++, nichtDa })
    return { r, w }
  }
  let t = lauf({}, [], true)
  pruefe('2: Titel beurteilt (Urteil unterwegs oder gefallen), Sprung > 60 s auf /browse → weiter, Titel NICHT zurückgestellt', t.r === true && t.w.weiter === 1 && t.u.size === 0, t)
  t = lauf({}, [['7', 'x']])
  pruefe('2: Titel übersprungen, aber kein weiter erfolgt → weiter', t.r === true && t.w.weiter === 1, t)
  t = lauf({})
  pruefe('2: Titel ohne Urteil → zurückgestellt mit Grund, weiter', t.r === true && t.w.weiter === 1 && t.w.spur === 1 && t.u.get('7') === 'Durchgang stand auf der Startseite still', t)
  t = lauf({ offen: false }, [], true)
  pruefe('2: Titel nach Stand-Auffrischung nicht mehr auf der Liste (Bericht: „Stand von 18:32“) → weiter', t.r === true && t.w.weiter === 1, t)
  t = lauf({ jetzt: 1000 + 5000, offen: false })
  pruefe('2: unter einer Minute und nicht mehr auf der Liste: nichts', t.r === false && t.w.weiter === 0, t)
  t = probe(true)
  pruefe('2: Vorprüfung des Titels läuft → weder Urteil noch weiter', t.r === true && t.w.urteil === 0 && t.w.weiter === 0, t)
  t = probe(false)
  pruefe('2: keine Vorprüfung mehr → Urteil und weiter wie bisher', t.r === true && t.w.urteil === 1 && t.w.weiter === 1, t)
  t = probe(true, { jetzt: 1000 + 60001 })
  pruefe('2: Vorprüfung „läuft“ über eine Minute: Stillstandssicherung geht trotzdem weiter', t.r === true && t.w.weiter === 1, t)
  t = lauf({ profilwahl: true })
  pruefe('2: Profilauswahl: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ selbstAn: false })
  pruefe('2: Durchgang aus: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ jetzt: 1000 + 60000 }, [], true)
  pruefe('2: genau 60000 ms, Urteil gefallen: noch Geduld', t.r === true && t.w.weiter === 0, t)
  t = lauf({ pfad: '/title/7' })
  pruefe('2: Titelseite: nichts', t.r === false && t.w.weiter === 0, t)
}

/** Ein Sprung auf Titel 9, dessen Vorprüfung antwortet, nachdem `zwischen` etwas getan hat (Urteil unterwegs/gefallen oder übersprungen). */
async function sprung(k, istZiel, unterwegs = false) {
  const w = { weiter: [], gehe: [] }
  const uebersprungen = new Map()
  let antwort = null
  const meldenHaengt = unterwegs === 'unterwegs'
  const tun = k.akNetflixNichtDaTun({
    melden: meldenHaengt ? () => new Promise(() => {}) : async () => ({ ok: true, text: 'ok' }),
    offeneTitel: { 9: { titel: 'Neun' } },
    uebersprungen,
    spur: () => {},
    gehe: (p) => w.gehe.push(p),
    weiter: (...a) => w.weiter.push(a),
    aktiv: () => true,
    bremse: { beleg() {} },
    profilwahl: () => false,
    istZiel,
    fetch: () => new Promise((ok) => {
      antwort = () => ok({ redirected: true, url: 'https://www.netflix.com/browse' })
    }),
  })
  const lauf3 = tun.sprung('9')
  await Promise.resolve()
  if (unterwegs === 'unterwegs') void tun.urteil('9', 'unterwegs')
  else if (unterwegs === 'gefallen') await tun.urteil('9', 'gefallen')
  else uebersprungen.set('9', 'Meldung gescheitert')
  antwort()
  await lauf3
  return w
}

/* Fall 3 (Prüfer A3): Das Urteil des Takts scheitert während der Vorprüfung (Titel übersprungen, unterwegs gelöscht), der Takt ist schon weiter —
   die Vorprüfung darf dann nicht noch einmal weitergehen (Doppelsprung, ein Titel übersprungen). */
async function fall3(k) {
  let w3 = await sprung(k, () => false)
  pruefe('3: Takt ist schon weiter (Ziel ist ein anderer Titel) → kein zweites weiter, kein gehe', w3.weiter.length === 0 && w3.gehe.length === 0, w3)
  w3 = await sprung(k, () => true, 'unterwegs')
  pruefe('3: Urteil unterwegs, Titel noch Ziel → kein weiter (das Urteil führt weiter), kein gehe', w3.weiter.length === 0 && w3.gehe.length === 0, w3)
  w3 = await sprung(k, undefined)
  pruefe('3: ohne Auskunft über das Ziel (Rückfall) → weiter wie bisher', JSON.stringify(w3.weiter) === '[[1,true,"9"]]', w3)
  w3 = await sprung(k, () => true)
  pruefe('3: Sprung ist noch das Ziel (anderweitig übersprungen) → weiter(1, true, id) wie bisher', JSON.stringify(w3.weiter) === '[[1,true,"9"]]' && w3.gehe.length === 0, w3)
  /* Zuletzt: ein gefallenes Urteil bleibt im Speicher des Kontexts (`akNetflixNichtDa`). */
  w3 = await sprung(k, () => true, 'gefallen')
  pruefe('3: Urteil gefallen („nicht bei Netflix“ gemeldet), Titel noch Ziel → kein weiter, kein gehe', w3.weiter.length === 0 && w3.gehe.length === 0, w3)
}

/* Fall 4: „Vorprüfung läuft“ gilt genau von Start bis Antwort (danach darf der Takt wieder urteilen). */
async function fall4(k) {
  let antwort = null
  const tun = k.akNetflixNichtDaTun({
    melden: async () => ({ ok: true, text: "ok" }),
    offeneTitel: { 8: { titel: "Acht" } },
    uebersprungen: new Map(),
    spur: () => {},
    gehe: () => {},
    weiter: () => {},
    aktiv: () => true,
    bremse: { beleg() {} },
    profilwahl: () => false,
    fetch: () => new Promise((ok) => {
      antwort = () => ok({ redirected: false, url: "https://www.netflix.com/title/8" })
    }),
  })
  pruefe("4: vor dem Sprung läuft keine Vorprüfung", tun.probt("8") === false)
  const lauf = tun.sprung("8")
  await Promise.resolve()
  pruefe("4: während der Sprung auf die Antwort wartet, läuft die Vorprüfung", tun.probt("8") === true && tun.probt("9") === false)
  antwort()
  await lauf
  pruefe("4: nach der Antwort läuft sie nicht mehr", tun.probt("8") === false)
}

async function main() {
  await fall1()
  const k = kontextBauen(virtuelleUhr())
  fall2(k)
  await fall3(k)
  await fall4(k)
  if (fehler.length) {
    console.log(`\n${fehler.length} Fehler`)
    process.exit(1)
  }
  console.log('\nnetflix-durchgang-haengt: alle Fälle grün')
}
main()
