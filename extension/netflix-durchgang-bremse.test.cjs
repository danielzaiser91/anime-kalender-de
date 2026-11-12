/**
 * Netflix-Durchgang: Bremse, Tab-Besitz, Melde-Knopf und Bericht (12.11.2026).
 *
 * Anlass: Bericht `anime-kalender-netflix-2026-11-12T12-00-32` (4.32.107). Ab 11:57 zeigte jede Titelseite
 * „Startseite – Netflix" mit `previewModal--backDrop` ohne Inhalt, dazu `/watch` mit UI3012; der Durchgang
 * buchte 20 Titel als übersprungen. Die Fixtures unten (`BERICHT_LEER`, `BERICHT_YAKARI`) sind die Merkmale
 * aus diesem Bericht, wörtlich.
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
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const lies = (datei) => readFileSync(resolve(__dirname, datei), 'utf8')

console.log('Netflix: Bremse, Besitz, Bericht')
const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-erinnern.js'), kontext)
vm.runInContext(lies('netflix-durchgang-steuerung.js'), kontext)
const k = kontext

/* Aus dem Bericht vom 12.11.2026: Seite 70155614 (Beyblade) und Yakari (70234488). */
const BERICHT_LEER = { pfad: '/title/70155614', suche: '', titel: 'Startseite – Netflix', verlauf: 23, textZeichen: 910, folgenElemente: 0, dialoge: { anzahl: 0, anfang: null }, erinnern: { anzahl: 0, ketten: [] } }
const BERICHT_YAKARI = { ...BERICHT_LEER, pfad: '/title/70234488', titel: 'Yakari – Netflix', textZeichen: 6777 }

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 10, 12, 12, 0, 0)

/* --- Fenster ohne Inhalt erkennen --- */
pruefe('Titelfenster leer: Startseite auf /title, keine Folgen, kein Dialog', k.akNetflixTitelfensterLeer(BERICHT_LEER) === true)
pruefe('Yakari (echter Titel-Tab, 6777 Zeichen) ist nicht leer', k.akNetflixTitelfensterLeer(BERICHT_YAKARI) === false)
pruefe('englisch „Home – Netflix" ist auch leer', k.akNetflixTitelfensterLeer({ ...BERICHT_LEER, titel: 'Home – Netflix' }) === true)
pruefe('Startseite auf /browse ist kein Titelfenster-Fehler', k.akNetflixTitelfensterLeer({ ...BERICHT_LEER, pfad: '/browse' }) === false)
pruefe('mit Folgen-Elementen nicht leer', k.akNetflixTitelfensterLeer({ ...BERICHT_LEER, folgenElemente: 1 }) === false)
pruefe('mit Dialog nicht leer', k.akNetflixTitelfensterLeer({ ...BERICHT_LEER, dialoge: { anzahl: 1 } }) === false)
pruefe('Merkmale mit Fehler zählen nicht', k.akNetflixTitelfensterLeer({ ...BERICHT_LEER, fehler: 'x' }) === false)
pruefe('ohne Merkmale nicht leer', k.akNetflixTitelfensterLeer(undefined) === false)
pruefe('Pfad mit Sprache (/de-de/title/…) gilt', k.akNetflixTitelfensterLeer({ ...BERICHT_LEER, pfad: '/de-de/title/1' }) === true)

/* --- Stand der Bremse --- */
{
  let z = k.akNetflixBremseNeu()
  z = k.akNetflixBremseStoerung(z, '1', 'a', T0)
  z = k.akNetflixBremseStoerung(z, '2', 'b', T0)
  pruefe('zwei Fehlschläge: noch keine Pause', z.bis === null && z.folge === 2, z)
  z = k.akNetflixBremseStoerung(z, '3', 'c', T0)
  pruefe('der dritte in Folge: Pause 10 Minuten', z.bis === T0 + 10 * MIN && z.pausen === 1 && z.folge === 0, z)
  pruefe('… die drei Titel bleiben vermerkt (nicht übersprungen)', gleich(Object.keys(z.titel), ['1', '2', '3']), z.titel)
  const stufen = [20, 40, 60, 60]
  for (const min of stufen) {
    z = { ...z, bis: null, titel: {} }
    for (const r of ['a', 'b', 'c']) z = k.akNetflixBremseStoerung(z, r, 'x', T0)
    pruefe(`weitere Pause: ${min} Minuten`, z.bis === T0 + min * MIN, z)
  }
}
{
  const r = k.akNetflixBremseOk({ folge: 2, pausen: 1, bis: null, titel: { 5: 'g5', 6: 'g6' } })
  pruefe('Erfolg: Einzelfälle werden gebucht, Stand frisch', gleich(r.gebucht, [['5', 'g5'], ['6', 'g6']]) && gleich(r.z, k.akNetflixBremseNeu()), r)
  pruefe('Pause genau am Ende: vorbei', k.akNetflixBremseEnde({ folge: 0, pausen: 1, bis: T0, titel: { a: 1, b: 2 } }, T0)?.frei === 2)
  pruefe('eine Millisekunde vorher: läuft', k.akNetflixBremseEnde({ folge: 0, pausen: 1, bis: T0, titel: { a: 1 } }, T0 - 1) === null)
  pruefe('ohne Pause: nichts zu beenden', k.akNetflixBremseEnde({ folge: 2, pausen: 0, bis: null, titel: {} }, T0) === null)
}

/* --- Fabrik: Speicher, Buchung, Pause, Text --- */
const speicherNeu = (start) => {
  const d = start ? { 'ak-netflix-bremse': start } : {}
  return { d, getItem: (s) => d[s] ?? null, setItem: (s, w) => { d[s] = String(w) } }
}
{
  const gebucht = new Map()
  const beobachtet = []
  const sp = speicherNeu()
  const b = k.akNetflixBremseOeffnen(gebucht, (r, g, z) => beobachtet.push([r, g, z.folge]), sp)
  pruefe('Fehlschlag eins und zwei: keine Pause, nichts gebucht', b.stoerung('1', 'g1', T0) === false && b.stoerung('2', 'g2', T0) === false && gebucht.size === 0)
  pruefe('… beide sind für diesen Lauf ausgeschlossen', b.ausgeschlossen('1') && b.ausgeschlossen(2) && !b.ausgeschlossen('3') && b.offen() === 2)
  pruefe('Beobachter bekommt Kennung, Grund, Stand', gleich(beobachtet, [['1', 'g1', 1], ['2', 'g2', 2]]), beobachtet)
  /* Ein Neuladen (neue Fabrik, gleicher Speicher) behält den Stand. */
  const b2 = k.akNetflixBremseOeffnen(gebucht, undefined, sp)
  pruefe('Neuladen: Stand bleibt', b2.offen() === 2 && b2.bericht().folge === 2, b2.bericht())
  b2.ok()
  pruefe('Erfolg nach zwei Fehlschlägen: beide als übersprungen gebucht (lag am Titel)', gleich([...gebucht], [['1', 'g1'], ['2', 'g2']]), [...gebucht])
  pruefe('… und der Stand ist wieder leer', b2.offen() === 0 && b2.bericht().folge === 0)
  const vorher = sp.d['ak-netflix-bremse']
  b2.ok()
  pruefe('Erfolg ohne Fehlschläge schreibt nichts', sp.d['ak-netflix-bremse'] === vorher && gebucht.size === 2)
  const b3 = k.akNetflixBremseOeffnen(new Map(), undefined, sp)
  pruefe('Neuladen nach dem Erfolg: der Stand ist gespeichert leer', b3.offen() === 0 && b3.bericht().folge === 0 && b3.bericht().bis === null, b3.bericht())
  let schreibungen = 0
  const zaehlend = { getItem: sp.getItem, setItem: () => schreibungen++ }
  k.akNetflixBremseOeffnen(new Map(), undefined, zaehlend).ok()
  pruefe('Erfolg ohne Fehlschläge: kein Schreibzugriff', schreibungen === 0)
  const ohneBis = k.akNetflixBremseOeffnen(new Map(), undefined, speicherNeu('{"folge":1,"pausen":0,"titel":{}}'))
  pruefe('Gespeicherter Stand ohne bis: bis ist null (nicht undefined)', ohneBis.bericht().bis === null && ohneBis.bericht().folge === 1)
}
{
  const gebucht = new Map()
  const b = k.akNetflixBremseOeffnen(gebucht, undefined, speicherNeu())
  b.stoerung('1', 'x', T0)
  b.stoerung('2', 'x', T0)
  pruefe('der dritte löst die Pause aus (Rückgabe true)', b.stoerung('3', 'x', T0) === true)
  pruefe('Pause läuft bis T0+10 min', b.pause(T0 + 10 * MIN - 1) === T0 + 10 * MIN && b.pause(T0 + 10 * MIN) === null)
  pruefe('Pausentext: Uhrzeit Berlin und Zahl der Titel', b.text(T0) === 'Netflix bremst — Pause bis 13:10 Uhr, 3 Titel kommen danach wieder dran', b.text(T0))
  pruefe('ohne Pause kein Text', b.text(T0 + 10 * MIN) === null)
  pruefe('während der Pause: nichts gebucht', gebucht.size === 0)
  pruefe('Pausenende: 3 Titel frei, danach nicht mehr ausgeschlossen', b.ende(T0 + 10 * MIN) === 3 && !b.ausgeschlossen('1') && b.ende(T0 + 10 * MIN) === null)
  b.stoerung('4', 'x', T0)
  b.zuruecksetzen()
  pruefe('zurücksetzen leert alles', b.offen() === 0 && b.bericht().pausen === 0 && b.bericht().folge === 0)
}
for (const [name, inhalt] of [['kaputtes JSON', '{{'], ['falsche Form', '{"folge":"x"}'], ['null', 'null'], ['Titel kein Objekt', '{"folge":1,"pausen":0,"titel":5}']]) {
  const b = k.akNetflixBremseOeffnen(new Map(), undefined, speicherNeu(inhalt))
  pruefe(`Speicher mit ${name}: frischer Stand, kein Absturz`, b.offen() === 0 && b.bericht().folge === 0)
}
{
  const b = k.akNetflixBremseOeffnen(new Map(), undefined, null)
  b.stoerung('1', 'x', T0)
  pruefe('ohne Speicher arbeitet die Bremse im Arbeitsspeicher', b.offen() === 1)
  const werfend = { getItem: () => null, setItem: () => { throw new Error('voll') } }
  const c = k.akNetflixBremseOeffnen(new Map(), undefined, werfend)
  pruefe('Speicher wirft beim Schreiben: kein Absturz', c.stoerung('1', 'x', T0) === false)
}

/* --- Pause im Takt --- */
{
  const gebucht = new Map()
  const b = k.akNetflixBremseOeffnen(gebucht, undefined, speicherNeu())
  for (const r of ['1', '2', '3']) b.stoerung(r, 'x', T0)
  const tun = { gezeigt: [], frei: [] }
  tun.zeigen = (t) => tun.gezeigt.push(t)
  tun.weiter = (f) => tun.frei.push(f)
  pruefe('Takt in der Pause: ruht, zeigt den Text', k.akNetflixBremseTakt(b, T0 + MIN, tun) === true && tun.gezeigt.length === 1 && /Pause bis 13:10 Uhr/.test(tun.gezeigt[0]) && tun.frei.length === 0, tun)
  pruefe('Takt am Pausenende: Zeile weg, weiter(3) genau einmal, Takt ruht', k.akNetflixBremseTakt(b, T0 + 10 * MIN, tun) === true && tun.gezeigt.at(-1) === null && gleich(tun.frei, [3]), tun)
  pruefe('danach läuft der Takt wieder', k.akNetflixBremseTakt(b, T0 + 10 * MIN + 1000, tun) === false && tun.frei.length === 1, tun)
}

/* --- Liste warten: Bremse statt Überspringen --- */
{
  const lauf = (merkmale, { erinnern = false, dauer = 21000, bremse, netz = () => 0, voll } = {}) => {
    const gebucht = new Map()
    const b = bremse ?? k.akNetflixBremseOeffnen(gebucht, undefined, null)
    const aufrufe = { spur: [], weiter: 0, ok: 0 }
    const ok = b.ok.bind(b)
    b.ok = () => { aufrufe.ok++; ok() }
    const o = { seite: '70155614', reihe: '70155614', erinnern, frist: 20000, jetzt: T0 + dauer, durchlauf: { folgen: [], listeFuer: null }, merkmale: () => merkmale, netz }
    const tun = { spur: (w) => aufrufe.spur.push(w), uebersprungen: gebucht, weiter: () => aufrufe.weiter++, bremse: b }
    aufrufe.geladen = 0
    if (voll !== undefined) tun.vollLaden = { versucht: () => voll, laden: () => aufrufe.geladen++ }
    const rest = k.akNetflixListeWarten({ seite: '70155614', seit: T0 }, o, tun)
    return { gebucht, b, aufrufe, rest }
  }
  let r = lauf(BERICHT_LEER)
  pruefe('leeres Fenster nach der Frist: Störung der Sitzung, nicht übersprungen', r.gebucht.size === 0 && r.b.offen() === 1 && r.aufrufe.weiter === 1 && r.aufrufe.spur[0] === 'Titelfenster ohne Inhalt' && r.aufrufe.ok === 0, r)
  pruefe('… entschieden (kein zweites Zählen auf derselben Seite)', r.rest.entschieden === true)
  r = lauf(BERICHT_LEER, { dauer: 8000 })
  pruefe('leeres Fenster genau an der Leer-Frist (8 s): noch warten', r.aufrufe.weiter === 0 && r.b.offen() === 0)
  r = lauf(BERICHT_LEER, { dauer: 8001 })
  pruefe('leeres Fenster 1 ms danach: Störung der Sitzung, Grund nennt 8 s', r.b.offen() === 1 && r.aufrufe.weiter === 1 && /in 8 s/.test(r.b.bericht().titel['70155614']), r.b.bericht())
  r = lauf(BERICHT_LEER, { dauer: 7900 })
  pruefe('leeres Fenster ohne Netzantwort bei 7,9 s: noch nichts gebucht (Mutant 8000 -> 3000 wird rot)', r.aufrufe.weiter === 0 && r.b.offen() === 0 && r.aufrufe.geladen === 0, r.b.bericht())
  r = lauf(BERICHT_LEER, { dauer: 8001, voll: false })
  pruefe('leeres Fenster ohne Netzantwort nach 8 s: Seite wird voll geladen', r.aufrufe.geladen === 1 && r.b.offen() === 0)
  r = lauf(BERICHT_LEER, { dauer: 7900, voll: true })
  pruefe('Inhalt kommt bei 7,9 s nach vollem Laden: nichts gebucht, kein Weiter', r.aufrufe.weiter === 0 && r.b.offen() === 0 && r.gebucht.size === 0)
  r = lauf(BERICHT_LEER, { dauer: 8001, voll: true, netz: () => 2 })
  pruefe('Netzantwort kam: auch nach 8 s nach vollem Laden nichts gebucht, es bleibt bei der Listenfrist', r.aufrufe.weiter === 0 && r.b.offen() === 0 && r.aufrufe.geladen === 0, r.b.bericht())
  r = lauf(BERICHT_LEER, { dauer: 8001, netz: () => null })
  pruefe('keine Auskunft über das Netz (null): wie eine Antwort, Listenfrist', r.aufrufe.weiter === 0 && r.b.offen() === 0)
  r = lauf(BERICHT_LEER, { dauer: 20001, netz: () => 2, voll: true })
  pruefe('mit Netzantwort nach der Listenfrist: Störung mit „20 s"', r.b.offen() === 1 && /in 20 s/.test(r.b.bericht().titel['70155614']), r.b.bericht())
  r = lauf(BERICHT_YAKARI, { dauer: 8001 })
  pruefe('echter Titel ohne Folgenliste nach 8 s: wartet weiter auf die Liste (Frist 20 s)', r.aufrufe.weiter === 0 && r.gebucht.size === 0 && r.aufrufe.ok === 0)
  r = lauf(BERICHT_LEER, { erinnern: true, dauer: 3000 })
  pruefe('„Erinnern" aus dem Billboard bei leerem Fenster: nach 3 s noch keine Entscheidung', r.aufrufe.weiter === 0 && r.gebucht.size === 0 && r.b.offen() === 0)
  r = lauf(BERICHT_LEER, { erinnern: true, dauer: 8000 })
  pruefe('… genau an der Leer-Frist (8 s) mit „Erinnern": noch warten', r.aufrufe.weiter === 0 && r.gebucht.size === 0 && r.b.offen() === 0)
  r = lauf(BERICHT_LEER, { erinnern: true, dauer: 8001 })
  pruefe('… nach der Leer-Frist zählt es als Störung, nicht als „Erinnern statt Folgenliste"', r.b.offen() === 1 && r.gebucht.size === 0)
  r = lauf(BERICHT_YAKARI)
  pruefe('echter Titel ohne Folgenliste (Yakari): wie bisher übersprungen, Bremse meldet Erfolg', r.gebucht.get('70155614') === 'keine Folgenliste in 20 s' && r.aufrufe.ok === 1 && r.b.offen() === 0, [...r.gebucht])
  r = lauf(BERICHT_YAKARI, { erinnern: true, dauer: 3000 })
  pruefe('echter Titel mit „Erinnern": wie bisher übersprungen', r.gebucht.get('70155614') === 'Erinnern statt Folgenliste' && r.aufrufe.ok === 1)
  /* Kreislauf: zwei Fehlschläge, dann ein echter Titel → die beiden werden mit ihrem Grund gebucht. */
  const gebucht = new Map()
  const b = k.akNetflixBremseOeffnen(gebucht, undefined, null)
  b.stoerung('11', 'Titelfenster ohne Inhalt in 20 s', T0)
  b.stoerung('12', 'Titelfenster ohne Inhalt in 20 s', T0)
  lauf(BERICHT_YAKARI, { bremse: b })
  pruefe('Kreislauf: Fehlschläge davor werden nach einem Erfolg als Titelbefund gebucht', gleich([...gebucht.keys()].sort(), ['11', '12']), [...gebucht])
  /* Ohne Bremse (alte Aufrufer): altes Verhalten. */
  const alt = new Map()
  const o = { seite: 's', reihe: '9', erinnern: false, frist: 20000, jetzt: T0 + 21000, durchlauf: { folgen: [] }, merkmale: () => BERICHT_LEER }
  k.akNetflixListeWarten({ seite: 's', seit: T0 }, o, { spur() {}, uebersprungen: alt, weiter() {} })
  pruefe('ohne Bremse im Aufruf: wie bisher übersprungen', alt.get('9') === 'keine Folgenliste in 20 s', [...alt])
}

/* --- UI3012 im Player --- */
{
  const durchlauf = (code, reihe = '70023531') => ({ titelSperre: { code, reihe } })
  const gebucht = new Map()
  const b = k.akNetflixBremseOeffnen(gebucht, undefined, null)
  let weiter = 0
  const d = durchlauf('UI3012')
  pruefe('UI3012 mit Bremse: Störung, nicht übersprungen, es geht weiter', k.akNetflixTitelUeberspringen(d, gebucht, () => weiter++, b, T0) === true && gebucht.size === 0 && b.offen() === 1 && weiter === 1 && d.titelUebersprungen === true)
  k.akNetflixTitelUeberspringen(durchlauf('E103'), gebucht, () => weiter++, b, T0)
  pruefe('E103 mit Bremse: wie bisher übersprungen', gebucht.get('70023531') === 'Netflix zeigt ihn nicht (E103)' && b.offen() === 1)
  const g2 = new Map()
  k.akNetflixTitelUeberspringen(durchlauf('UI3012'), g2, () => {}, undefined, T0)
  pruefe('UI3012 ohne Bremse: wie bisher übersprungen', g2.get('70023531') === 'Netflix zeigt ihn nicht (UI3012)')
  const g3 = new Map()
  k.akNetflixTitelUeberspringen(durchlauf('UI3011'), g3, () => {}, b, T0)
  pruefe('anderer UI-Code: nicht Sache der Bremse', g3.has('70023531') && b.offen() === 1)
  /* Sieben UI3012 in Folge (Bericht 11:56:24–11:56:44): die Pause beginnt nach dem dritten, der Durchgang ruht dann. */
  const b7 = k.akNetflixBremseOeffnen(new Map(), undefined, null)
  let sprunge = 0
  for (let i = 0; i < 7; i++) {
    if (b7.pause(T0)) continue
    sprunge++
    k.akNetflixTitelUeberspringen(durchlauf('UI3012', String(70000 + i)), new Map(), () => {}, b7, T0)
  }
  pruefe('Bericht-Fall: nach dem dritten UI3012 steht die Bremse (Pause bis T0+10 min), kein vierter Sprung', sprunge === 3 && b7.bericht().pausen === 1 && b7.bericht().bis === T0 + 10 * MIN && b7.offen() === 3, b7.bericht())
}


/* --- Erst voll laden, dann Bremse (Daniel 12.11. 13:30: Overlay liegt, Inhalt fehlt; unser pushState-Sprung als mögliche Ursache) --- */
{
  const daten = {}
  const speicher = { getItem: (s) => daten[s] ?? null, setItem: (s, w) => { daten[s] = String(w) } }
  const geladen = []
  const v = k.akNetflixVollLaden({ assign: (a) => geladen.push(a) }, speicher)
  pruefe('Voll laden: vorher nicht versucht', v.versucht('81661821') === false)
  v.laden('81661821')
  pruefe('Voll laden: echte Adresse /title/<id> geladen, Versuch gemerkt', gleich(geladen, ['/title/81661821']) && v.versucht(81661821) === true && v.versucht('1') === false, geladen)
  const werfend = k.akNetflixVollLaden({ assign: (a) => geladen.push(a) }, { getItem: () => null, setItem: () => { throw new Error('x') } })
  werfend.laden('2')
  pruefe('Voll laden ohne beschreibbaren Speicher: lädt trotzdem', geladen.at(-1) === '/title/2')

  const lauf = (versucht) => {
    const b = k.akNetflixBremseOeffnen(new Map(), undefined, null)
    const z = { geladen: [], weiter: 0, spuren: [] }
    const vollLaden = { versucht: () => versucht, laden: (r) => z.geladen.push(r) }
    const o = { seite: 's', reihe: '81661821', erinnern: false, frist: 20000, jetzt: T0 + 21000, durchlauf: { folgen: [] }, merkmale: () => BERICHT_LEER }
    const rest = k.akNetflixListeWarten({ seite: 's', seit: T0 }, o, { spur: (w) => z.spuren.push(w), uebersprungen: new Map(), weiter: () => z.weiter++, bremse: b, vollLaden })
    return { b, z, rest }
  }
  let r = lauf(false)
  pruefe('Leeres Fenster, noch nicht voll geladen: Seite wird voll geladen, noch keine Störung, kein Weiter', gleich(r.z.geladen, ['81661821']) && r.b.offen() === 0 && r.z.weiter === 0 && r.rest.entschieden === true, r)
  r = lauf(true)
  pruefe('Leeres Fenster auch nach vollem Laden: Störung mit Hinweis im Grund, Weiter', r.z.geladen.length === 0 && r.b.offen() === 1 && r.z.weiter === 1 && /auch nach vollem Laden/.test(r.b.bericht().titel['81661821']), r)
  const g = new Map()
  const o2 = { seite: 's', reihe: '9', erinnern: false, frist: 20000, jetzt: T0 + 21000, durchlauf: { folgen: [] }, merkmale: () => BERICHT_YAKARI }
  const z2 = { geladen: 0 }
  k.akNetflixListeWarten({ seite: 's', seit: T0 }, o2, { spur() {}, uebersprungen: g, weiter() {}, bremse: k.akNetflixBremseOeffnen(g, undefined, null), vollLaden: { versucht: () => false, laden: () => z2.geladen++ } })
  pruefe('Echter Titel ohne Folgenliste: kein Neuladen', z2.geladen === 0 && g.has('9'))
}

/* --- Kastenzeilen (Pause, Ende) und Takt mit null freien Titeln --- */
{
  const el = () => {
    const e = { className: '', textContent: '', title: '', kinder: [], entfernt: false, rot: false }
    e.classList = { toggle: (n, an) => { if (n === 'ak-durchgang-rot') e.rot = Boolean(an) } }
    e.remove = () => { e.entfernt = true }
    return e
  }
  kontext.document = { createElement: el }
  const zeile = { kinder: [], appendChild(x) { this.kinder.push(x) }, querySelector(sel) { const kl = sel.replace(/^\./, ''); return this.kinder.find((x) => !x.entfernt && x.className.split(' ').includes(kl)) ?? null } }
  k.akNetflixPauseZeigen(() => zeile, 'Netflix bremst — Probe')
  pruefe('Pausenzeile: wird angelegt (Klasse, Text)', zeile.kinder.length === 1 && zeile.kinder[0].className === 'ak-hinweis ak-durchgang-pause' && zeile.kinder[0].textContent === 'Netflix bremst — Probe')
  k.akNetflixPauseZeigen(() => zeile, 'zweiter Text')
  pruefe('Pausenzeile: zweiter Aufruf ändert den Text, legt nichts neu an', zeile.kinder.length === 1 && zeile.kinder[0].textContent === 'zweiter Text')
  k.akNetflixPauseZeigen(() => zeile, null)
  pruefe('Pausenzeile: null entfernt sie', zeile.kinder[0].entfernt === true)
  k.akNetflixPauseZeigen(() => null, 'x')
  k.akNetflixPauseZeigen(() => { throw new Error('kein Kasten') }, 'x')
  pruefe('Pausenzeile: ohne Kasten oder bei Fehler kein Absturz', true)

  const z2 = { kinder: [], appendChild(x) { this.kinder.push(x) }, querySelector: zeile.querySelector }
  const ende = (grund, rot) => ({ grund, rot, uebersprungenText: ' · 2 übersprungen', text: ' · Rest' })
  k.akNetflixEndeZeigen(() => z2, ende('kein offener Auftrag mehr', false), ' (zurück)')
  const e0 = z2.kinder[0]
  pruefe('Endzeile fertig: Text, Titel, nicht rot', e0.textContent === 'Durchgang fertig · 2 übersprungen (zurück) · Rest' && e0.title === 'kein offener Auftrag mehr' && e0.rot === false && e0.className === 'ak-hinweis ak-durchgang-ende', e0)
  k.akNetflixEndeZeigen(() => z2, ende('Störung E1', true), '')
  pruefe('Endzeile abgebrochen: gleiche Zeile, Grund im Text, rot', z2.kinder.length === 1 && e0.textContent === 'Durchgang abgebrochen · Störung E1 · 2 übersprungen · Rest' && e0.rot === true)
  k.akNetflixEndeZeigen(() => z2, null, '')
  pruefe('Endzeile: null entfernt sie', e0.entfernt === true)

  const b = k.akNetflixBremseOeffnen(new Map(), undefined, speicherNeu(JSON.stringify({ folge: 0, pausen: 1, bis: T0, titel: {} })))
  const tun = { frei: [], gezeigt: [], zeigen: (t) => tun.gezeigt.push(t), weiter: (f) => tun.frei.push(f) }
  pruefe('Pause ohne vermerkte Titel endet: weiter(0) wird trotzdem gerufen (0 ist kein „nicht beendet")', k.akNetflixBremseTakt(b, T0, tun) === true && gleich(tun.frei, [0]), tun)
}
/* --- Tab-Besitz --- */
{
  const b = (tab, puls) => ({ tab, puls })
  pruefe('kein Besitzer: frei', k.akNetflixBesitzerUrteil(null, 'a', T0) === 'frei' && k.akNetflixBesitzerUrteil(undefined, 'a', T0) === 'frei')
  pruefe('eigener Besitzer, frisch: meiner', k.akNetflixBesitzerUrteil(b('a', T0 - 1000), 'a', T0) === 'meiner')
  pruefe('fremder Besitzer, frisch: fremd', k.akNetflixBesitzerUrteil(b('b', T0 - 1000), 'a', T0) === 'fremd')
  pruefe('fremder Besitzer, 89,999 s alt: lebt', k.akNetflixBesitzerUrteil(b('b', T0 - 89999), 'a', T0) === 'fremd')
  pruefe('fremder Besitzer, genau 90 s alt: tot, frei', k.akNetflixBesitzerUrteil(b('b', T0 - 90000), 'a', T0) === 'frei')
  pruefe('eigener, abgelaufen: frei', k.akNetflixBesitzerUrteil(b('a', T0 - 90000), 'a', T0) === 'frei')
  pruefe('Puls fehlt: frei', k.akNetflixBesitzerUrteil({ tab: 'b' }, 'a', T0) === 'frei')
  pruefe('Besitzer ohne Tab: frei', k.akNetflixBesitzerUrteil({ puls: T0 }, 'a', T0) === 'frei')

  const takt = (o) => {
    const tun = { geschrieben: [], beendet: [] }
    tun.schreiben = (x) => tun.geschrieben.push(x)
    tun.beenden = (g) => tun.beendet.push(g)
    tun.erg = k.akNetflixBesitz({ selbstAn: true, tab: 'a', jetzt: T0, ...o }, tun)
    return tun
  }
  let t = takt({ selbstAn: false, besitzer: b('b', T0) })
  pruefe('kein Durchgang: nichts zu prüfen, nichts geschrieben', t.erg === true && t.geschrieben.length === 0 && t.beendet.length === 0)
  t = takt({ besitzer: undefined })
  pruefe('Besitzer noch nicht geladen: warten, nichts schreiben', t.erg === false && t.geschrieben.length === 0 && t.beendet.length === 0)
  t = takt({ besitzer: b('b', T0 - 1000) })
  pruefe('fremder Durchgang lebt: dieser Durchgang endet mit Grund, schreibt nicht', t.erg === false && t.beendet.length === 1 && /anderen Tab/.test(t.beendet[0]) && t.geschrieben.length === 0, t)
  t = takt({ besitzer: b('b', T0 - 90000) })
  pruefe('fremder Besitzer tot (Tab zu): übernommen', t.erg === true && gleich(t.geschrieben, [{ tab: 'a', puls: T0 }]) && t.beendet.length === 0, t)
  t = takt({ besitzer: null })
  pruefe('niemand: Besitz wird angelegt', t.erg === true && gleich(t.geschrieben, [{ tab: 'a', puls: T0 }]))
  t = takt({ besitzer: b('a', T0 - 4999) })
  pruefe('eigener Puls 4,999 s alt: kein neuer Puls', t.erg === true && t.geschrieben.length === 0)
  t = takt({ besitzer: b('a', T0 - 5000) })
  pruefe('eigener Puls 5 s alt: neuer Puls', t.erg === true && gleich(t.geschrieben, [{ tab: 'a', puls: T0 }]))

  const h = k.akNetflixStartHinweis(b('b', T0 - 12000), 'a', T0)
  pruefe('Start-Knopf: fremder Durchgang lebt → Hinweis mit Alter und Frist', h?.text === 'Läuft schon in einem anderen Tab' && /vor 12 s/.test(h.title) && /90 s/.test(h.title), h)
  pruefe('Start-Knopf: eigener, toter oder fehlender Besitzer → Start erlaubt', k.akNetflixStartHinweis(b('a', T0), 'a', T0) === null && k.akNetflixStartHinweis(b('b', T0 - 90000), 'a', T0) === null && k.akNetflixStartHinweis(null, 'a', T0) === null)
}

/* --- Sprung des Durchgangs gehört seinem Tab --- */
{
  const sprung = { id: '80020759', zeit: 1, durchgang: true, tab: 'a' }
  pruefe('Durchgang-Sprung aus einem anderen Tab: weg', k.akNetflixEigenerSprung(sprung, 'b') === null)
  pruefe('Durchgang-Sprung im eigenen Tab: bleibt', k.akNetflixEigenerSprung(sprung, 'a') === sprung)
  pruefe('Durchgang-Sprung ohne Tab-Angabe (alter Stand): weg', k.akNetflixEigenerSprung({ ...sprung, tab: undefined }, 'a') === null)
  const klick = { id: '81659233', zeit: 1 }
  pruefe('Klick aus der Liste gilt in jedem Tab', k.akNetflixEigenerSprung(klick, 'b') === klick)
  pruefe('nichts bleibt nichts', k.akNetflixEigenerSprung(null, 'a') === null && k.akNetflixEigenerSprung(undefined, 'a') === null)

  const offen = { 80020759: { titel: 'X' } }
  const jetzt = 100000
  const zeit = jetzt - 1000
  pruefe('Melde-Knopf auf /browse: Sprung des Durchgangs (Bericht-Fall) gibt nie einen Auftrag', k.akNetflixBrowseAuftrag({ durchgang: true, id: '80020759', zeit }, offen, jetzt) === null)
  const hand = { id: '80020759', zeit }
  pruefe('… Klick aus der Liste gibt ihn', k.akNetflixBrowseAuftrag(hand, offen, jetzt) === hand)
  pruefe('… nicht gemeldet-verbraucht', k.akNetflixBrowseAuftrag({ ...hand, verbraucht: true }, offen, jetzt) === null)
  pruefe('… nicht älter als eine Minute (59,999 s ja, 60 s nein)', k.akNetflixBrowseAuftrag({ ...hand, zeit: jetzt - 59999 }, offen, jetzt) !== null && k.akNetflixBrowseAuftrag({ ...hand, zeit: jetzt - 60000 }, offen, jetzt) === null)
  pruefe('… nicht für einen Titel außerhalb der Prüfliste', k.akNetflixBrowseAuftrag(hand, {}, jetzt) === null)
  pruefe('… ohne Eintrag kein Auftrag', k.akNetflixBrowseAuftrag(null, offen, jetzt) === null)
}

/* --- Bericht je Titel --- */
{
  const tb = k.akNetflixTitelBericht('tab-1')
  tb.sehen({ pfad: '/browse', hintergrund: false, inhalt: false, code: null }, T0)
  pruefe('ohne begonnenen Titel wird nichts aufgeschrieben', tb.liste().length === 0)
  tb.beginn('80081848', T0)
  tb.sehen({ pfad: '/title/80081848', hintergrund: false, inhalt: false, code: null }, T0 + 500)
  tb.sehen({ pfad: '/title/80081848', hintergrund: true, inhalt: false, code: null }, T0 + 1500)
  tb.sehen({ pfad: '/title/80081848', hintergrund: true, inhalt: false, code: null }, T0 + 9000)
  tb.sehen({ pfad: '/watch/80084763', hintergrund: false, inhalt: false, code: 'UI3012' }, T0 + 12000)
  tb.sehen({ pfad: '/watch/80084763', hintergrund: false, inhalt: false, code: null }, T0 + 13000)
  const r = tb.liste()[0]
  pruefe('Adressfolge mit Zeit, jede Adresse einmal', gleich(r.adressen, [{ pfad: '/title/80081848', nachMs: 500 }, { pfad: '/watch/80084763', nachMs: 12000 }]), r.adressen)
  pruefe('Hintergrund erschien nach 1,5 s (erster Wert bleibt), Inhalt nie', r.hintergrundNachMs === 1500 && r.inhaltNachMs === null, r)
  pruefe('Fehlercode bleibt erhalten, auch wenn er später nicht mehr da ist', r.code === 'UI3012' && r.tab === 'tab-1')
  pruefe('Hintergrund ohne Inhalt gilt für den letzten Stand', r.hintergrundOhneInhalt === false)
  tb.sehen({ pfad: '/watch/80084763', hintergrund: true, inhalt: false, code: null }, T0 + 14000)
  pruefe('… und wird wieder wahr, wenn der Hintergrund da ist ohne Inhalt', tb.liste()[0].hintergrundOhneInhalt === true)
  tb.sehen({ pfad: '/watch/80084763', hintergrund: true, inhalt: true, code: null }, T0 + 15000)
  pruefe('Inhalt: Zeit gemerkt, nicht mehr „ohne Inhalt"', tb.liste()[0].inhaltNachMs === 15000 && tb.liste()[0].hintergrundOhneInhalt === false)
  tb.ausgang('80081848', 'Titelfenster ohne Inhalt', { folge: 2, pausen: 1, bis: T0 + 5 })
  pruefe('Ausgang mit Fehlschlägen in Folge und Pause', gleich(tb.liste()[0].ausgang, { text: 'Titelfenster ohne Inhalt', folge: 2, pausen: 1, pauseBis: T0 + 5 }), tb.liste()[0].ausgang)
  tb.ausgang('99', 'x', { folge: 0, pausen: 0, bis: null })
  pruefe('Ausgang für einen unbekannten Titel: kein Absturz, kein Eintrag', tb.liste().length === 1 && tb.liste()[0].ausgang.text === 'Titelfenster ohne Inhalt')
  for (let i = 0; i < 9; i++) tb.sehen({ pfad: `/x/${i}`, hintergrund: false, inhalt: false, code: null }, T0 + 20000 + i)
  pruefe('höchstens 8 Adressen je Titel', tb.liste()[0].adressen.length === 8)
  for (let i = 0; i < 45; i++) tb.beginn(String(i), T0)
  pruefe('höchstens 40 Titel, die ältesten fallen weg', tb.liste().length === 40 && tb.liste()[0].reihe === '5', tb.liste().length)
}
{
  /* Fensterlage aus einem Mini-DOM: Hintergrund (gemessen), Inhalt per Ausschluss, Fehlercode aus dem Text. */
  const doc = (uia, text) => ({
    body: { innerText: text },
    querySelector: (sel) => {
      if (sel === '[data-uia="previewModal--backDrop"]') return uia.includes('previewModal--backDrop') ? {} : null
      if (sel === '[data-uia*="episode"], [role="dialog"], [data-uia^="previewModal"]:not([data-uia="previewModal--backDrop"])') return uia.some((u) => /episode|^previewModal(?!--backDrop)/.test(u)) ? {} : null
      return null
    },
  })
  const l = (uia, text) => k.akNetflixFensterlage(doc(uia, text), { pathname: '/title/1' })
  pruefe('Bericht-Fall: nur Hintergrund → ohne Inhalt', gleich(l(['billboard', 'previewModal--backDrop'], 'Erinnern'), { pfad: '/title/1', hintergrund: true, inhalt: false, code: null }))
  pruefe('Hintergrund und Folgen → Inhalt', l(['previewModal--backDrop', 'episode-selector'], '').inhalt === true)
  pruefe('Fehlercode UI3012 im Text', l([], 'Entschuldigen Sie bitte die Störung (UI3012)').code === 'UI3012')
  pruefe('Fehlercode E103 und M7355 werden gefunden', l([], 'Fehler E103').code === 'E103' && l([], 'M7355 Netzwerk').code === 'M7355')
  pruefe('kaputtes Dokument: null statt Absturz', k.akNetflixFensterlage({}, {}) === null)
}

/* --- Takt vor allem anderen --- */
{
  const mitTun = (o) => {
    const b = k.akNetflixBremseOeffnen(new Map(), undefined, null)
    const tun = { geschrieben: [], beendet: 0, gesehen: 0, gezeigt: [], frei: [] }
    tun.schreiben = (x) => tun.geschrieben.push(x)
    tun.beenden = () => tun.beendet++
    tun.sehen = () => tun.gesehen++
    tun.zeigen = (t) => tun.gezeigt.push(t)
    tun.weiter = (f) => tun.frei.push(f)
    return { b, tun, o: { selbstAn: true, besitzer: null, tab: 'a', jetzt: T0, bremse: b, ...o } }
  }
  let w = mitTun({})
  pruefe('Takt: eigener Durchgang, keine Pause → weiter, Bericht gelesen, Besitz geschrieben', k.akNetflixSelbstTakt(w.o, w.tun) === true && w.tun.gesehen === 1 && w.tun.geschrieben.length === 1)
  w = mitTun({ besitzer: { tab: 'b', puls: T0 } })
  pruefe('Takt: fremder Besitzer → Takt endet, Durchgang beendet, Bericht nicht gelesen', k.akNetflixSelbstTakt(w.o, w.tun) === false && w.tun.beendet === 1 && w.tun.gesehen === 0)
  w = mitTun({})
  for (const r of ['1', '2', '3']) w.b.stoerung(r, 'x', T0)
  pruefe('Takt in der Pause → ruht, Text im Kasten', k.akNetflixSelbstTakt(w.o, w.tun) === false && w.tun.gezeigt.length === 1)
  w = mitTun({ selbstAn: false })
  pruefe('Takt ohne Durchgang: weiter, nichts gelesen', k.akNetflixSelbstTakt(w.o, w.tun) === true && w.tun.gesehen === 0 && w.tun.gezeigt.length === 0)
}
{
  const aufrufe = []
  const tun = k.akNetflixTaktTun({
    titelBericht: { sehen: (lage, jetzt) => aufrufe.push(['sehen', lage, typeof jetzt]) },
    kasten: () => ({ querySelector: () => null }),
    speichern: (w) => aufrufe.push(['speichern', w]),
    beenden: 'beenden',
    weiter: 'weiter',
  })
  tun.schreiben({ tab: 'a', puls: 1 })
  tun.schreiben(null)
  pruefe('Rückrufe: Besitz geht unter dem Schlüssel netflixDurchgangBesitzer in den Speicher', gleich(aufrufe, [['speichern', { netflixDurchgangBesitzer: { tab: 'a', puls: 1 } }], ['speichern', { netflixDurchgangBesitzer: null }]]), aufrufe)
  pruefe('Rückrufe: beenden und weiter werden durchgereicht', tun.beenden === 'beenden' && tun.weiter === 'weiter')
}
{
  const b = k.akNetflixBremseOeffnen(new Map(), undefined, null)
  const tb = k.akNetflixTitelBericht('a')
  b.stoerung('1', 'x', T0)
  tb.beginn('1', T0)
  const bericht = k.akNetflixSitzungBericht(tb, b, 'a', { tab: 'b', puls: T0 - 1000 }, T0)
  pruefe('Sitzungsbericht: Tab, Besitzer mit Urteil, Bremse, Titel', bericht.tab === 'a' && bericht.besitzer.urteil === 'fremd' && bericht.bremse.folge === 1 && bericht.titel.length === 1, bericht)
  pruefe('Sitzungsbericht: Besitzer noch nicht geladen', k.akNetflixSitzungBericht(tb, b, 'a', undefined, T0).besitzer === 'nicht geladen')
  pruefe('Sitzungsbericht: kein Besitzer (null)', k.akNetflixSitzungBericht(tb, b, 'a', null, T0).besitzer.urteil === 'frei')
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Bremse halten.')
