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
const raeumen = (uia, pfad) => {
  const ziele = []
  const r = k.akNetflixFensterRaeumen(doc(uia), { pathname: pfad }, (p) => ziele.push(p))
  return { r, ziele }
}
{
  let x = raeumen(['billboard', 'previewModal--backDrop'], '/title/81686706')
  pruefe('Bericht-Fall (Hintergrund ohne Inhalt auf /title): zurück auf /browse', x.r === true && x.ziele.join() === '/browse', x)
  x = raeumen(['previewModal--backDrop'], '/de-de/title/81686706')
  pruefe('Gebietspfad /de-de/title/… ebenso', x.r === true && x.ziele.join() === '/browse')
  x = raeumen(['previewModal--backDrop', 'episode'], '/title/1')
  pruefe('mit Inhalt (Folgen): nichts anfassen', x.r === false && x.ziele.length === 0)
  x = raeumen(['billboard'], '/title/1')
  pruefe('ohne Hintergrund: nichts anfassen', x.r === false && x.ziele.length === 0)
  x = raeumen(['previewModal--backDrop'], '/browse')
  pruefe('Hintergrund auf /browse (Netflix\' eigene Seite): nichts anfassen, kein Dauer-Navigieren', x.r === false && x.ziele.length === 0)
  pruefe('kaputtes Dokument: kein Absturz, nichts', k.akNetflixFensterRaeumen({}, {}, () => { throw new Error('nie') }) === false)
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
{
  const zeile = melder.split('\n').find((z) => z.startsWith('const taktTun = akNetflixTaktTun('))
  pruefe('taktTun-Zeile gefunden', Boolean(zeile))
  const welt = { gehen: [], kasten: neueZeile(), gezaehlt: 3, grenze: 10 }
  const kastenEl = { querySelector: () => welt.kasten }
  kontext.document = { createElement: el, body: { innerText: '' }, querySelector: (sel) => (sel === '[data-uia="previewModal--backDrop"]' ? {} : null) }
  kontext.location = { pathname: '/title/81686706' }
  const tun = new Function(
    'akNetflixTaktTun', 'akNetflixFortschritt', 'titelBericht', 'netflixKasten', 'speicherSchreiben', 'laufBeenden', 'selbstWeiter', 'gehe', 'offeneTitel', 'zuletztGeoeffnet', 'welt',
    `let selbstGezaehlt = welt.gezaehlt, selbstGrenze = welt.grenze\n${zeile}\nreturn taktTun`,
  )(k.akNetflixTaktTun, k.akNetflixFortschritt, { sehen() {} }, () => kastenEl, () => {}, () => {}, () => {}, (p) => welt.gehen.push(p), { 7: { titel: 'Dead Mount Death Play' } }, { id: 7 }, welt)
  /* Die Funktionen lesen `document` und `location` als Globals des Kontexts: im Kontext ausführen. */
  kontext.__tun = tun
  vm.runInContext('__tun.sehen()', kontext)
  const [text, balken] = welt.kasten.kinder
  pruefe('sehen(): Fortschrittszeile mit echtem Zählerstand und Titel aus der Prüfliste', text?.textContent === 'Durchgang: 2 von 10 geprüft · gerade: Dead Mount Death Play' && balken?.stil['--ak-anteil'] === '20%', welt.kasten.kinder)
  vm.runInContext('__tun.raeumen()', kontext)
  pruefe('raeumen(): echte Navigation (gehe) auf /browse', welt.gehen.join() === '/browse', welt.gehen)
  welt.gehen.length = 0
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

if (fehler.length) {
  console.log(`\n${fehler.length} Fehler`)
  process.exit(1)
}
console.log('\nalle Zusicherungen grün')
