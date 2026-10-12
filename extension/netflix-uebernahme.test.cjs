/**
 * Netflix: gemeldete Titel, die der Stand noch als offen führt, öffnet der Durchgang nicht erneut
 * (4.27.0, 11.10.2026). Fall: Gumball 70243420 — 38 Meldungen vom 11.10. 16:13 Z, im Stand weiter offen.
 */
const { readFileSync } = require('node:fs')

const lade = (datei, globale) => {
  const quelle = readFileSync(__dirname + '/' + datei, 'utf8')
  new Function('globalThis', 'fetch', quelle)(globale, globale.fetch)
}
const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const gumball = 'https://www.netflix.com/title/70243420'
const hajime = 'https://www.netflix.com/title/80000001'
const meldungen = {
  [gumball]: { paare: [{ nummer: 1, staffel: 1, am: '2026-10-11T16:13:06Z' }, { nummer: 1, staffel: 2, am: '2026-10-11T16:13:01Z' }] },
  [hajime]: { paare: [] },
}
let abrufe = 0
const fetchGespielt = async (adresse) => {
  abrufe++
  const url = decodeURIComponent(String(adresse).split('?gemeldet=')[1])
  return { ok: true, json: async () => meldungen[url] ?? { paare: [] } }
}

async function pruefeAlles() {
  const g = { fetch: fetchGespielt }
  lade('disney-netz.js', g)
  lade('netflix-uebernahme.js', g)
  const offene = {
    70243420: { staffeln: [{ nr: 1, offen: true, zustand: 'melden' }] },
    80000001: { staffeln: [{ nr: 1, offen: true, zustand: 'melden' }] },
  }
  const ziele = new Set([gumball, hajime, 'https://www.netflix.com/title/99999999'])

  const fertig = await g.akNetflixUebernahme(ziele, offene, 'https://w.example/pruefung')
  pruefe('Gumball: Meldungen im Briefkasten, im Stand offen → wartet auf die Übernahme', fertig.has('70243420'), [...fertig])
  pruefe('ein Titel ohne Meldung bleibt offen', !fertig.has('80000001'), [...fertig])
  pruefe('ein Ziel, das nicht in der Prüfliste steht, wird nicht erfragt', abrufe === 2, abrufe)

  await g.akNetflixUebernahme(ziele, offene, 'https://w.example/pruefung')
  pruefe('zweiter Aufruf: Gumball (bekannt) und der Titel ohne Meldung (zehn Minuten Frist) werden nicht noch einmal erfragt', abrufe === 2, abrufe)

  /* Wiedervorlage: eine Meldung vor `seit` beantwortet sie nicht (frischer Zustand, eigene Sandkasten-Welt). */
  const g2 = { fetch: fetchGespielt }
  lade('disney-netz.js', g2)
  lade('netflix-uebernahme.js', g2)
  const mitSeit = { 70243420: { staffeln: [{ nr: 1, offen: true, zustand: 'erneut', seit: '2026-10-12' }] } }
  const erneut = await g2.akNetflixUebernahme(new Set([gumball]), mitSeit, 'https://w.example/pruefung')
  pruefe('Wiedervorlage nach der Meldung: Titel bleibt offen', !erneut.has('70243420'), [...erneut])

  const g3 = { fetch: fetchGespielt }
  lade('disney-netz.js', g3)
  lade('netflix-uebernahme.js', g3)
  const davor = { 70243420: { staffeln: [{ nr: 1, offen: true, zustand: 'erneut', seit: '2026-10-10' }] } }
  const beantwortet = await g3.akNetflixUebernahme(new Set([gumball]), davor, 'https://w.example/pruefung')
  pruefe('Wiedervorlage vor der Meldung: beantwortet', beantwortet.has('70243420'), [...beantwortet])

  const g4 = { fetch: async () => { throw new Error('offline') } }
  lade('disney-netz.js', g4)
  lade('netflix-uebernahme.js', g4)
  const ohneNetz = await g4.akNetflixUebernahme(ziele, offene, 'https://w.example/pruefung')
  pruefe('ohne Netz bleibt alles offen, kein Absturz', ohneNetz.size === 0, [...ohneNetz])

  /* Verdrahtung in melder.js: fertig() fragt die Menge, standHolen() füllt sie. */
  const melder = readFileSync(__dirname + '/melder.js', 'utf8')
  pruefe('fertig() kennt die wartenden Reihen', melder.includes('frischGemeldetNetflix.has(String(id)) || akNetflixWartet.has(String(id))'))
  pruefe('standHolen() füllt sie aus dem Briefkasten', melder.includes('akNetflixUebernahme(standZieleNetflix, offeneTitel, WORKER).then(uebersichtZeigen)'))
  /* Die Menge, die fertig() liest, füllt der Helfer: Gumball landet darin (mit den Fällen oben im selben Sandkasten). */
  pruefe('der Helfer füllt akNetflixWartet', g.akNetflixWartet.has('70243420') && !g.akNetflixWartet.has('80000001'), [...g.akNetflixWartet])
  const manifest = readFileSync(__dirname + '/manifest.json', 'utf8')
  const ordnung = ['disney-netz.js', 'netflix-uebernahme.js', 'melder.js'].map((n) => manifest.indexOf(`"${n}"`))
  pruefe('Manifest: Netflix lädt disney-netz.js und netflix-uebernahme.js vor melder.js', ordnung[0] > 0 && ordnung[0] < ordnung[1] && ordnung[1] < ordnung[2], ordnung)

  process.exit(faelle.every(Boolean) ? 0 : 1)
}

pruefeAlles()
