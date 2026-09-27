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
  const w = { uhr: 1_000_000, geoeffnet: [], gemeldet: 0, ende: null, offen, zustand: {} }
  w.lauf = durchgang({
    speicher: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) },
    jetzt: () => w.uhr,
    offene: () => w.offen,
    oeffne: (e) => w.geoeffnet.push(e.url),
    melde: () => w.gemeldet++,
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

{
  const A = { id: 'a', url: 'https://www.disneyplus.com/de-de/browse/entity-a' }
  const B = { id: 'b', url: 'https://www.disneyplus.com/de-de/browse/entity-b' }
  const w = welt([A, B])
  w.lauf.starten()
  w.zustand = { startseite: true, kennung: null, eintragUrl: null }
  w.uhr += 5000
  w.lauf.takt()
  pruefe('Startseite: in den ersten Sekunden noch warten', w.geoeffnet.length === 1)
  w.uhr += 10_000
  w.offen = [B]
  w.lauf.takt()
  pruefe('Startseite (Umleitung, nicht verfügbar) → sofort übersprungen, weiter', w.geoeffnet.at(-1) === B.url, w.geoeffnet)
  w.zustand = { startseite: false, kennung: 'fremd', eintragUrl: null }
  w.uhr += 15_000
  w.lauf.takt()
  pruefe('Andere Titelseite → der Lauf endet „von Hand übernommen"', w.ende?.grund === 'von Hand übernommen' && !w.lauf.laeuft(), w.ende)
  pruefe('… und öffnet keinen weiteren Titel', w.geoeffnet.length === 2)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
