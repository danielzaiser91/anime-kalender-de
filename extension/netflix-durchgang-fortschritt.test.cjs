/**
 * Netflix-Durchgang: Fortschrittsanzeige, aufgeräumter Hintergrund, kurze Fristen (12.11.2026).
 *
 * Anlass: Bericht `anime-kalender-netflix-2026-11-12T19-02-48` (4.32.110): Titel 81686706 zeigte „Startseite – Netflix"
 * mit `previewModal--backDrop` ohne Inhalt (Hintergrund nach 1003 ms, Inhalt nie), der Durchgang stand 20 s, lud
 * neu, wartete wieder 20 s, und nach drei solchen Titeln begann eine Pause von 10 Minuten mit grauem Hintergrund.
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

console.log('Netflix: Fortschritt, Hintergrund aufräumen')
const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-erinnern.js'), kontext)
vm.runInContext(lies('netflix-durchgang-steuerung.js'), kontext)
vm.runInContext(lies('netflix-bericht.js'), kontext)
const k = kontext

/* --- Fortschrittstext --- */
{
  const f = k.akNetflixFortschritt(12, 163, 'Dead Mount Death Play')
  pruefe('12. Sprung: 11 geprüft von 163, gerade der Titel', f.text === 'Durchgang: 11 von 163 geprüft · gerade: Dead Mount Death Play', f)
  pruefe('Anteil = 11/163', Math.abs(f.anteil - 11 / 163) < 1e-9, f)
  pruefe('erster Sprung: 0 geprüft, Anteil 0', k.akNetflixFortschritt(1, 163, 'A').anteil === 0 && /^Durchgang: 0 von 163 geprüft/.test(k.akNetflixFortschritt(1, 163, 'A').text))
  pruefe('ohne Titelname: kein „gerade"', k.akNetflixFortschritt(2, 5, undefined).text === 'Durchgang: 1 von 5 geprüft')
  pruefe('mehr Sprünge als Grenze: nie über 100 %', k.akNetflixFortschritt(9, 5, 'A').anteil === 1)
  pruefe('ohne Grenze (null) oder ohne Sprung: keine Anzeige', k.akNetflixFortschritt(3, null, 'A') === null && k.akNetflixFortschritt(0, 5, 'A') === null && k.akNetflixFortschritt(1, 0, 'A') === null)
}

/* --- Kastenzeilen --- */
const el = () => {
  const e = { className: '', textContent: '', kinder: [], entfernt: false, stil: {} }
  e.remove = () => { e.entfernt = true }
  e.style = { setProperty: (n, w) => { e.stil[n] = w } }
  return e
}
kontext.document = { createElement: el }
const neueZeile = () => ({ kinder: [], appendChild(x) { this.kinder.push(x) }, querySelector(sel) { const kl = sel.replace(/^\./, ''); return this.kinder.find((x) => !x.entfernt && x.className.split(' ').includes(kl)) ?? null } })
{
  const zeile = neueZeile()
  k.akNetflixFortschrittZeigen(() => zeile, { text: 'Durchgang: 1 von 4 geprüft', anteil: 0.25 })
  const [text, balken] = zeile.kinder
  pruefe('Zeile und Balken werden angelegt', zeile.kinder.length === 2 && text.className === 'ak-hinweis ak-durchgang-fortschritt' && balken.className === 'ak-durchgang-balken')
  pruefe('Text und Anteil (25 %) stehen drin', text.textContent === 'Durchgang: 1 von 4 geprüft' && balken.stil['--ak-anteil'] === '25%', balken.stil)
  k.akNetflixFortschrittZeigen(() => zeile, { text: 'Durchgang: 2 von 4 geprüft', anteil: 0.5 })
  pruefe('zweiter Aufruf: gleiche Elemente, neuer Text und 50 %', zeile.kinder.length === 2 && text.textContent === 'Durchgang: 2 von 4 geprüft' && balken.stil['--ak-anteil'] === '50%')
  k.akNetflixFortschrittZeigen(() => zeile, null)
  pruefe('null entfernt beide', text.entfernt === true && balken.entfernt === true)
  k.akNetflixFortschrittZeigen(() => null, { text: 'x', anteil: 0 })
  k.akNetflixFortschrittZeigen(() => { throw new Error('kein Kasten') }, { text: 'x', anteil: 0 })
  pruefe('ohne Kasten oder bei Fehler kein Absturz', true)
}

/* --- Hintergrund ohne Inhalt aufräumen --- */
const doc = (uia) => ({
  body: { innerText: '' },
  querySelector: (sel) => {
    if (sel === '[data-uia="previewModal--backDrop"]') return uia.includes('previewModal--backDrop') ? {} : null
    return uia.includes('episode') ? {} : null
  },
})
const J = 1000000
const EIGEN = { id: '81686706', tab: 'a', durchgang: true, zeit: J }
/** `sprung`: der Merker des Durchgangs; `alter`: ms seit dem Sprung. */
const raeumen = (uia, pfad, { sprung = EIGEN, alter = 600000, tab = 'a' } = {}) => {
  const ziele = []
  const r = k.akNetflixFensterRaeumen(doc(uia), { pathname: pfad }, (p) => ziele.push(p), { sprung, tab, jetzt: J + alter })
  return { r, ziele }
}
{
  let x = raeumen(['billboard', 'previewModal--backDrop'], '/title/81686706')
  pruefe('Bericht-Fall (eigener Sprung, 10 min alt, Hintergrund ohne Inhalt): zurück auf /browse', x.r === true && x.ziele.join() === '/browse', x)
  x = raeumen(['previewModal--backDrop'], '/de-de/title/81686706')
  pruefe('Gebietspfad /de-de/title/… ebenso', x.r === true && x.ziele.join() === '/browse')
  x = raeumen(['previewModal--backDrop'], '/title/555')
  pruefe('Pause, Sprung 10 min alt, Hintergrund auf einem anderen /title (Daniel öffnet selbst): gehe nicht gerufen', x.r === false && x.ziele.length === 0, x)
  x = raeumen(['previewModal--backDrop'], '/title/81686706', { alter: 1000 })
  pruefe('Hintergrund 1 s nach dem Sprung (Inhalt kommt noch): gehe nicht gerufen', x.r === false && x.ziele.length === 0, x)
  x = raeumen(['previewModal--backDrop'], '/title/81686706', { alter: 7999 })
  pruefe('7999 ms: noch nicht', x.r === false)
  x = raeumen(['previewModal--backDrop'], '/title/81686706', { alter: 8000 })
  pruefe('genau 8000 ms: geräumt', x.r === true)
  x = raeumen(['previewModal--backDrop'], '/title/81686706', { tab: 'b' })
  pruefe('Sprung eines anderen Tabs: nicht geräumt', x.r === false)
  x = raeumen(['previewModal--backDrop'], '/title/81686706', { sprung: { ...EIGEN, durchgang: false } })
  pruefe('Merker von Hand geöffnet (kein Durchgang): nicht geräumt', x.r === false)
  x = raeumen(['previewModal--backDrop'], '/title/81686706', { sprung: null })
  pruefe('ohne Merker: nicht geräumt', x.r === false)
  x = raeumen(['previewModal--backDrop', 'episode'], '/title/81686706')
  pruefe('mit Inhalt (Folgen): nichts anfassen', x.r === false && x.ziele.length === 0)
  x = raeumen(['billboard'], '/title/81686706')
  pruefe('ohne Hintergrund: nichts anfassen', x.r === false && x.ziele.length === 0)
  x = raeumen(['previewModal--backDrop'], '/browse')
  pruefe('Hintergrund auf /browse (Netflix\' eigene Seite): nichts anfassen, kein Dauer-Navigieren', x.r === false && x.ziele.length === 0)
  pruefe('kaputtes Dokument: kein Absturz, nichts', k.akNetflixFensterRaeumen({}, {}, () => { throw new Error('nie') }, { sprung: EIGEN, tab: 'a', jetzt: J + 99999 }) === false)
}

/* --- Pause: der Takt räumt, ein Takt ohne Pause nicht --- */
{
  const T0 = Date.UTC(2026, 10, 12, 19, 0, 0)
  const bremse = (bis) => k.akNetflixBremseOeffnen(new Map(), undefined, { getItem: () => JSON.stringify({ folge: 0, pausen: 1, bis, titel: { 1: 'x' } }), setItem() {} })
  const tun = () => { const t = { gezeigt: [], geraeumt: 0 }; t.zeigen = (x) => t.gezeigt.push(x); t.raeumen = () => t.geraeumt++; t.weiter = () => {}; return t }
  let t = tun()
  pruefe('Pause läuft: Text gezeigt und aufgeräumt', k.akNetflixBremseTakt(bremse(T0 + 60000), T0, t) === true && t.gezeigt.length === 1 && t.geraeumt === 1, t)
  t = tun()
  pruefe('keine Pause: nichts aufgeräumt', k.akNetflixBremseTakt(bremse(null), T0, t) === false && t.geraeumt === 0, t)
  t = tun()
  pruefe('Pause gerade zu Ende: nicht aufgeräumt (weiter zum nächsten Titel)', k.akNetflixBremseTakt(bremse(T0), T0, t) === true && t.geraeumt === 0, t)
}

/* --- Verdrahtung: das echte `taktTun` aus melder.js und `laufBeenden` --- */
const melder = lies('melder.js')
/** Der Text einer Funktion aus melder.js (bis zur schließenden Klammer in Spalte 0). */
const funktionAus = (kopf) => {
  const von = melder.indexOf(kopf)
  return melder.slice(von, melder.indexOf('\n}\n', von) + 2)
}
{
  const zeile = melder.split('\n').find((z) => z.startsWith('const taktTun = akNetflixTaktTun('))
  pruefe('taktTun-Zeile gefunden', Boolean(zeile))
  const welt = { gehen: [], kasten: neueZeile(), gezaehlt: 3, grenze: 10 }
  const kastenEl = { querySelector: () => welt.kasten }
  kontext.document = { createElement: el, body: { innerText: '' }, querySelector: (sel) => (sel === '[data-uia="previewModal--backDrop"]' ? {} : null) }
  kontext.location = { pathname: '/title/7' }
  kontext.Date = { now: () => J + 600000 }
  const sprung = { id: 7, tab: 'a', durchgang: true, zeit: J }
  const tun = new Function(
    'akNetflixTaktTun', 'akNetflixFortschritt', 'akNetflixFortschrittStand', 'titelBericht', 'netflixKasten', 'speicherSchreiben', 'laufBeenden', 'selbstWeiter', 'gehe', 'offeneTitel', 'zuletztGeoeffnet', 'meinTab', 'welt', 'durchlaufKnopfZeigen', 'DURCHLAUF', 'akNetflixZaehlerStand', 'akNetflixWartetText', 'selbstWartet',
    `let selbstGezaehlt = welt.gezaehlt, selbstGrenze = welt.grenze\n${zeile}\nreturn taktTun`,
  )(k.akNetflixTaktTun, k.akNetflixFortschritt, k.akNetflixFortschrittStand, { sehen() {} }, () => kastenEl, () => {}, () => {}, () => {}, (p) => welt.gehen.push(p), { 7: { titel: 'Dead Mount Death Play' } }, sprung, 'a', welt, () => { welt.gezeichnet = (welt.gezeichnet ?? 0) + 1 }, { knopf: { textContent: '⏹ 0/0 — abbrechen' } }, k.akNetflixZaehlerStand, k.akNetflixWartetText, null)
  /* Die Funktionen lesen `document` und `location` als Globals des Kontexts: im Kontext ausführen. */
  kontext.__tun = tun
  vm.runInContext('__tun.sehen()', kontext)
  const [text, balken] = welt.kasten.kinder
  pruefe('sehen(): Fortschrittszeile mit echtem Zählerstand und Titel aus der Prüfliste', text?.textContent === 'Durchgang: 2 von 10 geprüft · gerade: Dead Mount Death Play' && balken?.stil['--ak-anteil'] === '20%', welt.kasten.kinder)
  pruefe('sehen(): der Knopf "⏹ 0/0" wird bei Stand 2/10 neu gezeichnet (Verdrahtung aus melder.js)', welt.gezeichnet === 1, welt.gezeichnet)
  vm.runInContext('__tun.raeumen()', kontext)
  pruefe('raeumen(): eigener Sprung (Merker und Tab aus melder.js), 10 min alt: echte Navigation (gehe) auf /browse', welt.gehen.join() === '/browse', welt.gehen)
  welt.gehen.length = 0
  kontext.location = { pathname: '/title/555' }
  vm.runInContext('__tun.raeumen()', kontext)
  pruefe('raeumen(): fremdes /title (Daniel öffnet selbst): gehe nicht gerufen', welt.gehen.length === 0, welt.gehen)
  kontext.location = { pathname: '/title/7' }
  k.akNetflixPauseZeigen(() => welt.kasten, 'Netflix bremst — Probe')
  const pause = welt.kasten.kinder.find((x) => x.className === 'ak-hinweis ak-durchgang-pause')
  vm.runInContext('__tun.aufraeumen()', kontext)
  pruefe('aufraeumen(): Fortschritt und Pausenzeile weg, Hintergrund geräumt', text.entfernt === true && balken.entfernt === true && pause?.entfernt === true && welt.gehen.join() === '/browse', welt.gehen)
}
{
  const start = melder.indexOf('function laufBeenden(grund)')
  const block = melder.slice(start, melder.indexOf('\n}\n', start))
  pruefe('laufBeenden ruft taktTun.aufraeumen() (nicht nur die Pausenzeile)', /taktTun\.aufraeumen\(\)/.test(block))
}

/* --- Zähler und Nenner überstehen das volle Neuladen (`akNetflixVollLaden`): echte `selbstWeiter` und echte `let`-Zeilen aus melder.js --- */
{
  const speicher = {}
  kontext.sessionStorage = { getItem: (n) => speicher[n] ?? null, setItem: (n, w) => { speicher[n] = String(w) }, removeItem: (n) => { delete speicher[n] } }
  const lets = melder.split('\n').filter((z) => /^let selbst(?:Gezaehlt|Grenze) = /.test(z)).join('\n')
  const von = melder.indexOf('function selbstWeiter(frei = 0, nichtDa = false, kennung = null)')
  const weiter = melder.slice(von, melder.indexOf('\n}\n', von) + 2)
  /** Ein „Seitenaufruf": das Modul startet neu (Zähler aus dem Speicher), ein Sprung folgt. */
  const seite = (titelZahl) => {
    const offen = {}
    for (let i = 1; i <= titelZahl; i++) offen[i] = { titel: `T${i}` }
    const ergebnis = {}
    new Function(
      'offeneTitel', 'akDurchgangSchutz', 'laufBeenden', 'naechsterAuftrag', 'speicherSchreiben', 'gehe', 'console', 'Date', 'LAUF_SCHLUESSEL', 'LAUF_HOECHSTENS_MS', 'bremse', 'meinTab', 'titelBericht', 'akNetflixZaehlerStand', 'akNetflixZaehlerSetze', 'akNetflixBericht', 'fertig', 'selbstUebersprungen', 'ergebnis', 'nichtDaTun', 'akNetflixErledigtZaehlen',
      `const verbindungLebt = () => true\nconst akNetflixSprungWiederholt = () => false\nconst akNetflixGesprungenLeeren = () => {}\nconst spur = () => {}\nconst akNetflixEigenerSprungMerken = (s) => s\n${lets}\nlet zuletztGeoeffnet = null\nconst vorher = [selbstGezaehlt, selbstGrenze]\n${weiter}\nselbstWeiter()\nergebnis.vorher = vorher\nergebnis.nachher = [selbstGezaehlt, selbstGrenze]`,
    )(offen, () => null, () => {}, () => '1', async () => {}, () => {}, { log() {} }, { now: () => 1 }, 'k', 1, { pause: () => null, offen: () => 0 }, 'a', { beginn() {} }, k.akNetflixZaehlerStand, k.akNetflixZaehlerSetze, kontext.akNetflixBericht, () => false, { nichtOffen: () => false }, ergebnis, { sprung: () => {} }, () => {})
    return ergebnis
  }
  let r = seite(40)
  pruefe('erster Sprung: vorher 0, danach 1 von 40', JSON.stringify(r.vorher) === '[0,null]' && JSON.stringify(r.nachher) === '[1,40]', r)
  r = seite(39)
  pruefe('nach dem Neuladen: Zähler 1 und Nenner 40 bleiben (nicht 0 von 39), der nächste Sprung zählt 2 von 40', JSON.stringify(r.vorher) === '[1,40]' && JSON.stringify(r.nachher) === '[2,40]', r)
  const f = k.akNetflixFortschritt(...r.vorher, 'X')
  pruefe('die Fortschrittszeile direkt nach dem Neuladen zeigt „0 von 40 geprüft" mit demselben Nenner (Zähler 1 = erster Titel läuft)', f.text === 'Durchgang: 0 von 40 geprüft · gerade: X', f)
  speicher['ak-netflix-fertig'] = '["1"]'
  speicher['ak-netflix-uebersprungen'] = '[["2","x"]]'
  vm.runInContext('__tun.aufraeumen()', kontext)
  pruefe('Ende des Durchgangs (taktTun.aufraeumen): Speicher leer bis auf den Besuchtzähler (steht für die Endzeile), der nächste Lauf beginnt bei 0', JSON.stringify(k.akNetflixZaehlerStand()) === '{"gezaehlt":0,"grenze":null}' && Object.keys(speicher).every((n) => n === 'ak-netflix-besucht'), speicher)
  speicher['ak-netflix-zaehler'] = '{kaputt'
  pruefe('kaputter Speicher: 0 und kein Nenner, kein Absturz', JSON.stringify(k.akNetflixZaehlerStand()) === '{"gezaehlt":0,"grenze":null}')
  speicher['ak-netflix-zaehler'] = JSON.stringify({ gezaehlt: 3, grenze: 0 })
  pruefe('Nenner 0 im Speicher: verworfen', k.akNetflixZaehlerStand().grenze === null)
  const stumm = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
  pruefe('Speicher wirft: kein Absturz', k.akNetflixZaehlerStand(stumm).gezaehlt === 0 && k.akNetflixZaehlerSetze(1, 2, stumm) === undefined)
}

/* --- 16.11.2026 (Daniel, 4.32.134): Titel, die der Sprung als „nicht bei Netflix“ zurückgibt, zählen als geprüft; der Knopf zeigt denselben Stand --- */
{
  const speicher = {}
  kontext.sessionStorage = { getItem: (n) => speicher[n] ?? null, setItem: (n, w) => { speicher[n] = String(w) }, removeItem: (n) => { delete speicher[n] } }
  const lets = melder.split('\n').filter((z) => /^let selbst(?:Gezaehlt|Grenze) = /.test(z)).join('\n')
  const weiter = funktionAus('function selbstWeiter(frei = 0, nichtDa = false, kennung = null)')
  /** Ein Seitenaufruf mit Neustart des Moduls: `aufruf` = Quelltext des Aufrufs (Sprung, oder Rückgabe wie `akNetflixSprung`). */
  const seite = (aufruf) => {
    const offen = {}
    for (let i = 1; i <= 128; i++) offen[i] = { titel: `T${i}` }
    const ergebnis = {}
    new Function(
      'offeneTitel', 'akDurchgangSchutz', 'laufBeenden', 'naechsterAuftrag', 'speicherSchreiben', 'gehe', 'console', 'Date', 'LAUF_SCHLUESSEL', 'LAUF_HOECHSTENS_MS', 'bremse', 'meinTab', 'titelBericht', 'akNetflixZaehlerStand', 'akNetflixZaehlerSetze', 'akNetflixErledigtStand', 'akNetflixErledigtZaehlen', 'akNetflixFortschrittStand', 'akNetflixBericht', 'fertig', 'selbstUebersprungen', 'ergebnis', 'nichtDaTun',
      `const verbindungLebt = () => true\nconst akNetflixSprungWiederholt = () => false\nconst akNetflixGesprungenLeeren = () => {}\nconst spur = () => {}\nconst akNetflixEigenerSprungMerken = (s) => s\n${lets}\nlet zuletztGeoeffnet = null\n${weiter}\n${aufruf}\nergebnis.f = akNetflixFortschrittStand(selbstGezaehlt, selbstGrenze, undefined)`,
    )(offen, () => null, () => {}, () => '1', async () => {}, () => {}, { log() {} }, { now: () => 1 }, 'k', 1, { pause: () => null, offen: () => 0 }, 'a', { beginn() {} }, k.akNetflixZaehlerStand, k.akNetflixZaehlerSetze, k.akNetflixErledigtStand, k.akNetflixErledigtZaehlen, k.akNetflixFortschrittStand, kontext.akNetflixBericht, () => false, { nichtOffen: () => false }, ergebnis, { sprung: () => {} })
    return ergebnis.f
  }
  k.akNetflixZaehlerSetze(0, 128)
  const stand = [seite('selbstWeiter()')]
  /* Jeder weitere Titel: Neuladen, der Titel ist „nicht da“ (Umleitung → `weiter(1, true)`), der nächste Sprung folgt. */
  for (let i = 0; i < 6; i++) stand.push(seite('selbstWeiter(1, true)'))
  const zahlen = stand.map((f) => f.geprueft)
  pruefe('Zähler steigt je zurückgegebenem Titel (nicht bei 0 stehen)', JSON.stringify(zahlen) === '[0,1,2,3,4,5,6]', zahlen)
  pruefe('Zeile nennt dieselbe Zahl: „6 von 128 geprüft“', stand[6].text.startsWith('Durchgang: 6 von 128 geprüft'), stand[6].text)
  pruefe('Knopfzahl = Zeile (6/128), nicht 0/0', k.akNetflixKnopfZahl(stand[6]) === '6/128' && k.akNetflixKnopfZahl(null) === null)
  const mix = seite('selbstWeiter()')
  pruefe('ein geprüfter Titel dazwischen zählt weiter: 7 von 128', mix.geprueft === 7, mix)
  k.akNetflixZaehlerSetze(0, 40)
  pruefe('neuer Lauf (Zähler 0) beginnt auch bei 0 erledigten Titeln', k.akNetflixErledigtStand() === 0, speicher)
  k.akNetflixErledigtZaehlen()
  k.akNetflixZaehlerSetze(null)
  pruefe('Ende des Durchgangs behält die erledigten Titel (Endzeile), der nächste Start setzt sie auf 0', k.akNetflixErledigtStand() === 1, speicher)
  const zeile = melder.split('\n').find((z) => z.includes('const zahl = (selbstAn'))
  pruefe('Knopf in melder.js: Zahl aus akNetflixKnopfZahl(taktTun.fortschritt()) nur im Durchgang', /selbstAn && akNetflixKnopfZahl\(taktTun\.fortschritt\(\)\)/.test(zeile ?? ''), zeile)
  const knopf = (selbstAn, f) => new Function('selbstAn', 'akNetflixKnopfZahl', 'taktTun', 'fertig', 'gesamt', `${zeile}\nreturn zahl`)(selbstAn, k.akNetflixKnopfZahl, { fortschritt: () => f }, 0, 0)
  /* Endzeile: echte `laufBeenden` aus melder.js nach sieben Neuladungen mit zurückgegebenem Titel (Daniel 16.11.: „besucht 4“ bei 128). */
  const endeText = (erledigt) => {
    const sp = { 'ak-netflix-erledigt': String(erledigt) }
    const ergebnis = {}
    new Function(
      'selbstAn', 'selbstGezaehlt', 'akNetflixBesuchtStand', 'akNetflixEnde', 'bremse', 'taktTun', 'durchgangBesitzer', 'meinTab', 'fertigeTitel', 'selbstUebersprungen', 'offeneTitel', 'vorfallMelden', 'durchgangEndeZeigen', 'DURCHLAUF', 'durchlaufKnopfZeigen', 'sessionStorage', 'LAUF_SCHLUESSEL', 'console', 'ergebnis', 'sp',
      `let durchgangEnde = null\n${funktionAus('function laufBeenden(grund)')}\nlaufBeenden('kein offener Auftrag mehr')`,
    )(true, 1, () => Number(sp['ak-netflix-erledigt']) + 1, (g, u, f, besucht) => { ergebnis.besucht = besucht; return {} }, { zuruecksetzen() {} }, { aufraeumen() {}, schreiben() {} }, null, 'a', new Map(), new Map(), {}, () => {}, () => {}, {}, () => {}, { removeItem() {} }, 'k', { log() {} }, ergebnis, sp)
    return ergebnis.besucht
  }
  pruefe('Endzeile: besucht kommt aus dem Besuchtzähler (4060; vorher Sprünge + zurückgegebene Titel)', endeText(127) === 128, endeText(127))
  const nachziehen = (f, text) => {
    let gezeichnet = 0
    k.akNetflixKnopfNachziehen(f, () => text, () => { gezeichnet++ })
    return gezeichnet
  }
  const f4 = { geprueft: 4, grenze: 128 }
  const f11 = { geprueft: 11, grenze: 128 }
  pruefe('Knopf im Nicht-Abbruch-Zustand (Zahl am Textanfang, „6/128 — läuft“): kein Dauer-Neuzeichnen', nachziehen({ geprueft: 6, grenze: 128 }, '6/128 — läuft') === 0)
  pruefe('Knopf zieht nach: „⏹ 0/0“ bei Stand 4/128 wird neu gezeichnet', nachziehen(f4, '⏹ 0/0 — abbrechen') === 1)
  pruefe('Knopf zieht nicht nach, wenn er den Stand schon zeigt', nachziehen(f4, '⏹ 4/128 — abbrechen') === 0)
  pruefe('Knopf: „1/128“ im Text von „11/128“ zählt nicht als gleicher Stand', nachziehen({ geprueft: 1, grenze: 128 }, '⏹ 11/128 — abbrechen') === 1 && nachziehen(f11, '⏹ 11/128 — abbrechen') === 0)
  pruefe('Knopf ohne Fortschritt oder ohne Text: kein Neuzeichnen', nachziehen(null, '⏹ 0/0 — abbrechen') === 0 && nachziehen(f4, undefined) === 0)
  pruefe('Knopf: im Durchgang 6/128, sonst Folgenstand 0/0', knopf(true, stand[6]) === '6/128' && knopf(false, stand[6]) === '0/0' && knopf(true, null) === '0/0')
}

if (fehler.length) {
  console.log(`\n${fehler.length} Fehler`)
  process.exit(1)
}
console.log('\nalle Zusicherungen grün')
