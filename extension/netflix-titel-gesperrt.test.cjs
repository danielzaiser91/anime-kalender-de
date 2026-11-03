/**
 * **Zeigt Netflix einen Titel nicht, überspringt der Durchgang ihn — er endet nicht daran** (03.11.2026).
 *
 * Daniel, „alle durchgehen": erster Titel „Ghost in the Shell" (Film, `/title/540533`). Netflix zeigte
 * die Startseite, der Player meldete E103 (Bericht `anime-kalender-netflix-2026-11-03T13-16-53`:
 * `stoerung: "E103"`, `abbruch: true`, danach „Durchgang abgebrochen · abgebrochen · besucht 1,
 * gemessen 0"). Jede Störung beendete den Durchgang; nur `M7…` (Wiedergabe) soll ihn anhalten.
 * Dazu: Leitet Netflix den Sprung per echter Adresse auf `/browse` um, wartete der Durchgang ohne Ende.
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
const lies = (n) => readFileSync(resolve(__dirname, n), 'utf8')

console.log('Netflix: Titel gesperrt, Durchgang geht weiter')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-erinnern.js'), kontext)
const { akNetflixStoerung, akNetflixTitelUeberspringen, akNetflixUmgeleitet } = kontext

/* --- Störung im Durchlauf --- */
const stoerung = (selbst, code) => {
  const vorfaelle = []
  const d = { selbst, stoerung: null, abbruch: false, titelSperre: undefined }
  akNetflixStoerung(d, code, { reihe: 111, ziel: 540533, folge: 3, vorfall: (art, daten) => vorfaelle.push([art, daten]) })
  return { d, vorfaelle }
}
for (const code of ['E103', 'UI3003', 'NSES-404', 'E100']) {
  const { d, vorfaelle } = stoerung(true, code)
  pruefe(`${code} im Durchgang: Durchlauf bricht ab, Titel wird übersprungen`, d.abbruch && d.stoerung === code && d.titelSperre?.code === code)
  pruefe(`${code}: der Schlüssel ist der angesprungene Titel (ziel), nicht die Player-Reihe`, d.titelSperre?.reihe === '540533', d.titelSperre)
  pruefe(`${code}: kein Vorfall für einen übersprungenen Titel`, vorfaelle.length === 0)
}
{
  const { d, vorfaelle } = stoerung(true, 'M7355')
  pruefe('M7355 im Durchgang: bricht ab, überspringt nicht', d.abbruch && d.titelSperre === null)
  pruefe('M7355: der Vorfall geht raus, mit Reihe und Folge', vorfaelle.length === 1 && vorfaelle[0][0] === 'stoerung' && vorfaelle[0][1].reihe === 111 && vorfaelle[0][1].folge_nr === 3, vorfaelle)
}
{
  const { d, vorfaelle } = stoerung(false, 'E103')
  pruefe('E103 beim Einzelknopf: bricht ab, nichts wird übersprungen', d.abbruch && d.titelSperre === null)
  pruefe('E103 beim Einzelknopf: der Vorfall geht raus wie bisher', vorfaelle.length === 1)
  const ohneZiel = { selbst: true }
  akNetflixStoerung(ohneZiel, 'E103', { reihe: 222, folge: 1, vorfall() {} })
  pruefe('ohne ziel gilt die Reihe', ohneZiel.titelSperre?.reihe === '222')
}

/* --- Ende des Durchlaufs --- */
{
  const u = new Map()
  let weiter = 0
  pruefe('ohne Sperre geschieht nichts', akNetflixTitelUeberspringen({ titelSperre: null }, u, () => weiter++) === false && weiter === 0 && u.size === 0)
  const d = { titelSperre: { code: 'E103', reihe: '540533' } }
  pruefe('mit Sperre: weiter', akNetflixTitelUeberspringen(d, u, () => weiter++) === true && weiter === 1)
  pruefe('Grund steht mit Code beim Titel', u.get('540533') === 'Netflix zeigt ihn nicht (E103)', [...u])
  pruefe('die Sperre ist verbraucht, ein zweiter Aufruf geht nicht noch einmal weiter', akNetflixTitelUeberspringen(d, u, () => weiter++) === false && weiter === 1)
}

/* --- Umleitung auf /browse --- */
const basis = () => ({ selbstAn: true, laeuft: false, pfad: '/browse', ziel: { id: '540533', zeit: 1000, durchgang: true }, jetzt: 6000, offen: true })
const lauf = (aenderung, vorher = []) => {
  const u = new Map(vorher)
  const w = { spur: [], weiter: 0 }
  const r = akNetflixUmgeleitet({ ...basis(), ...aenderung }, { spur: (...a) => w.spur.push(a), uebersprungen: u, weiter: () => w.weiter++ })
  return { r, u, w }
}
{
  const { r, u, w } = lauf({})
  pruefe('auf /browse nach dem Sprung: übersprungen und weiter', r === true && w.weiter === 1 && u.get('540533') === 'Netflix leitet auf die Startseite um' && w.spur.length === 1)
}
pruefe('Gebietspfad /de-en/browse zählt ebenso', lauf({ pfad: '/de-en/browse' }).r === true)
pruefe('Titelseite: keine Umleitung', lauf({ pfad: '/title/540533' }).r === false)
pruefe('/watch: keine Umleitung', lauf({ pfad: '/watch/540533' }).r === false)
pruefe('Durchgang aus: nichts', lauf({ selbstAn: false }).r === false)
pruefe('Durchlauf läuft: nichts', lauf({ laeuft: true }).r === false)
pruefe('Titel nicht (mehr) auf der Liste: nichts', lauf({ offen: false }).r === false)
pruefe('kein Ziel: nichts', lauf({ ziel: null }).r === false)
pruefe('Sprung vor 3999 ms: noch warten', lauf({ jetzt: 1000 + 3999 }).r === false)
pruefe('Sprung vor genau 4000 ms: weiter', lauf({ jetzt: 1000 + 4000 }).r === true)
pruefe('Sprung genau 60000 ms her: noch dem Durchgang', lauf({ jetzt: 1000 + 60000 }).r === true)
pruefe('Sprung 60001 ms her: gehört nicht mehr dem Durchgang', lauf({ jetzt: 1000 + 60001 }).r === false)
pruefe('altes Ziel von Stunden her auf /browse: nichts, nichts übersprungen', (() => { const l = lauf({ jetzt: 1000 + 3 * 3600 * 1000 }); return l.r === false && l.u.size === 0 && l.w.weiter === 0 })())
pruefe('Ziel vom Einzelknopf/aus der Liste (ohne durchgang): nichts, nichts übersprungen', (() => { const l = lauf({ ziel: { id: '540533', zeit: 1000 } }); return l.r === false && l.u.size === 0 && l.w.weiter === 0 })())
pruefe('schon übersprungener Titel: nicht noch einmal', lauf({}, [['540533', 'x']]).r === false)

/* --- Kreislauf: drei Titel, der erste gesperrt, der zweite umgeleitet, der dritte läuft --- */
{
  const titel = ['540533', '26588007', '60036794']
  const u = new Map()
  const besucht = []
  let ziel = null
  const naechster = () => titel.find((t) => !u.has(t) && !besucht.includes(t))
  const weiter = () => {
    const n = naechster()
    if (n) {
      besucht.push(n)
      ziel = { id: n, zeit: 0 }
    }
  }
  weiter()
  const d1 = { selbst: true }
  akNetflixStoerung(d1, 'E103', { reihe: 540533, ziel: ziel.id, folge: 1, vorfall() {} })
  akNetflixTitelUeberspringen(d1, u, weiter)
  const r2 = akNetflixUmgeleitet({ ...basis(), ziel: { ...ziel, zeit: 0, durchgang: true }, jetzt: 5000 }, { spur() {}, uebersprungen: u, weiter })
  pruefe('Kreislauf: Titel 1 gesperrt, Titel 2 umgeleitet, Titel 3 kommt dran', r2 === true && besucht.join() === titel.join() && u.size === 2, { besucht, u: [...u] })
}

/* --- Verdrahtung in melder.js: die echten Aufrufstellen laufen mit Attrappen --- */
const quelle = lies('melder.js')
{
  const von = quelle.indexOf('      if (i > 10 && !spuren) {')
  const bis = quelle.indexOf('\n      }\n', von) + 9
  const block = quelle.slice(von, bis)
  pruefe('Störungsstelle in melder.js gefunden', von > 0 && /akNetflixStoerung\(DURCHLAUF, code,/.test(block))
  const ausfuehren = new Function('akNetflixStoerung', 'DURCHLAUF', 'stoerung', 'gemeinteReihe', 'selbstVersucht', 'f', 'vorfallMelden', `const i = 11, spuren = null; for (;;) { ${block}; break }`)
  const d = { selbst: true }
  ausfuehren(akNetflixStoerung, d, () => 'E103', () => '999', '540533', { nummer: 1 }, () => {})
  pruefe('echte Störungsstelle: setzt die Sperre mit dem Ziel', d.titelSperre?.reihe === '540533' && d.abbruch === true, d)
}
{
  const von = quelle.indexOf('  if (DURCHLAUF.selbst && selbstAn && akNetflixTitelUeberspringen(')
  const bis = quelle.indexOf('\n  }\n', quelle.indexOf('laufBeenden(DURCHLAUF.abbruch', von)) + 5
  const block = quelle.slice(von, bis)
  pruefe('Endstelle in melder.js gefunden', von > 0 && bis > von)
  const ausfuehren = new Function('akNetflixTitelUeberspringen', 'DURCHLAUF', 'selbstAn', 'selbstUebersprungen', 'selbstWeiter', 'laufBeenden', 'globalThis', block)
  for (const [name, sperre, abbruch, weiterErwartet, beendetErwartet] of [
    ['Titelsperre: weiter, Durchgang bleibt', { code: 'E103', reihe: '5' }, true, 1, 0],
    ['Abbruch ohne Sperre (M7…, Escape): Durchgang endet', null, true, 0, 1],
  ]) {
    let weiter = 0
    let beendet = 0
    ausfuehren(akNetflixTitelUeberspringen, { selbst: true, titelSperre: sperre, abbruch, stoerung: null }, true, new Map(), () => weiter++, () => beendet++, {})
    pruefe(name, weiter === weiterErwartet && beendet === beendetErwartet, { weiter, beendet })
  }
  pruefe('der Reset steht beim Start des Durchlaufs', /DURCHLAUF\.stoerung = null\n  DURCHLAUF\.titelSperre = null/.test(quelle))
}
/* Die echten Funktionen `selbstWeiter` und `vielleichtSelbstStarten` laufen mit Attrappen (kein Regex auf den Quelltext). */
const funktionText = (kopf) => {
  const von = quelle.indexOf(kopf)
  return quelle.slice(von, quelle.indexOf('\n}\n', von) + 2)
}
const jetzt = (ms) => ({ now: () => ms })
/** `selbstWeiter` als Attrappen-Welt; gibt den Speicher (JSON, wie chrome.storage) und den Merker zurück. */
const weiterLaufen = () => {
  const speicher = {}
  const welt = { gegangen: [], speicher, merker: null }
  const f = new Function(
    'offeneTitel', 'akDurchgangSchutz', 'laufBeenden', 'naechsterAuftrag', 'speicherSchreiben', 'gehe', 'console', 'Date', 'LAUF_SCHLUESSEL', 'LAUF_HOECHSTENS_MS', 'ergebnis',
    `let selbstGezaehlt = 0, selbstGrenze = null, zuletztGeoeffnet = null
${funktionText('function selbstWeiter()')}
selbstWeiter()
ergebnis.merker = zuletztGeoeffnet`,
  )
  f(
    { 77: { titel: 'Probe' } }, () => null, () => {}, () => 77,
    async (werte) => { Object.assign(speicher, JSON.parse(JSON.stringify(werte))) },
    (adresse) => welt.gegangen.push(adresse), { log() {} }, jetzt(1000), 'k', 1, welt,
  )
  return welt
}
{
  const w = weiterLaufen()
  pruefe('selbstWeiter springt zum nächsten Titel', w.gegangen.join() === '/title/77', w.gegangen)
  pruefe('selbstWeiter: der Merker im Speicher trägt durchgang (überlebt ein volles Neuladen)', w.speicher.zuletztGeoeffnet?.durchgang === true && w.speicher.zuletztGeoeffnet.id === '77' && w.speicher.zuletztGeoeffnet.zeit === 1000, w.speicher)
  pruefe('selbstWeiter: Merker im Skript und im Speicher sind gleich', JSON.stringify(w.merker) === JSON.stringify(w.speicher.zuletztGeoeffnet), [w.merker, w.speicher])
}
/** `vielleichtSelbstStarten`; `o` überschreibt die Welt. Gibt Zähler für weiter und Schritt zurück. */
const taktLaufen = (o = {}) => {
  const z = { weiter: 0, schritt: 0, beendet: 0, uebersprungen: new Map() }
  const welt = {
    selbstAn: true,
    DURCHLAUF: { laeuft: false },
    location: { pathname: '/browse' },
    zuletztGeoeffnet: { id: '540533', zeit: 1000, durchgang: true },
    offeneTitel: { 540533: { titel: 'GitS' } },
    ...o,
  }
  const f = new Function(
    'selbstAn', 'DURCHLAUF', 'location', 'zuletztGeoeffnet', 'offeneTitel', 'akNetflixUmgeleitet', 'Date', 'spur', 'selbstUebersprungen', 'selbstWeiter', 'selbstStartenSchritt', 'laufBeenden',
    `${funktionText('async function vielleichtSelbstStarten()')}\nreturn vielleichtSelbstStarten()`,
  )
  return f(
    welt.selbstAn, welt.DURCHLAUF, welt.location, welt.zuletztGeoeffnet, welt.offeneTitel, akNetflixUmgeleitet, jetzt(6000), () => {}, z.uebersprungen,
    () => z.weiter++, async () => { z.schritt++ }, () => z.beendet++,
  ).then(() => z)
}
(async () => {
  let z = await taktLaufen()
  pruefe('Takt auf /browse nach dem Sprung: selbstWeiter einmal, kein Schritt, Titel übersprungen', z.weiter === 1 && z.schritt === 0 && z.uebersprungen.has('540533'), z)
  z = await taktLaufen({ selbstAn: false })
  pruefe('Takt: Durchgang aus -> kein Weiter, der Schritt läuft', z.weiter === 0 && z.schritt === 1, z)
  z = await taktLaufen({ DURCHLAUF: { laeuft: true } })
  pruefe('Takt: Durchlauf läuft -> kein Weiter', z.weiter === 0 && z.schritt === 1, z)
  z = await taktLaufen({ location: { pathname: '/title/540533' } })
  pruefe('Takt: auf der Titelseite -> kein Weiter', z.weiter === 0 && z.schritt === 1, z)
  z = await taktLaufen({ offeneTitel: {} })
  pruefe('Takt: Titel nicht auf der Liste -> kein Weiter', z.weiter === 0 && z.schritt === 1, z)
  z = await taktLaufen({ zuletztGeoeffnet: { id: '540533', zeit: 1000 } })
  pruefe('Takt: Ziel ohne durchgang -> kein Weiter', z.weiter === 0 && z.schritt === 1, z)
  /* Speicher-Round-Trip: was selbstWeiter schreibt, liest der Takt nach einem vollen Neuladen. */
  const w = weiterLaufen()
  const ausSpeicher = JSON.parse(JSON.stringify(w.speicher.zuletztGeoeffnet))
  z = await taktLaufen({ zuletztGeoeffnet: { ...ausSpeicher, zeit: 1000 }, offeneTitel: { 77: { titel: 'Probe' } } })
  pruefe('Round-Trip: Ziel aus dem Speicher auf /browse -> weiter', z.weiter === 1 && z.schritt === 0, z)

  /* Logzeile: übersprungener Titel heißt "Übersprungen", nur ein echter Abbruch "Abgebrochen". */
  const warnBlock = (() => {
    const von = quelle.indexOf('  if (DURCHLAUF.stoerung) {\n    /*\n      Dieselbe Trennung')
    return quelle.slice(von, quelle.indexOf('\n  }\n', von) + 5)
  })()
  const zeile = (code) => {
    const D = { selbst: true, stoerung: null, abbruch: false, titelSperre: undefined }
    akNetflixStoerung(D, code, { reihe: 1, ziel: 5, folge: 1, vorfall() {} })
    const logs = []
    const ende = quelle.slice(quelle.indexOf('  if (DURCHLAUF.selbst && selbstAn && akNetflixTitelUeberspringen('), quelle.indexOf('\n  }\n', quelle.indexOf('laufBeenden(DURCHLAUF.abbruch')) + 5)
    new Function('akNetflixTitelUeberspringen', 'DURCHLAUF', 'selbstAn', 'selbstUebersprungen', 'selbstWeiter', 'laufBeenden', 'globalThis', ende)(akNetflixTitelUeberspringen, D, true, new Map(), () => {}, () => {}, {})
    new Function('DURCHLAUF', 'console', warnBlock)(D, { warn: (t) => logs.push(t) })
    return logs.join(' ')
  }
  const e103 = zeile('E103')
  pruefe('übersprungener Titel (E103): Logzeile sagt Übersprungen, nicht Abgebrochen', /Übersprungen — Netflix meldet E103/.test(e103) && !/Abgebrochen/.test(e103), e103)
  const m7 = zeile('M7355')
  pruefe('M7355: Logzeile sagt weiter Abgebrochen', /Abgebrochen — Netflix meldet M7355/.test(m7) && !/Übersprungen/.test(m7), m7)

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum gesperrten Titel halten.')
})()
