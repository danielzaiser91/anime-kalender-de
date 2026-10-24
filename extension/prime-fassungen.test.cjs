/**
 * Prime: Fassungen aus „Weitere Versionen verfügbar" (24.10.2026, Fischen Impossible).
 *
 * Teil 1: das Lesemodul gegen die Fixture (Ausschnitt der gespeicherten Seite B01MSMV5MA).
 * Teil 2: der Lauf durch `amazon.js` — die Titelseite bietet die Fassungen als Auswahl an.
 * Eine Prime-Probe lag nicht vor; der Prime-Fall ist die Fixture mit geänderter Angebotsmeldung.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (n) => readFileSync(__dirname + '/' + n, 'utf8')
const FIXTURE = lies('prime-fassungen.fixture.json')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const modul = { globalThis: null }
modul.globalThis = modul
vm.runInNewContext(lies('prime-fassungen.js'), modul)
const knoten = (text) => ({ textContent: text })
const eigen = (zusatz = {}) => ({ kennung: 'B01MSMV5MA', titel: 'Fischen Impossible Uncut', zugaenge: [], art: null, ...zusatz })
const kennungen = (liste) => liste.map((f) => f.kennung)

/** Die Fixture mit geänderter Angebotsmeldung der Fassung `kennung`. */
function mitMeldung(kennung, meldung, logo = false, typ = 'Entitled') {
  const daten = JSON.parse(FIXTURE)
  const reihe = Object.values(daten.init.preparations.body.btf.state.containers)[0][0].entities
  const e = reihe.find((x) => x.titleID === kennung)
  e.entitlementCues = { entitlementType: typ, focusMessage: { message: meldung }, glanceMessage: { message: meldung } }
  if (logo) e.entitlementCues.providerLogo = { imageUrl: 'https://example.invalid/kanal.png' }
  return JSON.stringify(daten)
}

console.log('Zusicherungen für die Fassungen aus „Weitere Versionen verfügbar“\n')

const echt = modul.akPrimeFassungenLesen(knoten(FIXTURE), eigen())
pruefe('drei Fassungen: die eigene Seite und die zwei aus dem Abschnitt', echt.length === 3, kennungen(echt))
const nach = Object.fromEntries(echt.map((f) => [f.kennung, f]))
pruefe('KiXi-Fassung: Kaufart Kanal (Gratiszeitraum)', nach.B0GVNJRZCM?.kaufart === 'kanal', nach.B0GVNJRZCM)
pruefe('Kauf-Fassung: Kaufart Kauf (Kaufen oder leihen)', nach.B01HRLV328?.kaufart === 'kauf', nach.B01HRLV328)
pruefe('Titel, Jahr, Laufzeit und Hinweis stehen dabei',
  nach.B01HRLV328?.titel === 'Fischen Impossible [dt./OV]' && nach.B01HRLV328?.jahr === '2011' &&
    nach.B01HRLV328?.laufzeit === '1 Std. 29 Min.' && nach.B01HRLV328?.hinweis === 'Alternative Audiosprache',
  nach.B01HRLV328)
pruefe('Hinweis Originalversion bei der KiXi-Fassung', nach.B0GVNJRZCM?.hinweis === 'Originalversion', nach.B0GVNJRZCM?.hinweis)
pruefe('Adresse trägt die Kennung', nach.B0GVNJRZCM?.url === '/gp/video/detail/B0GVNJRZCM', nach.B0GVNJRZCM?.url)
pruefe('ohne Prime-Fassung steht Kauf vor Kanal, die eigene Seite (unbekannt) vor dem Kanal',
  kennungen(echt).join() === 'B01MSMV5MA,B01HRLV328,B0GVNJRZCM', kennungen(echt))

const primeEigen = modul.akPrimeFassungenLesen(knoten(FIXTURE), eigen({ zugaenge: ['Prime'] }))
pruefe('die eigene Seite mit Prime-Zugang steht vorn', primeEigen[0]?.kennung === 'B01MSMV5MA' && primeEigen[0]?.kaufart === 'prime', primeEigen[0])

const primeAndere = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', 'Mit Prime ansehen', false, 'Unentitled')), eigen({ art: 'kauf' }))
pruefe('eine Prime-Fassung im Abschnitt rückt vor Kauf und Kanal', kennungen(primeAndere).join() === 'B01HRLV328,B01MSMV5MA,B0GVNJRZCM', kennungen(primeAndere))
const ohneText = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', '')), eigen({ art: 'kauf' }))
const neutral = ohneText.find((f) => f.kennung === 'B01HRLV328')
pruefe('Entitled ohne Beleg bleibt neutral, nicht Prime', neutral?.kaufart === 'unbekannt', neutral)
const mitLogo = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', '', true)), eigen({ art: 'kauf' }))
pruefe('Entitled mit Kanal-Logo ist Kanal', mitLogo.find((f) => f.kennung === 'B01HRLV328')?.kaufart === 'kanal', mitLogo)
const logoVorText = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', 'Mit Prime ansehen', true, 'Unentitled')), eigen({ art: 'kauf' }))
pruefe('das Kanal-Logo gilt vor dem Wort Prime', logoVorText.find((f) => f.kennung === 'B01HRLV328')?.kaufart === 'kanal', logoVorText)
const primeAbo = modul.akPrimeFassungenLesen(knoten(mitMeldung('B01HRLV328', 'Im Prime-Abo enthalten', false, 'Unentitled')), eigen({ art: 'kauf' }))
pruefe('„Prime-Abo“ ist Prime, nicht Kanal', primeAbo.find((f) => f.kennung === 'B01HRLV328')?.kaufart === 'prime', primeAbo)

// A2: derselbe Block unter einer anderen Adresse (Single-Page-Wechsel) liefert nichts
pruefe('Block einer anderen Seite: leere Liste', modul.akPrimeFassungenLesen(knoten(FIXTURE), eigen({ kennung: 'B0ZZZZZZZZ' })).length === 0)
pruefe('Adressvergleich ohne Groß-/Kleinschreibung (GTI)',
  modul.akPrimeFassungenLesen(knoten(FIXTURE.replace('/detail/B01MSMV5MA', '/detail/amzn1.dv.gti.abc-123')), eigen({ kennung: 'AMZN1.dv.gti.ABC-123' })).length === 3)
const gesamtliste = modul.akPrimeKarten({ getElementById: () => knoten(FIXTURE) }, 'B01MSMV5MA', 'T', [], null)
pruefe('Karten tragen Art, Hinweis und Titel im Namen', gesamtliste.some((k) => k.titel === 'Kanal · Originalversion · Fischen Impossible'), gesamtliste.map((k) => k.titel))
pruefe('Kanal-Fassung trägt zugang channel (Kanal-Abo-Beschriftung)', gesamtliste.find((k) => k.kennung === 'B0GVNJRZCM')?.zugang === 'channel', gesamtliste)

// Gegenproben: nichts da, nichts geändert
const ohneAbschnitt = JSON.parse(FIXTURE)
const reihen = ohneAbschnitt.init.preparations.body.btf.state.containers
for (const k of Object.keys(reihen)) reihen[k] = reihen[k].map((c) => ({ ...c, title: 'Ähnliche Titel' }))
pruefe('Seite ohne den Abschnitt: leere Liste', modul.akPrimeFassungenLesen(knoten(JSON.stringify(ohneAbschnitt)), eigen()).length === 0)
pruefe('kein Knoten: leere Liste', modul.akPrimeFassungenLesen(null, eigen()).length === 0)
pruefe('kaputtes JSON: leere Liste', modul.akPrimeFassungenLesen(knoten('{"init":'), eigen()).length === 0)
const nurSelbst = JSON.parse(FIXTURE)
Object.values(nurSelbst.init.preparations.body.btf.state.containers)[0][0].entities = [
  Object.values(nurSelbst.init.preparations.body.btf.state.containers)[0][0].entities[0],
]
pruefe('steht nur die eigene Seite im Abschnitt, bleibt die Liste leer',
  modul.akPrimeFassungenLesen(knoten(JSON.stringify(nurSelbst)), eigen({ kennung: 'B0GVNJRZCM' })).length === 0)


if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('\nDie Fassungen aus „Weitere Versionen verfügbar“ halten.')
