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

/** Eine Welt = Speicher, Uhr und Liste; `seite(start)` ist ein neues Dokument (neue Fabrik, gleicher Speicher). */
function welt(offen, dauerMap = new Map()) {
  const m = new Map()
  const lager = (map) => ({ getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) })
  const w = { uhr: 1_000_000, geoeffnet: [], gemeldet: 0, ende: null, offen, zustand: {}, dauerMap }
  w.seite = (seitenStart) => {
    w.lauf = durchgang({
      speicher: lager(m),
      dauer: lager(dauerMap),
      seitenStart,
      jetzt: () => w.uhr,
      offene: () => w.offen,
      oeffne: (e) => w.geoeffnet.push(e.url),
      melde: () => w.gemeldet++,
      ende: (info) => (w.ende = info),
      zustand: () => w.zustand,
    })
  }
  w.seite(Infinity)
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

const A = { id: 'a', url: 'https://www.disneyplus.com/de-de/browse/entity-a' }
const B = { id: 'b', url: 'https://www.disneyplus.com/de-de/browse/entity-b' }
const TAG = 24 * 60 * 60 * 1000
const quelle = (datei) => readFileSync(__dirname + '/' + datei, 'utf8')

/** Die Verdrahtung: nichts geht an den Worker, die Seite meldet ihre Ladezeit, das Gedächtnis ist `localStorage`. */
function verdrahtung() {
  const dg = quelle('disney-durchgang.js')
  pruefe('Verdrahtung: der Durchgang kennt keinen Meldeweg zum Worker', !/meldeWeg|fetch\(|wegMelden/.test(dg))
  pruefe('Verdrahtung: die Seite bietet dem Durchgang keinen „weg"-Weg an', !/^\s*meldeWeg:/m.test(quelle('disney.js')))
  pruefe('Verdrahtung: Gedächtnis ist localStorage, Seitenstart ist die Ladezeit der Seite', /dauer: localStorage/.test(dg) && /seitenStart: Date\.now\(\)/.test(dg))
}

/** Startseite (Umleitung): nach der Schonzeit lokal zurückgestellt, nichts gemeldet, sofort weiter. */
function startseite() {
  const w = welt([A, B])
  w.lauf.starten()
  w.zustand = { startseite: true, kennung: null, eintragUrl: null }
  w.uhr += 5000
  w.lauf.takt()
  pruefe('Startseite: in den ersten Sekunden noch warten', w.geoeffnet.length === 1 && w.ende === null)
  w.uhr += 10_000
  w.lauf.takt()
  pruefe('Startseite (Umleitung): der Lauf geht im selben Takt weiter, ohne auf eine Antwort zu warten', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.zustand = { startseite: false, kennung: 'fremd', eintragUrl: null }
  w.uhr += 15_000
  w.lauf.takt()
  pruefe('Andere Titelseite → der Lauf endet „von Hand übernommen"', w.ende?.grund === 'von Hand übernommen' && !w.lauf.laeuft(), w.ende)
  pruefe('Der Titel steht mit Grund unter „übersprungen"', w.ende.uebersprungen[0]?.url === A.url && w.ende.uebersprungen[0].grund === 'nicht verfügbar (Startseite)', w.ende)
}

/* 13.10.2026: Dialog „nicht in deinem Gebiet verfügbar" auf /de-de/home — sofort weiter, nicht erst nach der Schonzeit der Startseite. */
function gebiet() {
  const gesperrt = kontext.akDisneyGebietGesperrt
  pruefe('Hinweistext „nicht in deinem Gebiet verfügbar" wird erkannt', gesperrt('Dieser Inhalt ist zurzeit nicht in deinem Gebiet verfügbar.\nOK') === true)
  pruefe('Gegenprobe: normale Startseite und leerer Text nicht', gesperrt('Startseite\nNeu auf Disney+') === false && gesperrt(undefined) === false)
  const w = welt([A, B])
  w.lauf.starten()
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 5000
  w.lauf.takt()
  pruefe('Gebiet gesperrt: schon im ersten Takt (5 s) weiter, ohne die 10 s der Startseite', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.zustand = { startseite: false, kennung: 'b', eintragUrl: B.url, gebiet: false }
  w.uhr += 20_000
  w.lauf.takt()
  pruefe('Gegenprobe: normale Titelseite ohne Hinweis wartet weiter', w.geoeffnet.length === 2 && w.ende === null)
  const spaeter = welt([A, B])
  spaeter.lauf.starten()
  spaeter.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: false }
  spaeter.uhr += 5000
  spaeter.lauf.takt()
  pruefe('Gegenprobe: Startseite ohne Hinweis wartet die 10 s Schonzeit', spaeter.geoeffnet.length === 1)
}

/** Das lokale Gedächtnis: der nächste Durchgang öffnet den Titel nicht erneut, nach 7 Tagen wieder. */
function zurueckgestellt() {
  const erster = welt([A, B])
  erster.lauf.starten()
  erster.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  erster.uhr += 5000
  erster.lauf.takt()
  const naechster = welt([A, B], erster.dauerMap)
  naechster.uhr = erster.uhr + TAG
  naechster.lauf.starten()
  pruefe('Nächster Durchgang: der zurückgestellte Titel wird nicht erneut geöffnet', naechster.geoeffnet.join() === B.url, naechster.geoeffnet)
  naechster.lauf.beenden()
  const text = kontext.akDisneyEndeText(naechster.ende, (u) => (u === A.url ? 'Aoashi' : u))
  pruefe('… das Ende nennt ihn als zurückgestellt', naechster.ende.zurueck.join() === A.url && /1 zurückgestellt .*: Aoashi/.test(text), text)
  const knapp = welt([A, B], erster.dauerMap)
  knapp.uhr = erster.uhr + 7 * TAG - 1000
  knapp.lauf.starten()
  pruefe('Knapp vor Ablauf der 7 Tage ruht er noch', knapp.geoeffnet.join() === B.url, knapp.geoeffnet)
  const danach = welt([A, B], erster.dauerMap)
  danach.uhr = erster.uhr + 7 * TAG + 1000
  danach.lauf.starten()
  pruefe('Spätestens nach 7 Tagen fragt der Durchgang den Titel wieder', danach.geoeffnet.join() === A.url, danach.geoeffnet)
}

/** Alte Seite: sie läuft bis zum Seitenwechsel weiter, ihr Zustand gehört nicht dem neuen Ziel. */
function alteSeite() {
  const w = welt([A, B])
  const t0 = w.uhr
  w.lauf.starten()
  w.seite(t0 + 3000)
  w.uhr = t0 + 10_000
  w.lauf.geprueft({ url: A.url, zuMelden: 0 })
  pruefe('Nach dem Abhaken ist B das Ziel', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 2000
  w.lauf.takt()
  pruefe('Alte Seite (Hinweis von A) zeigt noch: B wird nicht zurückgestellt', w.geoeffnet.length === 2 && w.ende === null, w.ende)
  w.uhr += 20_000
  w.zustand = { startseite: false, kennung: 'a', eintragUrl: A.url, gebiet: false }
  w.lauf.takt()
  pruefe('Alte Seite zeigt A, noch kein Seitenwechsel: der Lauf endet nicht „von Hand übernommen"', w.ende === null && w.lauf.laeuft(), w.ende)
  pruefe('… und nichts ist zurückgestellt', w.dauerMap.size === 0, [...w.dauerMap.keys()])
  w.seite(t0 + 10_500)
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 2000
  w.lauf.takt()
  const b = w.ende?.uebersprungen.find((u) => u.url === B.url)
  pruefe('Die neue Seite (nach dem Öffnen geladen) mit Hinweis: B wird zurückgestellt', b?.grund === 'nicht in deinem Gebiet verfügbar' && w.dauerMap.size === 1, w.ende)
}

/** Hängen bleibt der Lauf nicht: Ohne neue Seite greift die Frist von drei Minuten. */
function frist() {
  const w = welt([A, B])
  const t0 = w.uhr
  w.lauf.starten()
  w.lauf.geprueft({ url: A.url, zuMelden: 0 })
  w.seite(t0 - 60_000)
  w.zustand = { startseite: true, kennung: null, eintragUrl: null, gebiet: true }
  w.uhr += 2 * 60 * 1000
  w.lauf.takt()
  pruefe('Bei alter Seite nach 2 Minuten noch kein Abhaken', w.geoeffnet.length === 2)
  w.uhr += 61 * 1000
  w.offen = []
  w.lauf.takt()
  pruefe('Nach drei Minuten ohne neue Seite: „kein Ergebnis nach 3 Minuten", Lauf geht weiter', w.ende?.uebersprungen[0]?.grund === 'kein Ergebnis nach 3 Minuten', w.ende)
}

function haupt() {
  verdrahtung()
  startseite()
  gebiet()
  zurueckgestellt()
  alteSeite()
  frist()
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('\nAlle Zusicherungen halten.')
}

haupt()
