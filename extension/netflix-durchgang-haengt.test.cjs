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
  pruefe('2: Titel beurteilt (Urteil gefallen), Sprung > 60 s auf /browse → weiter', t.r === true && t.w.weiter === 1, t)
  t = lauf({}, [['7', 'x']])
  pruefe('2: Titel übersprungen, aber kein weiter erfolgt → weiter', t.r === true && t.w.weiter === 1, t)
  t = lauf({})
  pruefe('2: Titel ohne Urteil → zurückgestellt mit Grund, weiter', t.r === true && t.w.weiter === 1 && t.u.get('7') === 'Durchgang stand auf der Startseite still', t)
  t = lauf({ offen: false }, [], true)
  pruefe('2: Titel nach Stand-Auffrischung nicht mehr auf der Liste (Bericht: „Stand von 18:32“) → weiter', t.r === true && t.w.weiter === 1, t)
  t = lauf({ jetzt: 1000 + 5000, offen: false })
  pruefe('2: unter einer Minute und nicht mehr auf der Liste: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ jetzt: 1000 + 5000 }, [], false)
  t = lauf({ profilwahl: true })
  pruefe('2: Profilauswahl: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ selbstAn: false })
  pruefe('2: Durchgang aus: nichts', t.r === false && t.w.weiter === 0, t)
  t = lauf({ jetzt: 1000 + 60000 }, [], true)
  pruefe('2: genau 60000 ms, Urteil gefallen: noch Geduld', t.r === true && t.w.weiter === 0, t)
  t = lauf({ pfad: '/title/7' })
  pruefe('2: Titelseite: nichts', t.r === false && t.w.weiter === 0, t)

  if (fehler.length) {
    console.log(`\n${fehler.length} Fehler`)
    process.exit(1)
  }
  console.log('\nnetflix-durchgang-haengt: alle Fälle grün')
}
main()
