/**
 * Netflix-Durchgang: übersprungene Titel bleiben zurückgestellt (4.31.2, 15.10.2026).
 *
 * Anlass: Yu-Gi-Oh! und Pokémon Sonne & Mond kamen bei jedem „▶ alle durchgehen“ wieder, weil die Merkliste nur im
 * Arbeitsspeicher lag. Geprüft wird die echte Datei mit einem Speicher-Double und einer festen Uhr:
 * Ablauf je Grund, Neustart behält, Abgelaufenes fällt raus, gemeldeter Titel fällt raus.
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

console.log('Netflix: zurückgestellte Titel')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-erinnern.js'), kontext)
vm.runInContext(lies('netflix-zurueckgestellt.js'), kontext)
const neu = kontext.akNetflixZurueckNeu
pruefe('Fabrik erreichbar', typeof neu === 'function')

const SCHLUESSEL = 'netflixZurueckgestellt'
const TAG = 24 * 3600 * 1000
/* 15.10.2026, 12:00 Berlin (Sommerzeit bis 25.10.2026). */
const JETZT = Date.UTC(2026, 9, 15, 10, 0)

/* Wie `chrome.storage.local`: kopiert beim Lesen und Schreiben. */
const speicherNeu = (start = {}) => {
  const daten = { ...start }
  const kopie = (x) => JSON.parse(JSON.stringify(x))
  return {
    daten,
    get: async (k) => (k in daten ? { [k]: kopie(daten[k]) } : {}),
    set: async (o) => void Object.assign(daten, kopie(o)),
  }
}
const ruhe = () => new Promise((fertig) => setImmediate(fertig))
const stand = (speicher) => speicher.daten[SCHLUESSEL] ?? {}

/* Ein Seitenaufruf: neue Merkliste über demselben Speicher. */
const seite = async (speicher, o = {}) => {
  const uhr = { t: o.jetzt ?? JETZT }
  const karte = neu(o.fertig ?? (() => false), { speicher, jetzt: () => uhr.t, datum: () => o.datum ?? null })
  await ruhe()
  return { karte, uhr }
}

const berlin = (j, m, t, h = 0) => Date.UTC(j, m - 1, t, h)

async function ablaufJeGrund() {
  /* Ablauf je Grund */
  const a = speicherNeu()
  const { karte } = await seite(a, { datum: '20. Oktober' })
  karte.set('1', 'Erinnern statt Folgenliste')
  karte.set('2', 'keine Folgenliste in 20 s')
  karte.set('3', 'nach 2 Versuchen noch offen')
  await ruhe()
  pruefe('Erinnern mit Datum: bis zu diesem Tag 00:00 Berlin (20.10.2026 = 19.10. 22:00 UTC)', stand(a)['1']?.bis === Date.UTC(2026, 9, 19, 22, 0), stand(a)['1'])
  pruefe('keine Folgenliste: 1 Tag', stand(a)['2']?.bis === JETZT + TAG, stand(a)['2'])
  pruefe('nach N Versuchen offen: 1 Tag', stand(a)['3']?.bis === JETZT + TAG, stand(a)['3'])
  pruefe('der Grund wird mitgespeichert', stand(a)['1']?.grund === 'Erinnern statt Folgenliste')

  const b = speicherNeu()
  const ohne = await seite(b)
  ohne.karte.set('1', 'Erinnern statt Folgenliste')
  await ruhe()
  pruefe('Erinnern ohne Datum: 7 Tage', stand(b)['1']?.bis === JETZT + 7 * TAG, stand(b)['1'])

  const bis = kontext.akZurueckBis
  pruefe('Datum im Winter: 3. November 2026 = 2.11. 23:00 UTC', bis('Erinnern', '3. November 2026', JETZT) === berlin(2026, 11, 2, 23), bis('Erinnern', '3. November 2026', JETZT))
  pruefe('Datum ohne Jahr, schon vorbei: nächstes Jahr (29. September → 2027)', bis('Erinnern', 'Ab 29. September', JETZT) === berlin(2027, 9, 28, 22))
  pruefe('Datum ohne Jahr, noch voraus: dieses Jahr (12. Dezember → 11.12. 23:00 UTC)', bis('Erinnern', '12. Dezember', JETZT) === berlin(2026, 12, 11, 23))
  pruefe('Kurzform „3. Okt." und „Mär" werden gelesen', bis('Erinnern', '3. Okt. 2026', JETZT) === berlin(2026, 10, 2, 22) && bis('Erinnern', '1. März 2027', JETZT) === berlin(2027, 2, 28, 23))
  pruefe('unlesbares Datum: 7 Tage', bis('Erinnern', '5. Blubber', JETZT) === JETZT + 7 * TAG)

}

async function neustart() {
  /* Zurückgestellte werden übersprungen, auch nach Neustart und clear() */
  const c = speicherNeu()
  const erster = await seite(c)
  erster.karte.set('70177034', 'Erinnern statt Folgenliste')
  await ruhe()
  pruefe('im selben Lauf: has() ist wahr', erster.karte.has('70177034'))
  erster.karte.clear()
  await ruhe()
  pruefe('Neustart des Durchgangs (clear) leert den Speicher nicht', Boolean(stand(c)['70177034']), stand(c))
  pruefe('… und der Titel gilt weiter als übersprungen', erster.karte.has('70177034') && !erster.karte.has('99'))
  const zweiter = await seite(c, { jetzt: JETZT + 3 * TAG })
  pruefe('neue Seite/neuer Lauf: Titel noch zurückgestellt (nach 3 Tagen, Frist 7)', zweiter.karte.has('70177034'))
  pruefe('… aber nicht in den Schlüsseln des Berichts (nur dieser Lauf)', [...zweiter.karte.keys()].length === 0)
  pruefe('Endanzeige nennt die Zahl', zweiter.karte.zurueckText() === ' · 1 zurückgestellt', zweiter.karte.zurueckText())

  /* Ablauf wird sichtbar: spätestens nach der Frist ist der Titel wieder dran */
  const spaet = await seite(c, { jetzt: JETZT + 7 * TAG })
  pruefe('Nach Ablauf (7 Tage) ist der Titel wieder dran', !spaet.karte.has('70177034'))
  await ruhe()
  pruefe('… und der Eintrag ist aus dem Speicher entfernt', !stand(c)['70177034'], stand(c))
  pruefe('… Endanzeige ohne Zahl', spaet.karte.zurueckText() === '')

}

async function abgelaufen() {
  /* Abgelaufenes beim Laden */
  const d = speicherNeu({ [SCHLUESSEL]: { 5: { grund: 'x', bis: JETZT - 1 }, 6: { grund: 'y', bis: JETZT + TAG } } })
  const geladen = await seite(d)
  await ruhe()
  pruefe('Eintrag mit Ablauf in der Vergangenheit fällt beim Laden raus', !geladen.karte.has('5') && !stand(d)['5'], stand(d))
  pruefe('Eintrag mit Ablauf in der Zukunft bleibt', geladen.karte.has('6') && Boolean(stand(d)['6']))

}

async function gemeldet() {
  /* Gemeldeter Titel fällt raus */
  const e = speicherNeu({ [SCHLUESSEL]: { 7: { grund: 'x', bis: JETZT + TAG }, 8: { grund: 'y', bis: JETZT + TAG } } })
  const gemeldet = await seite(e, { fertig: (k) => k === '7' })
  await ruhe()
  pruefe('Titel, der nach dem Worker-Stand fertig ist, ist nicht mehr zurückgestellt', !gemeldet.karte.has('7') && !stand(e)['7'], stand(e))
  pruefe('… ein anderer bleibt', gemeldet.karte.has('8') && Boolean(stand(e)['8']))
  gemeldet.karte.set('8', 'fertig')
  await ruhe()
  pruefe('Grund „fertig“ (Titel erfolgreich geprüft) entfernt den Eintrag', !stand(e)['8'], stand(e))

}

async function mitWartefunktion() {
  /* Zusammenspiel mit der Wartefunktion: derselbe Grund, dasselbe Datum */
  const f = speicherNeu()
  const lauf = await seite(f, { datum: '12. Dezember' })
  kontext.akNetflixListeWarten({ seite: 'x', seit: JETZT - 5000 }, { seite: 'x', reihe: '80186475', erinnern: true, frist: 20000, jetzt: JETZT, durchlauf: { folgen: [] } }, { spur() {}, uebersprungen: lauf.karte, weiter() {} })
  await ruhe()
  pruefe('netflix-erinnern.js + Merkliste: Erinnern-Titel wird mit Datum gespeichert', stand(f)['80186475']?.bis === berlin(2026, 12, 11, 23), stand(f))
}

async function verdrahtung() {
  /* Verdrahtung */
  const melder = lies('melder.js')
  pruefe('melder.js legt die Merkliste mit der Fabrik an', /const selbstUebersprungen = akNetflixZurueckNeu\(/.test(melder))
  pruefe('… und hängt die Zahl an die Endanzeige', /selbstUebersprungen\.zurueckText\(\)/.test(melder))
  const manifest = JSON.parse(lies('manifest.json'))
  const js = manifest.content_scripts.find((c) => c.js.includes('melder.js')).js
  pruefe('Manifest: netflix-zurueckgestellt.js lädt vor melder.js', js.includes('netflix-zurueckgestellt.js') && js.indexOf('netflix-zurueckgestellt.js') < js.indexOf('melder.js'))

}

async function haupt() {
  await ablaufJeGrund()
  await neustart()
  await abgelaufen()
  await gemeldet()
  await mitWartefunktion()
  await verdrahtung()
  console.log('')
  if (fehler.length) {
    console.log(`${fehler.length} Prüfung(en) fehlgeschlagen`)
    process.exit(1)
  }
  console.log('Alle Prüfungen bestanden')
}

haupt().catch((x) => {
  console.error(x)
  process.exit(1)
})
