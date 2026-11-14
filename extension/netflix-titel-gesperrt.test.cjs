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
vm.runInContext(lies('netflix-durchgang-steuerung.js'), kontext)
vm.runInContext(lies('netflix-bericht.js'), kontext)
const { akNetflixStoerung, akNetflixTitelUeberspringen, akNetflixUmgeleitet, akNetflixSelbstTakt, akNetflixBremseOeffnen, akNetflixBrowseAuftrag } = kontext

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
pruefe('Sprung vor 1499 ms: noch warten', lauf({ jetzt: 1000 + 1499 }).r === false)
pruefe('Sprung vor genau 1500 ms: weiter', lauf({ jetzt: 1000 + 1500 }).r === true)
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
  const ausfuehren = new Function('akNetflixTitelUeberspringen', 'DURCHLAUF', 'selbstAn', 'selbstUebersprungen', 'selbstWeiter', 'laufBeenden', 'globalThis', 'bremse', 'Date', block)
  for (const [name, sperre, abbruch, weiterErwartet, beendetErwartet] of [
    ['Titelsperre: weiter, Durchgang bleibt', { code: 'E103', reihe: '5' }, true, 1, 0],
    ['Abbruch ohne Sperre (M7…, Escape): Durchgang endet', null, true, 0, 1],
  ]) {
    let weiter = 0
    let beendet = 0
    ausfuehren(akNetflixTitelUeberspringen, { selbst: true, titelSperre: sperre, abbruch, stoerung: null }, true, new Map(), () => weiter++, () => beendet++, {}, null, { now: () => 4242 })
    pruefe(name, weiter === weiterErwartet && beendet === beendetErwartet, { weiter, beendet })
  }
  {
    const gerufen = []
    ausfuehren(akNetflixTitelUeberspringen, { selbst: true, titelSperre: { code: 'UI3012', reihe: '7' }, abbruch: true, stoerung: null }, true, new Map(), () => {}, () => {}, {}, { stoerung: (...a) => gerufen.push(a) }, { now: () => 4242 })
    pruefe('Endstelle: UI3012 geht mit Kennung, Grund und Uhrzeit an die Bremse', JSON.stringify(gerufen) === JSON.stringify([['7', 'Netflix zeigt ihn nicht (UI3012)', 4242]]), gerufen)
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
const weiterLaufen = (o = {}) => {
  const speicher = {}
  const welt = { gegangen: [], speicher, merker: null, beendet: [], begonnen: [], gezaehlt: null, zaehler: [] }
  const f = new Function(
    'offeneTitel', 'akDurchgangSchutz', 'laufBeenden', 'naechsterAuftrag', 'speicherSchreiben', 'gehe', 'console', 'Date', 'LAUF_SCHLUESSEL', 'LAUF_HOECHSTENS_MS', 'ergebnis', 'bremse', 'meinTab', 'titelBericht', 'start', 'frei', 'akNetflixZaehlerSetze', 'akNetflixBericht', 'fertig',
    `let selbstGezaehlt = start, selbstGrenze = null, zuletztGeoeffnet = null
${funktionText('function selbstWeiter(frei = 0)')}
selbstWeiter(frei)
ergebnis.merker = zuletztGeoeffnet
ergebnis.gezaehlt = selbstGezaehlt
ergebnis.grenze = selbstGrenze`,
  )
  f(
    o.titel ?? { 77: { titel: 'Probe' } }, () => null, (g) => welt.beendet.push(g), () => (o.naechster === undefined ? 77 : o.naechster),
    async (werte) => { Object.assign(speicher, JSON.parse(JSON.stringify(werte))) },
    (adresse) => welt.gegangen.push(adresse), { log() {} }, jetzt(1000), 'k', 1, welt,
    o.bremse ?? { pause: () => null, offen: () => 0 }, 'tab-1', { beginn: (r, z) => welt.begonnen.push([r, z]) }, o.start ?? 0, o.frei, (g, n) => welt.zaehler.push([g, n]), kontext.akNetflixBericht, (id) => (o.erledigt ?? []).includes(id),
  )
  return welt
}
{
  /* Bericht 14.11.2026: Nenner 233 (alle Titel der Prüfliste) statt 163 (offen). `selbstWeiter` setzt ihn beim ersten Sprung nach einem Neuladen ohne Speicher. */
  const w = weiterLaufen({ titel: { 77: {}, 78: {}, 79: {}, 80: {} }, erledigt: ['78', '80'] })
  pruefe('selbstWeiter: der Nenner zählt nur offene Titel (4 in der Prüfliste, 2 fertig → 2)', w.gezaehlt === 1 && JSON.stringify(w.zaehler) === '[[1,2]]', w.zaehler)
}
{
  const w = weiterLaufen()
  pruefe('selbstWeiter springt zum nächsten Titel', w.gegangen.join() === '/title/77', w.gegangen)
  pruefe('selbstWeiter: der Merker im Speicher trägt durchgang (überlebt ein volles Neuladen)', w.speicher.zuletztGeoeffnet?.durchgang === true && w.speicher.zuletztGeoeffnet.id === '77' && w.speicher.zuletztGeoeffnet.zeit === 1000 && w.speicher.zuletztGeoeffnet.tab === 'tab-1', w.speicher)
  pruefe('selbstWeiter: Merker im Skript und im Speicher sind gleich', JSON.stringify(w.merker) === JSON.stringify(w.speicher.zuletztGeoeffnet), [w.merker, w.speicher])
}
{
  const w = weiterLaufen()
  pruefe('selbstWeiter: der Sprung trägt den Tab (Melde-Knopf anderer Tabs ignoriert ihn)', w.speicher.zuletztGeoeffnet?.tab === 'tab-1' && w.merker.tab === 'tab-1', w.speicher)
  pruefe('selbstWeiter: der Titelbericht beginnt mit Kennung und Sprungzeit', JSON.stringify(w.begonnen) === '[[77,1000]]', w.begonnen)
  const p = weiterLaufen({ bremse: { pause: () => 99999, offen: () => 3 } })
  pruefe('selbstWeiter in der Pause: kein Sprung, kein Zählen, nichts beendet', p.gegangen.length === 0 && p.gezaehlt === 0 && p.beendet.length === 0 && p.begonnen.length === 0, p)
  pruefe('selbstWeiter ohne Pause zählt den Sprung', weiterLaufen({ start: 5 }).gezaehlt === 6)
  pruefe('selbstWeiter(frei=2): die freigegebenen Sprünge zählen nicht mehr', weiterLaufen({ start: 5, frei: 2 }).gezaehlt === 4)
  pruefe('selbstWeiter(frei=9) fällt nicht unter 0', weiterLaufen({ start: 5, frei: 9 }).gezaehlt === 1)
  const e = weiterLaufen({ naechster: null, bremse: { pause: () => null, offen: () => 2 } })
  pruefe('nichts mehr dran, aber 2 Titel in der Bremse: Ende mit eigenem Grund, offen gelassen', e.gegangen.length === 0 && e.beendet.length === 1 && /Netflix zeigte 2 Titel ohne Inhalt/.test(e.beendet[0]), e.beendet)
  const f = weiterLaufen({ naechster: null })
  pruefe('nichts mehr dran, Bremse leer: wie bisher „kein offener Auftrag mehr"', f.beendet.length === 1 && f.beendet[0] === 'kein offener Auftrag mehr', f.beendet)
}
/* `naechsterAuftrag` überspringt, was die Bremse für diesen Lauf ausgeschlossen hat. */
{
  const eintrag = { staffeln: [{ offen: true }] }
  const lauf = (ausgeschlossen) =>
    new Function('gemeinteReihe', 'offeneTitel', 'selbstUebersprungen', 'bremse', 'istErledigt', 'fertig', `${funktionText('function naechsterAuftrag()')}\nreturn naechsterAuftrag()`)(
      () => '0', { 1: eintrag, 2: eintrag, 3: eintrag }, new Map(), { ausgeschlossen: (r) => ausgeschlossen.includes(r) }, () => false, () => false,
    )
  pruefe('naechsterAuftrag: ohne Ausschluss der erste Titel', lauf([]) === '1')
  pruefe('naechsterAuftrag: ausgeschlossene Titel werden übersprungen', lauf(['1', '2']) === '3' && lauf(['1']) === '2')
  pruefe('naechsterAuftrag: alle ausgeschlossen → null', lauf(['1', '2', '3']) === null)
}
/* `laufBeenden` räumt Bremse, Pausenzeile und Besitz ab — den Besitz nur, wenn er diesem Tab gehört. */
{
  const beenden = (besitzer) => {
    const z = { reset: 0, gezeigt: [], besitz: [] }
    const welt = { selbstAn: true, bremse: { zuruecksetzen: () => z.reset++ }, taktTun: { aufraeumen: () => z.gezeigt.push(null), schreiben: (b) => z.besitz.push(b) }, durchgangBesitzer: besitzer, meinTab: 'a' }
    new Function(
      'selbstAn', 'bremse', 'taktTun', 'durchgangBesitzer', 'meinTab', 'DURCHLAUF', 'durchlaufKnopfZeigen', 'sessionStorage', 'LAUF_SCHLUESSEL', 'console', 'akNetflixEnde', 'selbstUebersprungen', 'fertigeTitel', 'selbstGezaehlt', 'offeneTitel', 'vorfallMelden', 'durchgangEndeZeigen',
      `let durchgangEnde = null\n${funktionText('function laufBeenden(grund)')}\nlaufBeenden('von Hand')`,
    )(welt.selbstAn, welt.bremse, welt.taktTun, welt.durchgangBesitzer, 'a', {}, () => {}, { removeItem() {} }, 'k', { log() {} }, () => ({}), new Map(), new Set(), 0, {}, () => {}, () => {})
    return z
  }
  let z = beenden({ tab: 'a', puls: 1 })
  pruefe('laufBeenden: Bremse zurückgesetzt, Pausenzeile weg, eigener Besitz freigegeben', z.reset === 1 && z.gezeigt.length === 1 && z.gezeigt[0] === null && JSON.stringify(z.besitz) === '[null]', z)
  z = beenden({ tab: 'b', puls: 1 })
  pruefe('laufBeenden: fremden Besitz nicht anfassen', z.reset === 1 && z.besitz.length === 0, z)
  z = beenden(null)
  pruefe('laufBeenden ohne Besitzer: nichts zu lösen', z.besitz.length === 0)
}
/* `laufStarten` beginnt mit frischer Bremse (sessionStorage überlebt einen wiederhergestellten Tab). */
{
  /* `fertig`: Kennungen, die die Prüfliste nicht mehr offen zeigt (wie `fertig()` in melder.js); der Nenner zählt nur die offenen. */
  const starten = (offeneTitel, erledigt = [], eigene = {}) => {
    let reset = 0
    const gemerkt = []
    const ok = new Function(
      'titelDerAdresse', 'gemeinteReihe', 'offeneTitel', 'naechsterAuftrag', 'bremse', 'selbstUebersprungen', 'selbstStaffelnGeprueft', 'selbstGesammelt', 'selbstVersuche', 'fertigeTitel', 'durchgangEndeZeigen', 'sessionStorage', 'LAUF_SCHLUESSEL', 'Date', 'dialogSchliessen', 'vielleichtSelbstStarten', 'selbstWeiter', 'akNetflixZaehlerSetze', 'akNetflixBericht', 'fertig',
      `let selbstAn = false, selbstGezaehlt = 9, selbstGrenze = null, selbstVersucht = 'x', selbstSammelStand = 1, durchgangEnde = 1\n${funktionText('function laufStarten()')}\nreturn laufStarten() && selbstAn && selbstGezaehlt === 0`,
    )(() => null, () => null, offeneTitel, () => '1', { zuruecksetzen: () => reset++ }, eigene.uebersprungen ?? { clear() {} }, { clear() {} }, { clear() {} }, { clear() {} }, eigene.fertig ?? { clear() {} }, () => {}, { setItem() {} }, 'k', jetzt(1000), () => {}, () => {}, () => {}, (g, n) => gemerkt.push([g, n]), kontext.akNetflixBericht, (id) => erledigt.includes(id))
    return { ok, reset, gemerkt }
  }
  let s = starten({ 1: {}, 2: {}, 3: {} })
  pruefe('laufStarten: Start gelingt und die Bremse beginnt frisch', s.ok === true && s.reset === 1, s)
  pruefe('laufStarten merkt Zähler 0 und Nenner (3 offene Titel) im Speicher: Neuladen vor dem ersten Sprung behält den Nenner, ein Rest eines alten Laufs wird überschrieben', JSON.stringify(s.gemerkt) === '[[0,3]]', s.gemerkt)
  /* Ein nicht sauber beendeter Lauf (Tab-Absturz, Frist) lässt seinen Stand im sessionStorage; der Start räumt ihn über die echte laufStarten-Zeile (Prüfer 3841 R2, A1). */
  {
    const sitzung = new Map([['ak-netflix-fertig', '["1"]'], ['ak-netflix-uebersprungen', '[["2","keine Folgenliste in 20 s"]]']])
    const ss = { getItem: (k) => (sitzung.has(k) ? sitzung.get(k) : null), setItem: (k, w) => void sitzung.set(k, String(w)), removeItem: (k) => void sitzung.delete(k) }
    const fertig = kontext.akNetflixFertigSet(ss)
    const Karte = kontext.akNetflixLaufMap(ss, 'ak-netflix-uebersprungen')
    const karte = new Karte()
    const vorher = [fertig.size, karte.size]
    starten({ 1: {} }, [], { fertig, uebersprungen: karte })
    pruefe('laufStarten räumt den Stand eines nicht beendeten Laufs: Set, Merkliste und beide Schlüssel leer', vorher.join() === '1,1' && fertig.size === 0 && karte.size === 0 && !sitzung.has('ak-netflix-fertig') && !sitzung.has('ak-netflix-uebersprungen'), [vorher, fertig.size, karte.size, [...sitzung.keys()]])
  }
  /* Bericht 14.11.2026: „13 von 233 geprüft", die Liste hatte 163 offene — der Nenner zählte alle Titel der Prüfliste statt der offenen. */
  s = starten({ 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }, ['2', '4'])
  pruefe('laufStarten: der Nenner zählt nur die offenen Titel (5 in der Prüfliste, 2 fertig → 3)', JSON.stringify(s.gemerkt) === '[[0,3]]', s.gemerkt)
}
/* `selbstStartenSchritt` gibt der Listenwarte die Bremse und meldet ihr einen Erfolg, sobald die Folgenliste da ist. */
const schrittLaufen = async (durchlauf) => {
  const z = { bremseOk: 0, tun: null, ort: null }
  const args = [true, durchlauf, { pathname: '/title/5' }, () => '5', { 5: {} }, () => '5', () => false, 20000, { ok: () => z.bremseOk++ }, (w, o, tun) => { z.tun = tun; z.ort = o; return w }, () => {}, new Map(), () => {}, { seitenmerkmale: () => ({}) }, {}, {}, jetzt(1000), { versucht: () => false }]
  const f = new Function(
    'selbstAn', 'DURCHLAUF', 'location', 'gemeinteReihe', 'offeneTitel', 'titelDerAdresse', 'keineFolgeVorhanden', 'SELBST_LISTE_WARTEN', 'bremse', 'akNetflixListeWarten', 'spur', 'selbstUebersprungen', 'selbstWeiter', 'akNetflixBericht', 'document', 'history', 'Date', 'vollLaden',
    `let selbstVersucht = null, selbstWartet = null\n${funktionText('async function selbstStartenSchritt()')}\nreturn selbstStartenSchritt()`,
  )
  try {
    await f(...args)
  } catch {
    /* Hinter der Listenprüfung fehlen der Attrappe die Staffel-Helfer; es zählt, was davor geschah. */
  }
  return z
}
/* `browseWegKnopf`: ein Sprung des Durchgangs bekommt nie den „nicht bei Netflix"-Knopf (Bericht 12.11., Grimgar im neuen Tab). */
{
  const knopfFuer = (z) => {
    const erzeugt = []
    const el = () => ({ dataset: {}, classList: { add() {} }, remove() {}, appendChild() {} })
    const r = new Function(
      'location', 'zuletztGeoeffnet', 'offeneTitel', 'akNetflixBrowseAuftrag', 'Date', 'document', 'netflixKasten', 'totMelden', 'knopfEntfernen',
      `let knopf = null\n${funktionText('function browseWegKnopf()')}\nreturn browseWegKnopf()`,
    )({ pathname: '/browse' }, z, { 80020759: { titel: 'Grimgar' } }, akNetflixBrowseAuftrag, jetzt(5000), { createElement: () => { const e = el(); erzeugt.push(e); return e } }, () => ({ querySelector: () => el() }), async () => ({ ok: true }), () => {})
    return { r, erzeugt: erzeugt.length }
  }
  const stand = knopfFuer({ id: '80020759', zeit: 4000, durchgang: true, tab: 'a' })
  pruefe('Sprung des Durchgangs auf /browse: kein Knopf, nichts gebaut', stand.r === false && stand.erzeugt === 0, stand)
  const klick = knopfFuer({ id: '80020759', zeit: 4000 })
  pruefe('Klick aus der Liste auf /browse: Knopf wie bisher', klick.r === true && klick.erzeugt === 1, klick)
}
/** `vielleichtSelbstStarten`; `o` überschreibt die Welt. Gibt Zähler für weiter und Schritt zurück. */
const taktLaufen = (o = {}) => {
  const z = { weiter: 0, schritt: 0, beendet: 0, uebersprungen: new Map(), besitz: [], gesehen: 0, gezeigt: [], frei: [] }
  z.tun = { schreiben: (b) => z.besitz.push(b), beenden: () => z.beendet++, sehen: () => z.gesehen++, zeigen: (t) => z.gezeigt.push(t), weiter: (f) => z.frei.push(f) }
  const welt = {
    selbstAn: true,
    DURCHLAUF: { laeuft: false },
    location: { pathname: '/browse' },
    zuletztGeoeffnet: { id: '540533', zeit: 1000, durchgang: true },
    durchgangBesitzer: null,
    bremse: akNetflixBremseOeffnen(new Map(), undefined, null),
    offeneTitel: { 540533: { titel: 'GitS' } },
    ...o,
  }
  const f = new Function(
    'selbstAn', 'DURCHLAUF', 'location', 'zuletztGeoeffnet', 'offeneTitel', 'akNetflixUmgeleitet', 'Date', 'spur', 'selbstUebersprungen', 'selbstWeiter', 'selbstStartenSchritt', 'laufBeenden', 'akNetflixSelbstTakt', 'durchgangBesitzer', 'meinTab', 'bremse', 'taktTun',
    `${funktionText('async function vielleichtSelbstStarten()')}\nreturn vielleichtSelbstStarten()`,
  )
  return f(
    welt.selbstAn, welt.DURCHLAUF, welt.location, welt.zuletztGeoeffnet, welt.offeneTitel, akNetflixUmgeleitet, jetzt(6000), () => {}, z.uebersprungen,
    () => z.weiter++, async () => { z.schritt++ }, () => z.beendet++,
    akNetflixSelbstTakt, welt.durchgangBesitzer, 'tab-1', welt.bremse, z.tun,
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

  /* Bremse im Takt: Pause und fremder Besitzer halten den Durchgang an, bevor irgendein Schritt läuft (Uhr in der Welt: 6000). */
  const pausiert = akNetflixBremseOeffnen(new Map(), undefined, null)
  for (const r of ['1', '2', '3']) pausiert.stoerung(r, 'x', 6000)
  z = await taktLaufen({ bremse: pausiert, location: { pathname: '/title/540533' } })
  pruefe('Takt in der Pause: kein Schritt, kein Weiter, Pausentext im Kasten', z.schritt === 0 && z.weiter === 0 && z.gezeigt.length === 1 && /Pause bis/.test(z.gezeigt[0]), z)
  const vorbei = akNetflixBremseOeffnen(new Map(), undefined, null)
  for (const r of ['1', '2', '3']) vorbei.stoerung(r, 'x', 6000 - 10 * 60 * 1000)
  z = await taktLaufen({ bremse: vorbei, location: { pathname: '/title/540533' } })
  pruefe('Takt am Pausenende: weiter(3) und kein Schritt in diesem Takt', z.schritt === 0 && JSON.stringify(z.frei) === '[3]' && z.gezeigt[0] === null, z)
  z = await taktLaufen({ durchgangBesitzer: { tab: 'anderer', puls: 5000 }, location: { pathname: '/title/540533' } })
  pruefe('Takt mit lebendem fremdem Besitzer: Durchgang endet, kein Schritt', z.beendet === 1 && z.schritt === 0 && z.besitz.length === 0, z)
  z = await taktLaufen({ durchgangBesitzer: { tab: 'anderer', puls: 6000 - 90000 }, location: { pathname: '/title/540533' } })
  pruefe('Takt mit totem fremdem Besitzer (Tab zu): übernommen, Schritt läuft', z.beendet === 0 && z.schritt === 1 && JSON.stringify(z.besitz) === '[{"tab":"tab-1","puls":6000}]' && z.gesehen === 1, z)

  /* Schritt: Verdrahtung der Listenwarte und des Erfolgs. */
  z = await schrittLaufen({ laeuft: false, folgen: [], listeFuer: null })
  pruefe('Schritt ohne Folgenliste: die Listenwarte bekommt die Bremse, kein Erfolg', z.tun?.bremse !== undefined && typeof z.tun.bremse.ok === 'function' && z.tun.vollLaden?.versucht !== undefined && z.bremseOk === 0, z)
  z = await schrittLaufen({ laeuft: false, folgen: [{ videoId: 1, nummer: 1 }], listeFuer: '5' })
  pruefe('Schritt mit Folgenliste dieser Seite: die Bremse meldet Erfolg genau einmal', z.bremseOk === 1 && z.tun === null, z)
  z = await schrittLaufen({ laeuft: false, folgen: [{ videoId: 1, nummer: 1 }], listeFuer: '4' })
  pruefe('Schritt mit Folgenliste eines anderen Titels: kein Erfolg', z.bremseOk === 0, z)

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
    new Function('akNetflixTitelUeberspringen', 'DURCHLAUF', 'selbstAn', 'selbstUebersprungen', 'selbstWeiter', 'laufBeenden', 'globalThis', 'bremse', ende)(akNetflixTitelUeberspringen, D, true, new Map(), () => {}, () => {}, {}, null)
    new Function('DURCHLAUF', 'console', warnBlock)(D, { warn: (t) => logs.push(t) })
    return logs.join(' ')
  }
  const e103 = zeile('E103')
  pruefe('übersprungener Titel (E103): Logzeile sagt Übersprungen, nicht Abgebrochen', /Übersprungen — Netflix meldet E103/.test(e103) && !/Abgebrochen/.test(e103), e103)
  const m7 = zeile('M7355')
  pruefe('M7355: Logzeile sagt weiter Abgebrochen', /Abgebrochen — Netflix meldet M7355/.test(m7) && !/Übersprungen/.test(m7), m7)

  {
    /* Derselbe Durchlauf-Zustand erst mit übersprungenem Titel, dann mit M7: kein alter Merker. */
    const D = { selbst: true }
    akNetflixStoerung(D, 'E103', { reihe: 1, ziel: 5, folge: 1, vorfall() {} })
    akNetflixTitelUeberspringen(D, new Map(), () => {})
    akNetflixStoerung(D, 'M7355', { reihe: 1, ziel: 6, folge: 1, vorfall() {} })
    pruefe('M7 nach einem übersprungenen Titel: Merker zurückgesetzt', D.titelUebersprungen === false, D)
  }

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum gesperrten Titel halten.')
})()
