/**
 * Der Disney+-Durchgang (27.09.2026) im Sandkasten: dieselbe Ablauflogik wie in
 * `disney-durchgang.js`, Speicher, Uhr, Liste und Seite nachgebaut.
 *
 * Gespielt werden drei offene Titel: einer mit neuen Folgen (wird gemeldet), einer ohne neue
 * Folgen (wird abgehakt) und einer, auf dem nichts passiert (Umleitung — nach drei Minuten
 * übersprungen). Dazu: fremde Ergebnisse zählen nicht, eine gescheiterte Meldung steht am Ende.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Disney+-Durchgang im Sandkasten\n')
const kontext = { JSON, globalThis: {} }
kontext.globalThis = kontext
vm.runInNewContext(readFileSync(__dirname + '/disney-durchgang.js', 'utf8'), kontext)
const durchgang = kontext.akDisneyDurchgang
pruefe('Fabrik ohne Browser erreichbar', typeof durchgang === 'function')

function welt(offen) {
  const m = new Map()
  const w = { uhr: 1_000_000, geoeffnet: [], gemeldet: 0, ende: null, offen, zustand: {}, weg: [], wegOk: true }
  w.lauf = durchgang({
    speicher: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    jetzt: () => w.uhr,
    offene: () => w.offen,
    oeffne: (e) => w.geoeffnet.push(e.url),
    melde: () => w.gemeldet++,
    meldeWeg: (url) => {
      w.weg.push(url)
      return Promise.resolve(w.wegOk)
    },
    ende: (info) => (w.ende = info),
    zustand: () => w.zustand,
  })
  return w
}

{
  const A = { id: 'a', url: 'https://www.disneyplus.com/series/a/1' }
  const B = { id: 'b', url: 'https://www.disneyplus.com/series/b/2' }
  const C = { id: 'c', url: 'https://www.disneyplus.com/series/c/3' }
  const w = welt([A, B, C])
  w.lauf.starten()
  pruefe('Start öffnet den ersten offenen Titel', w.geoeffnet.join() === A.url && w.lauf.laeuft(), w.geoeffnet)
  w.lauf.geprueft({ url: B.url, zuMelden: 5 })
  pruefe('Ein Ergebnis zu einem anderen Titel zählt nicht', w.gemeldet === 0 && w.geoeffnet.length === 1)
  w.lauf.geprueft({ url: A.url, zuMelden: 5 })
  pruefe('Neue Folgen → gemeldet über denselben Weg wie der Klick', w.gemeldet === 1 && w.geoeffnet.length === 1)
  w.lauf.geprueft({ url: A.url, zuMelden: 5 })
  pruefe('Ein zweites Prüfergebnis meldet nicht doppelt', w.gemeldet === 1)
  w.offen = [B, C]
  w.lauf.gemeldet({ ok: true })
  pruefe('Nach dem Melden weiter zum nächsten Titel', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.lauf.geprueft({ url: B.url, zuMelden: 0 })
  pruefe('Nichts Neues → abgehakt, weiter ohne Meldung', w.gemeldet === 1 && w.geoeffnet.at(-1) === C.url, w.geoeffnet)
  w.uhr += 2 * 60 * 1000
  w.lauf.takt()
  pruefe('Vor der Zeitgrenze bleibt der Titel offen', w.ende === null)
  w.offen = []
  w.uhr += 2 * 60 * 1000
  w.lauf.takt()
  pruefe('Ohne Ergebnis nach drei Minuten übersprungen, dann Ende', w.ende?.grund === 'nichts mehr offen' && w.ende.uebersprungen[0]?.url === C.url, w.ende)
  pruefe('Das Ende zählt alle drei Titel', w.ende?.erledigt === 3, w.ende)
  pruefe('Nach dem Ende läuft nichts mehr', !w.lauf.laeuft())
}
{
  const A = { id: 'a', url: 'https://www.disneyplus.com/series/a/1' }
  const w = welt([A])
  w.lauf.starten()
  w.lauf.geprueft({ url: A.url, zuMelden: 3 })
  w.offen = []
  w.lauf.gemeldet({ ok: false })
  pruefe('Eine gescheiterte Meldung steht am Ende', w.ende?.uebersprungen[0]?.grund === 'Meldung kam nicht an', w.ende)
}
{
  const A = { id: 'a', url: 'https://www.disneyplus.com/series/a/1' }
  const w = welt([A])
  w.lauf.starten()
  w.lauf.beenden()
  pruefe('Beenden von Hand', w.ende?.grund === 'von Hand' && !w.lauf.laeuft(), w.ende)
  const leer = welt([])
  leer.lauf.starten()
  pruefe('Ohne offene Titel endet der Lauf sofort', leer.ende?.grund === 'nichts mehr offen' && leer.geoeffnet.length === 0)
  const alt = welt([A])
  alt.lauf.starten()
  alt.uhr += 3 * 60 * 60 * 1000
  pruefe('Nach zwei Stunden gilt der Lauf als beendet', !alt.lauf.laeuft())
}

/** Die Meldung „weg" ist asynchron: ein Zug der Ereignisschleife, dann ist der Lauf weiter. */
const tick = () => new Promise((r) => setImmediate(r))

const A = { id: 'a', url: 'https://www.disneyplus.com/de-de/browse/entity-a' }
const B = { id: 'b', url: 'https://www.disneyplus.com/de-de/browse/entity-b' }
const quelle = (datei) => readFileSync(__dirname + '/' + datei, 'utf8')

/** Startseite (Umleitung): der Titel wird als „weg" gemeldet, bevor es weitergeht. */
async function wegStartseite() {
  pruefe('Verdrahtung: der Durchgang reicht „weg" an die Seite, die Seite an dieselbe Funktion wie der Knopf „nichts da?"', /meldeWeg: \(url\) => seite\(\)\?\.meldeWeg\(url\)/.test(quelle('disney-durchgang.js')) && /meldeWeg: \(url\) => \{[^}]*meldeWeg\(e\)/.test(quelle('disney.js')))
  const w = welt([A, B])
  w.lauf.starten()
  w.zustand = { startseite: true, kennung: null, eintragUrl: null }
  w.uhr += 5000
  w.lauf.takt()
  pruefe('Startseite: in den ersten Sekunden noch warten', w.geoeffnet.length === 1 && w.weg.length === 0)
  w.uhr += 10_000
  w.offen = [B]
  w.lauf.takt()
  pruefe('Startseite (Umleitung): der Titel wird als „weg" gemeldet', w.weg.join() === A.url, w.weg)
  pruefe('… und erst nach der Antwort geht es weiter', w.geoeffnet.length === 1, w.geoeffnet)
  w.lauf.takt()
  w.lauf.takt()
  pruefe('… ohne den Titel in jedem Takt erneut zu melden', w.weg.length === 1, w.weg)
  await tick()
  pruefe('Gemeldet → weiter zum nächsten Titel', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.zustand = { startseite: false, kennung: 'fremd', eintragUrl: null }
  w.uhr += 15_000
  w.lauf.takt()
  pruefe('Andere Titelseite → der Lauf endet „von Hand übernommen"', w.ende?.grund === 'von Hand übernommen' && !w.lauf.laeuft(), w.ende)
  pruefe('… und öffnet keinen weiteren Titel', w.geoeffnet.length === 2)
  pruefe('Das Ende zählt den gemeldeten Titel unter „nicht verfügbar gemeldet", nicht unter „übersprungen"', w.ende.weg.join() === A.url && w.ende.uebersprungen.length === 0, w.ende)
  const text = kontext.akDisneyEndeText(w.ende, (u) => (u === A.url ? 'Aoashi' : u))
  pruefe('Der Endtext nennt ihn', /1 nicht verfügbar gemeldet: Aoashi/.test(text) && !/übersprungen/.test(text), text)
}

/* 13.10.2026: Dialog „nicht in deinem Gebiet verfügbar" auf /de-de/home — sofort weiter, nicht erst nach der Schonzeit der Startseite. */
async function wegGebiet() {
  const gesperrt = kontext.akDisneyGebietGesperrt
  pruefe('Hinweistext „nicht in deinem Gebiet verfügbar" wird erkannt', gesperrt('Dieser Inhalt ist zurzeit nicht in deinem Gebiet verfügbar.\nOK') === true)
  pruefe('Gegenprobe: normale Startseite und leerer Text nicht', gesperrt('Startseite\nNeu auf Disney+') === false && gesperrt(undefined) === false)
  const w = welt([A, B])
  w.lauf.starten()
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 5000
  w.lauf.takt()
  await tick()
  pruefe('Gebiet gesperrt: schon im ersten Takt (5 s) gemeldet und weiter, ohne die 10 s der Startseite', w.weg.join() === A.url && w.geoeffnet.at(-1) === B.url, [w.weg, w.geoeffnet])
  w.zustand = { startseite: false, kennung: 'b', eintragUrl: B.url, gebiet: false }
  w.uhr += 20_000
  w.lauf.takt()
  pruefe('Gegenprobe: normale Titelseite ohne Hinweis wartet weiter und meldet nichts', w.geoeffnet.length === 2 && w.ende === null && w.weg.length === 1)
  w.offen = []
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 5000
  w.lauf.takt()
  await tick()
  pruefe('Der zweite gemeldete Titel steht am Ende in der Liste', w.ende?.weg.join() === `${A.url},${B.url}`, w.ende)
  const spaeter = welt([A, B])
  spaeter.lauf.starten()
  spaeter.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: false }
  spaeter.uhr += 5000
  spaeter.lauf.takt()
  pruefe('Gegenprobe: Startseite ohne Hinweis wartet weiter die 10 s Schonzeit, meldet nichts', spaeter.geoeffnet.length === 1 && spaeter.weg.length === 0)
}

/** Die Meldung scheitert, oder der Lauf endet währenddessen. */
async function wegScheitert() {
  const w = welt([A, B])
  w.wegOk = false
  w.lauf.starten()
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 5000
  w.lauf.takt()
  await tick()
  pruefe('Meldung kam nicht an: es geht trotzdem weiter', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.lauf.beenden()
  pruefe('… der Titel steht mit Grund unter „übersprungen", nicht unter „gemeldet"', w.ende.uebersprungen[0]?.grund === 'nicht in deinem Gebiet verfügbar, Meldung kam nicht an' && w.ende.weg.length === 0, w.ende)
  const v = welt([A, B])
  v.lauf.starten()
  v.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  v.uhr += 5000
  v.lauf.takt()
  v.lauf.beenden()
  await tick()
  pruefe('Von Hand beendet, während die Meldung läuft: der Lauf lebt nicht wieder auf', !v.lauf.laeuft() && v.geoeffnet.length === 1, v.geoeffnet)
}

async function haupt() {
  await wegStartseite()
  await wegGebiet()
  await wegScheitert()
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('\nAlle Zusicherungen halten.')
}

haupt()
