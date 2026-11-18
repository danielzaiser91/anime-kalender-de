/**
 * **Der Durchgang entscheidet am Zustand der Titelseite, nicht an einer Wartezeit** (Daniel, 18.11.2026).
 *
 * Bericht 4.32.158 (Prüfliste „alle durchgehen", sechs Titel): Die Anzeige sagte „wartet auf die Folgenliste, 16 von 20 s", obwohl bei
 * Quintessential Quintuplets Movie schon „Erinnern" im Fenster stand und One Piece Fan Letter (Film, „Abspielen") nie eine Folgenliste
 * bekommt. Fenstertexte stammen wörtlich aus dem Bericht (`dialoge.anfang`).
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

console.log('Netflix: Entscheidung am Zustand der Titelseite')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-erinnern.js'), kontext)
vm.runInContext(lies('netflix-durchgang-steuerung.js'), kontext)
const warte = kontext.akNetflixListeWarten

/* `seitenmerkmale()` der echten Seiten im Bericht: Erinnern-Fenster (Quintuplets Movie) und Abspielen-Fenster (One Piece Fan Letter). */
const seite = (pfad, anfang) => ({ pfad, suche: '', titel: 'Titel – Netflix', folgenElemente: 0, dialoge: { anzahl: 1, anfang } })
const ERINNERN = seite('/title/81717895', 'Erinnern\n\nWegen des bevorstehenden Schulfestes wird es für die Nakano-Schwestern und Futaro Zeit, sich über ihre Gefühle')
const ABSPIELEN = seite('/title/81947352', 'Abspielen\n2024\n24 Min.\nHD\n12Gewalt\n\nInspiriert von Nami erlebt ein junges Mädchen ein Abenteuer in mehreren Geschichten,')
const BILLBOARD = seite('/title/81717895', 'Ähnliche Titel\n52 Folgen')

/** Ein Takt nach `ms` Millisekunden Wartezeit; `geladen`: das volle Neuladen dieses Titels ist schon gelaufen. */
function takt({ m, erinnern = true, ms, geladen, datum = null }) {
  const w = { uebersprungen: new Map(), weiter: 0, laden: 0, spuren: [] }
  const tun = {
    spur: (was) => w.spuren.push(was),
    uebersprungen: w.uebersprungen,
    weiter: () => w.weiter++,
    vollLaden: { versucht: () => geladen, laden: () => w.laden++ },
    bremse: { ok() {}, stoerung() {} },
  }
  const o = { seite: '81717895', reihe: '81717895', erinnern, datum: () => datum, durchlauf: { folgen: [] }, jetzt: 1_000_000 + ms, frist: 20000, merkmale: () => m }
  w.rest = warte({ seite: '81717895', seit: 1_000_000 }, o, tun)
  return w
}

let w = takt({ m: ERINNERN, ms: 400, geladen: false })
pruefe('Erinnern im Fenster, erster Besuch: sofort zur Bestätigung neu laden (keine 3 s Schonzeit)', w.laden === 1 && w.weiter === 0 && w.uebersprungen.size === 0, w)
w = takt({ m: ERINNERN, ms: 400, geladen: true, datum: '19. November' })
pruefe('Erinnern im frisch geladenen Fenster: sofort entschieden, Grund mit Datum', w.weiter === 1 && w.laden === 0 && w.uebersprungen.get('81717895') === 'Erinnern-Knopf mit Datum (19.11.)', w)
w = takt({ m: ERINNERN, ms: 400, geladen: true })
pruefe('… ohne Datum: „Erinnern-Knopf ohne Datum"', w.uebersprungen.get('81717895') === 'Erinnern-Knopf ohne Datum', w)

w = takt({ m: ABSPIELEN, ms: 1000, geladen: true })
pruefe('Gegenprobe: „Erinnern" nur im Seitentext, das Fenster zeigt „Abspielen" → warten (Folgenliste kann kommen)', w.weiter === 0 && w.laden === 0 && w.uebersprungen.size === 0, w)
w = takt({ m: BILLBOARD, ms: 2999, geladen: true })
pruefe('Gegenprobe: „Erinnern" im Seitentext, aber nicht als erste Handlung des Fensters, vor der Schonzeit → warten', w.weiter === 0 && w.laden === 0, w)
w = takt({ m: BILLBOARD, ms: 3000, geladen: true })
pruefe('… und nach der Schonzeit (3 s) bleibt der Rückfall wie bisher', w.weiter === 1, w)
w = takt({ m: ERINNERN, erinnern: false, ms: 400, geladen: true })
pruefe('Gegenprobe: Fenster-Text „Erinnern", aber der Seitentext kennt es nicht (Kulisse) → nichts', w.weiter === 0 && w.laden === 0, w)

/* Die Anzeige nennt die echte Lage: gemessene Sekunden und die Frist als Notausgang. */
const text = kontext.akNetflixWartetText({ seit: 0, frist: 20000, film: false }, 4200)
pruefe('Wartetext: „4 s (Notausgang nach 20 s)", nicht „4 von 20 s"', text === 'wartet auf die Folgenliste, 4 s (Notausgang nach 20 s)', text)
pruefe('Wartetext: bei der Frist bleibt die Zahl bei 20', kontext.akNetflixWartetText({ seit: 0, frist: 20000, film: true }, 99000) === 'wartet auf den Titel, 20 s (Notausgang nach 20 s)')
pruefe('Wartetext: entschieden → leer', kontext.akNetflixWartetText({ seit: 0, frist: 20000, entschieden: true }, 4000) === '')

/* Film (One Piece Fan Letter): die Folgenliste des Films entsteht in jedem Takt von `selbstStartenSchritt`, nicht erst beim Neuzeichnen. */
const melder = lies('melder.js')
const fn = (name) => {
  const von = melder.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  return melder.slice(von, melder.indexOf('\n}\n', von) + 2)
}
function filmTakte() {
  const k = { globalThis: null, console, Boolean, String, Number, Object, Math }
  k.globalThis = k
  vm.createContext(k)
  const lage = { erinnernText: true, ort: [] }
  Object.assign(k, {
    selbstAn: true,
    selbstVersucht: null,
    selbstWartet: null,
    DURCHLAUF: { laeuft: false, folgen: [], listeFuer: null },
    location: { pathname: '/title/81947352' },
    gemeinteReihe: () => '81947352',
    titelDerAdresse: () => 81947352,
    keineFolgeVorhanden: () => lage.erinnernText,
    offeneTitel: { 81947352: { titel: 'One Piece Fan Letter', staffeln: [{ film: true, offen: true }] } },
    fertig: () => false,
    selbstUebersprungen: new Map(),
    selbstWeiter() {},
    spur() {},
    bremse: {},
    vollLaden: {},
    SELBST_LISTE_WARTEN: 20000,
    akNetflixBericht: { seitenmerkmale: () => ABSPIELEN },
    akNetflixListeWarten: (wartet, ort) => {
      lage.ort.push(ort)
      return { seite: ort.seite, seit: 0 }
    },
  })
  vm.runInContext(`${fn('folgenFuerFilmErgaenzen')}\n${fn('selbstStartenSchritt').replace(/\n {2}bremse\.ok\(\)[\s\S]*$/, '\n}\n')}`, k)
  return { k, lage }
}
const { k: filmK, lage } = filmTakte()
void filmK.selbstStartenSchritt()
void filmK.selbstStartenSchritt()
pruefe('Film, Takt 1: das Fenster des vorigen Titels zeigt noch „Erinnern" → noch keine Filmliste, die Wartefunktion kennt keinen Film', lage.ort.length === 2 && lage.ort[0].film === false, lage.ort.map((o) => o.film))
lage.erinnernText = false
void filmK.selbstStartenSchritt()
pruefe('Film, Takt 3 (ohne Neuzeichnen, ohne `durchlaufKnopfZeigen`): „Erinnern" ist weg → die Wartefunktion bekommt den Film', lage.ort[2]?.film === true && filmK.DURCHLAUF.folgen.length === 1 && filmK.DURCHLAUF.folgen[0].film === true, [lage.ort[2]?.film, filmK.DURCHLAUF.folgen])

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Entscheidung am Zustand halten.')
