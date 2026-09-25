/**
 * Der Prime-Durchgang (25.09.2026) im Sandkasten: derselbe Code wie in `amazon.js`, die Umgebung
 * nachgebaut — Meldeknopf, Frames, Prüfliste, Tab-Speicher, Uhr.
 *
 * Zwei Teile, wie im Code: die **Steuerung** auf der sichtbaren Seite (öffnet Frames, führt den
 * Plan) und der **Automat** im Frame (wartet auf den Knopf, klickt, meldet das Ergebnis zurück).
 *
 * Gespielt wird Naruto, wie Daniel es vorgelegt hat: Die Prüfliste führt Staffel 9
 * (B07VP6VPVR), die Seite nennt neun Staffeln mit eigener ASIN (gemessen am 25.09.2026).
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync(__dirname + '/amazon.js', 'utf8')
const von = quelle.indexOf('  // --- Durchgang über die Prüfliste')
const bis = quelle.indexOf('  function primeTakt()')
const block = quelle.slice(von, bis)

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Prime-Durchgang im Sandkasten\n')
pruefe('Block in amazon.js gefunden', von > 0 && bis > von)

const NARUTO = ['B0CWDYLZ1S', 'B0F3SHHVC2', 'B0DX7JQY9R', 'B0FBJWV6MJ', 'B0DX1XQ1W1', 'B0F5J96BX2', 'B0F9Z35RH6', 'B0FBKHYWCF', 'B07VP6VPVR']
const STAFFELN = NARUTO.map((kennung, i) => ({ kennung, nummer: i + 1 }))

function neuerSpeicher() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

/** Eine Sandkasten-Welt. `imFrame` wählt, welche Seite gespielt wird. */
function welt({ imFrame = false, speicher = neuerSpeicher() } = {}) {
  const w = { uhr: 1_000_000, geklickt: 0, neugeladen: 0, frames: [], gepostet: [] }
  const fenster = {}
  fenster.top = imFrame ? {} : fenster
  fenster.parent = { postMessage: (d) => w.gepostet.push(d) }
  const kontext = {
    Date: class extends Date {
      static now() {
        return w.uhr
      }
    },
    JSON,
    String,
    Boolean,
    Number,
    Object,
    window: fenster,
    sessionStorage: speicher,
    liste: {
      B07VP6VPVR: { titel: 'Naruto', url: 'https://www.amazon.de/gp/video/detail/B07VP6VPVR' },
      B07FB4D9KM: { titel: 'Yu-Gi-Oh!', url: 'https://www.amazon.de/gp/video/detail/B07FB4D9KM' },
      SUCHE: { titel: 'Anonymous Noise', url: 'https://www.amazon.de/s?k=Anonymous+Noise&i=instant-video' },
    },
    fertig: () => false,
    listenId: 'B07VP6VPVR',
    kennungAus: (url) => /\/detail\/([A-Z0-9]+)/.exec(url)?.[1] ?? null,
    gesehen: { seite: { staffeln: STAFFELN } },
    knopf: { textContent: '', style: { display: '' }, disabled: false, isConnected: true, click: () => w.geklickt++ },
    sendetGerade: false,
    letzteMeldung: null,
    verbindungLebt: () => true,
    asin: () => 'B07VP6VPVR',
    location: { origin: 'https://www.amazon.de', reload: () => w.neugeladen++ },
    document: {
      createElement: () => ({
        style: {},
        setAttribute() {},
        contentWindow: {},
        entfernt: false,
        remove() {
          this.entfernt = true
        },
      }),
      body: { appendChild: (el) => w.frames.push(el) },
    },
    notiere: () => {},
    suchOffen: () => ['s'],
    dialog: null,
    dialogUmschalten: () => {},
    uebersichtZeichnen: () => {},
    letzteSignatur: null,
  }
  vm.createContext(kontext)
  vm.runInContext(block, kontext)
  w.kontext = kontext
  w.lauf = () => vm.runInContext('primeLaufLesen()', kontext)
  w.ende = () => vm.runInContext('primeLaufEndeLesen()', kontext)
  w.offen = () => w.frames.filter((f) => !f.entfernt)
  /** Ein Frame meldet sein Ergebnis — so, wie `frameFertig()` es schickt. */
  w.ergebnis = (el, daten) => {
    kontext.__el = el
    kontext.__daten = { ok: true, grund: 'gemeldet', staffeln: [], ...daten }
    vm.runInContext('primeFrameErgebnis(__el, __daten)', kontext)
  }
  w.takt = (ms = 500) => {
    w.uhr += ms
    vm.runInContext(imFrame ? 'frameSchritt()' : 'primeKoordinieren()', kontext)
  }
  /** Knopf zeigt `text` für `ms`, der Frame-Takt läuft alle 500 ms. */
  w.zeige = (text, ms, sichtbar = true) => {
    kontext.knopf.textContent = text
    kontext.knopf.style.display = sichtbar ? '' : 'none'
    for (let t = 0; t <= ms; t += 500) w.takt(t ? 500 : 0)
  }
  return w
}

const kennung = (el) => /detail\/([A-Z0-9]+)/.exec(el.src)?.[1]

/* ---- Steuerung ---- */
{
  const w = welt()
  const k = w.kontext
  pruefe('Start auf Naruto S9: der Lauf beginnt mit diesem Titel', vm.runInContext('primeLaufStarten()', k) === true && w.lauf().titel === 'B07VP6VPVR')
  pruefe('bis die Staffelliste da ist: genau ein Frame, die Staffel der Liste', w.offen().length === 1 && kennung(w.offen()[0]) === 'B07VP6VPVR', w.offen().map(kennung))
  pruefe('der Frame trägt unseren Namen und spielt nichts ab', w.offen()[0].name === 'ak-durchgang' && /autoplay 'none'/.test(w.offen()[0].allow))

  w.ergebnis(w.offen()[0], { hier: 'B07VP6VPVR', staffeln: STAFFELN })
  pruefe('mit der Staffelliste: drei Frames gleichzeitig, Staffel 1–3', w.offen().map(kennung).join() === NARUTO.slice(0, 3).join(), w.offen().map(kennung))
  pruefe('der Plan hält die übrigen fünf', w.lauf().plan.length === 5, w.lauf().plan)

  w.ergebnis(w.offen()[1], { ok: false, grund: 'Knopf blieb bei: Staffel wechselt — einen Moment' })
  pruefe('ein Fehlschlag wird mit Staffelnummer übersprungen', w.lauf().uebersprungen.join() === 'Naruto · Staffel 2', w.lauf().uebersprungen)
  pruefe('… und sofort rückt die nächste Staffel nach', w.offen().length === 3 && w.offen().map(kennung).includes(NARUTO[3]))

  /* Ein Frame, der nie antwortet: nach 90 s entfernt. */
  const stumm = w.offen()[0]
  w.takt(91_000)
  pruefe('stumme Frames fliegen nach 90 s raus (hier alle drei, sie starteten zugleich)', stumm.entfernt && w.lauf().uebersprungen.length === 4, w.lauf().uebersprungen)

  while (w.offen().length && w.lauf()?.titel === 'B07VP6VPVR') w.ergebnis(w.offen()[0], {})
  pruefe('nach der letzten Naruto-Staffel: nächster Titel mit Titelseite, ein Frame', w.lauf().titel === 'B07FB4D9KM' && w.offen().length === 1 && kennung(w.offen()[0]) === 'B07FB4D9KM')
  pruefe('Naruto gilt im Lauf als fertig', w.lauf().fertig.includes('B07VP6VPVR'))

  w.ergebnis(w.offen()[0], { hier: 'B07FB4D9KM', staffeln: [] })
  pruefe('Titel ohne Staffelliste: eine Seite, dann Ende', w.lauf() === null)
  const ende = w.ende()
  pruefe('Suchaufträge werden nie geöffnet — Ende mit „nichts mehr offen"', ende?.grund === 'nichts mehr offen', ende)
  pruefe('das Ende nennt die übersprungenen Staffeln und die Suchaufträge', ende?.uebersprungen?.length === 4 && ende?.suchen === 1, ende)
  pruefe('insgesamt geöffnet: 9 Naruto-Seiten + 1 Yu-Gi-Oh!, keine doppelt', w.frames.length === 10 && new Set(w.frames.map(kennung)).size === 10, w.frames.map(kennung))
}

{
  /* Die sichtbare Seite wird neu geladen: ihre Frames sind weg, der Lauf nicht. */
  const speicher = neuerSpeicher()
  const a = welt({ speicher })
  vm.runInContext('primeLaufStarten()', a.kontext)
  a.ergebnis(a.offen()[0], { hier: 'B07VP6VPVR', staffeln: STAFFELN })
  const b = welt({ speicher })
  b.takt()
  pruefe('nach dem Neuladen: die laufenden Staffeln kommen zurück und öffnen neu', b.offen().map(kennung).join() === NARUTO.slice(0, 3).join(), b.offen().map(kennung))
}

{
  const w = welt()
  vm.runInContext('primeLaufStarten()', w.kontext)
  w.ergebnis(w.offen()[0], { ok: false, grund: 'kein Token' })
  pruefe('ohne Token endet der Lauf sofort und schließt alle Frames', w.lauf() === null && w.ende()?.grund === 'kein Token in den Optionen' && !w.offen().length, w.ende())
}

{
  const w = welt()
  w.kontext.listenId = 'irgendwas'
  vm.runInContext('primeLaufStarten()', w.kontext)
  pruefe('Start außerhalb eines Listentitels: erster Titel mit Titelseite, nicht die Suche', kennung(w.offen()[0]) === 'B07VP6VPVR', w.offen().map(kennung))
}

/* ---- Verdrahtung ---- */
{
  const manifest = JSON.parse(readFileSync(__dirname + '/manifest.json', 'utf8'))
  const amazon = manifest.content_scripts.filter((c) => c.js.includes('amazon.js') || c.js.includes('amazon-leser.js'))
  pruefe('Manifest: Leser und Melder laufen auch in Frames', amazon.length === 2 && amazon.every((c) => c.all_frames === true))
  const waechter = "window.top && window !== window.top && window.name !== 'ak-durchgang') return"
  pruefe('… aber nur in unseren (Name), nicht in Amazons Werbe-Frames', quelle.includes(waechter) && readFileSync(__dirname + '/amazon-leser.js', 'utf8').includes(waechter))
  pruefe('die Frame-Antwort läuft über den einen message-Hörer', /if \(e\?\.data\?\.marke === 'ak-prime-frame'\)/.test(quelle) && (quelle.match(/addEventListener\('message'/g) ?? []).length === 1)
}

/* ---- Automat im Frame ---- */
{
  const w = welt({ imFrame: true })
  const k = w.kontext
  w.zeige('Folgen werden geladen …', 500)
  w.zeige('Staffel wechselt — einen Moment', 500)
  pruefe('Frame: wechselnde Ladezustände, kein Klick', w.geklickt === 0)
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 0)
  pruefe('Frame: „melden" gerade erschienen, noch kein Klick', w.geklickt === 0)
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  pruefe('Frame: „melden" steht still, genau ein Klick', w.geklickt === 1)
  k.sendetGerade = true
  w.zeige('sende …', 1000)
  pruefe('Frame: solange gesendet wird, keine Antwort', !w.gepostet.length)
  k.letzteMeldung = { pfad: '/x', ok: true, am: w.uhr }
  k.sendetGerade = false
  w.zeige('trage ein …', 0, false)
  const d = w.gepostet[0]
  pruefe('Frame: der Handler sagt gemeldet, die Antwort geht an die Seite', d?.marke === 'ak-prime-frame' && d.ok === true && d.grund === 'gemeldet', d)
  pruefe('Frame: die Antwort trägt die Staffelliste', d?.staffeln?.length === 9 && d.staffeln[0].kennung === NARUTO[0], d?.staffeln)
  w.zeige('trage ein …', 3000, false)
  pruefe('Frame: nur eine Antwort je Seite', w.gepostet.length === 1)
}

{
  const w = welt({ imFrame: true })
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  w.zeige('trage ein …', 16_000, false)
  pruefe('Frame: Klick ohne Rückmeldung — nach 15 s als nicht gemeldet', w.gepostet[0]?.ok === false && /keine Rückmeldung/.test(w.gepostet[0].grund), w.gepostet[0])
}

{
  const w = welt({ imFrame: true })
  w.zeige('✓ Staffel 1 gemeldet · weiter mit Staffel 2', 5000)
  pruefe('Frame: schon gemeldete Staffel — kein Klick, als erledigt zurück', w.geklickt === 0 && w.gepostet[0]?.ok === true, w.gepostet[0])
}

{
  const w = welt({ imFrame: true })
  w.zeige('Staffel wechselt — einen Moment', 61_000)
  pruefe('Frame: hängt der Knopf eine Minute, geht „nicht gemeldet" zurück', w.gepostet[0]?.ok === false && /Knopf blieb bei/.test(w.gepostet[0].grund), w.gepostet[0])
}

{
  const speicher = neuerSpeicher()
  const a = welt({ imFrame: true, speicher })
  a.zeige('↻ Seite neu laden', 1000)
  pruefe('Frame: „↻" lädt einmal neu', a.neugeladen === 1 && !a.gepostet.length)
  const b = welt({ imFrame: true, speicher })
  b.zeige('↻ Seite neu laden', 1500)
  pruefe('Frame: … beim zweiten Mal nicht, sondern „nicht gemeldet"', b.neugeladen === 0 && b.gepostet[0]?.ok === false, b.gepostet[0])
}

{
  const w = welt({ imFrame: true })
  w.zeige('Kein Token — Rechtsklick aufs Symbol, dann Optionen', 1500)
  pruefe('Frame: ohne Token kommt „kein Token" zurück', w.gepostet[0]?.grund === 'kein Token', w.gepostet[0])
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Prime-Durchgang halten.')
