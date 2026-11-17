/**
 * Netflix-Durchgang bleibt nie auf /browse stehen (Bericht Daniel 17.11.2026 18:34, 2 von 12 geprüft).
 *
 * Ursache aus dem Bericht: Die Vorprüfung des Titels A antwortet langsam (> 1,5 s). Der Sekundentakt urteilt „Umleitung“ für A und ruft
 * `selbstWeiter()`, bevor das Urteil fertig ist; `naechsterAuftrag` überspringt A nicht (Urteil unterwegs) und wählt A noch einmal. Die
 * Vorprüfung dieses zweiten Sprungs sieht A als beurteilt und geht nicht weiter, der Takt hält A nach dem Urteil für erledigt: niemand löst
 * den nächsten Sprung aus (Zustandsprotokoll: zwei Posts 17:31:53, danach nichts; Titelbericht: 81909977 zweimal gestartet).
 * Dazu die Stillstandssicherung: bleibt ein eigener Sprung länger als eine Minute auf /browse, geht der Durchgang weiter.
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

async function main() {
  /* Fall 1: jede Vorprüfung braucht 3 s (Takt urteilt nach 1,5 s mitten in der Probe). Alle zehn Titel werden genau einmal gemeldet. */
  const r = await durchgang({ seiteReihe: null, probeMs: () => 3000, postMs: () => 1200, dauerMs: 240000 })
  console.log(`   Fall 1: posts ${JSON.stringify(r.postIds)} gezaehlt ${r.fortschritt?.geprueft}`)
  pruefe('1: die zehn Titel werden der Reihe nach gemeldet, keiner doppelt (der Durchgang bleibt nicht nach dem ersten stehen)', JSON.stringify(r.postIds.slice(0, 10)) === JSON.stringify(ZEHN) && r.doppelt.length === 0, r.postIds)

  /* Fall 2: Stillstand-Sicherung der reinen Funktion */
  const k = kontextBauen(virtuelleUhr())
  const basis = { selbstAn: true, laeuft: false, pfad: '/browse', ziel: { id: '7', zeit: 1000, durchgang: true }, jetzt: 1000 + 60001, offen: true, profilwahl: false }
  const lauf = (o, vorher = [], besetzt = false) => {
    const w = { weiter: 0, spur: 0 }
    const u = new Map(vorher)
    const tun = { spur: () => w.spur++, uebersprungen: u, weiter: () => w.weiter++, nichtDa: { besetzt: () => besetzt, urteil: () => {} } }
    return { r: k.akNetflixUmgeleitet({ ...basis, ...o }, tun), u, w }
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
  t = lauf({ profilwahl: true })
  pruefe('2: Profilauswahl: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ selbstAn: false })
  pruefe('2: Durchgang aus: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ jetzt: 1000 + 60000 }, [], true)
  pruefe('2: genau 60000 ms, Urteil gefallen: noch Geduld', t.r === true && t.w.weiter === 0, t)
  t = lauf({ pfad: '/title/7' })
  pruefe('2: Titelseite: nichts', t.r === false && t.w.weiter === 0, t)

  /* Fall 3 (Prüfer A3): Das Urteil des Takts scheitert während der Vorprüfung (Titel übersprungen, unterwegs gelöscht), der Takt ist schon weiter —
     die Vorprüfung darf dann nicht noch einmal weitergehen (Doppelsprung, ein Titel übersprungen). */
  const sprung = async (istZiel, unterwegs = false) => {
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
  let w3 = await sprung(() => false)
  pruefe('3: Takt ist schon weiter (Ziel ist ein anderer Titel) → kein zweites weiter, kein gehe', w3.weiter.length === 0 && w3.gehe.length === 0, w3)
  w3 = await sprung(() => true, 'unterwegs')
  pruefe('3: Urteil unterwegs, Titel noch Ziel → kein weiter (das Urteil führt weiter), kein gehe', w3.weiter.length === 0 && w3.gehe.length === 0, w3)
  w3 = await sprung(undefined)
  pruefe('3: ohne Auskunft über das Ziel (Rückfall) → weiter wie bisher', JSON.stringify(w3.weiter) === '[[1,true,"9"]]', w3)
  w3 = await sprung(() => true)
  pruefe('3: Sprung ist noch das Ziel (anderweitig übersprungen) → weiter(1, true, id) wie bisher', JSON.stringify(w3.weiter) === '[[1,true,"9"]]' && w3.gehe.length === 0, w3)
  /* Zuletzt: ein gefallenes Urteil bleibt im Speicher des Kontexts (`akNetflixNichtDa`). */
  w3 = await sprung(() => true, 'gefallen')
  pruefe('3: Urteil gefallen („nicht bei Netflix“ gemeldet), Titel noch Ziel → kein weiter, kein gehe', w3.weiter.length === 0 && w3.gehe.length === 0, w3)

  if (fehler.length) {
    console.log(`\n${fehler.length} Fehler`)
    process.exit(1)
  }
  console.log('\nnetflix-durchgang-haengt: alle Fälle grün')
}
main()
