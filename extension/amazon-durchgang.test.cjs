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
/*
  **Der Zustand des Durchgangs steht seit dem 28.09.2026 oben im Modul**, nicht mehr im Block:
  Der `message`-Hörer liest `IM_FRAME` und `primeFrames`, und ein `message`-Ereignis konnte
  eintreffen, bevor die `const`-Zeile erreicht war (`ReferenceError: Cannot access
  'primeFrames' before initialization`, Prime-Startseite). Für den Sandkasten wird der Block
  deshalb vorne angestellt — sonst prüft er einen Zustand, den es so nicht gibt.
*/
const zustandsBlock = (() => {
  const a = quelle.indexOf('  const PRIME_LAUF = ')
  const b = quelle.indexOf('  const primeFrames = new Map()')
  return a < 0 || b < 0 ? '' : quelle.slice(a, b + '  const primeFrames = new Map()'.length)
})()
/* Die Hilfen aus `prime-titelseite.js` laden laut Manifest vor `amazon.js` — hier vor dem Block. */
const hilfen = readFileSync(__dirname + '/prime-titelseite.js', 'utf8')
const gtiSprungAttrappe = 'var gtiSprungMerken = () => {}\n' // in amazon.js weit oben; die Gti-Prüfung unten ersetzt sie
const block = hilfen + '\n' + gtiSprungAttrappe + zustandsBlock + '\n' + quelle.slice(von, bis)

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Prime-Durchgang im Sandkasten\n')
pruefe('Block in amazon.js gefunden', von > 0 && bis > von)
pruefe('Zustandsblock in amazon.js gefunden', zustandsBlock.length > 0)
/*
  **Die Klasse, die den 28.09.2026 ausgelöst hat:** Ein `const` weiter unten, das ein Hörer
  schon vorher liest. Die Zusicherung hält die Reihenfolge fest — sie ist der Grund, warum der
  Zustand nicht zurück in den Block wandern darf.
*/
{
  const zeilen = quelle.split('\n')
  const zeileZustand = zeilen.findIndex((z) => z.includes('const primeFrames = new Map()')) + 1
  const zeileHoerer = zeilen.findIndex((z) => z.includes("window.addEventListener('message'")) + 1
  const zeileFrameHinweis = zeilen.findIndex((z) => z.includes('ak-prime-frame')) + 1
  pruefe(
    'der Zustand steht vor dem message-Hörer (sonst „Cannot access … before initialization")',
    zeileZustand > 0 && zeileHoerer > 0 && zeileZustand < zeileHoerer && zeileZustand < zeileFrameHinweis,
    `${zeileZustand} vor ${zeileHoerer}/${zeileFrameHinweis}`,
  )
}

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
  const w = { uhr: 1_000_000, geklickt: 0, neugeladen: 0, frames: [], gepostet: [], briefkasten: 0, gezeichnet: 0 }
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
    meldeSperre: { gesperrt: () => w.gesperrt === true },
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
    uebersichtZeichnen: () => w.gezeichnet++,
    frischGemeldet: new Set(),
    briefkastenHolen: () => {
      w.briefkasten++
      return Promise.resolve()
    },
    letzteSignatur: null,
  }
  vm.createContext(kontext)
  vm.runInContext(readFileSync(__dirname + '/prime-region.js', 'utf8'), kontext)
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

  /* Die Antwort kommt als `message` an, wie `frameFertig()` sie schickt — nur vom eigenen Frame und eigenen Ursprung. */
  const hoerer = vm.runInContext('primeHoerer', k)
  const antwort = (origin, source) => ({ data: { marke: 'ak-prime-frame', ok: true, grund: 'gemeldet', hier: 'B07VP6VPVR', staffeln: STAFFELN }, origin, source })
  hoerer(antwort('https://fremd.example', w.offen()[0].contentWindow))
  pruefe('Hörer: eine Antwort von fremdem Ursprung zählt nicht', w.lauf().seiten === 0 && w.offen().length === 1)
  hoerer(antwort('https://www.amazon.de', {}))
  pruefe('Hörer: eine Antwort eines fremden Fensters zählt nicht', w.lauf().seiten === 0 && w.offen().length === 1)
  hoerer(antwort('https://www.amazon.de', w.offen()[0].contentWindow))
  pruefe('Hörer: die Antwort des eigenen Frames zählt als Seite', w.lauf().seiten === 1)
  pruefe('mit der Staffelliste: drei Frames gleichzeitig, Staffel 1–3', w.offen().map(kennung).join() === NARUTO.slice(0, 3).join(), w.offen().map(kennung))
  pruefe('der Plan hält die übrigen fünf', w.lauf().plan.length === 5, w.lauf().plan)

  w.ergebnis(w.offen()[1], { ok: false, grund: 'Knopf blieb bei: Staffel wechselt — einen Moment' })
  pruefe('ein Fehlschlag wird mit Staffelnummer übersprungen', w.lauf().uebersprungen.join() === 'Naruto · Staffel 2 – Knopf blieb bei: Staffel wechselt — einen Moment', w.lauf().uebersprungen)
  pruefe('… und sofort rückt die nächste Staffel nach', w.offen().length === 3 && w.offen().map(kennung).includes(NARUTO[3]))

  /* Ein Frame, der nie antwortet: nach 90 s entfernt. */
  const stumm = w.offen()[0]
  w.takt(91_000)
  pruefe('stumme Frames fliegen nach 90 s raus (hier alle drei, sie starteten zugleich)', stumm.entfernt && w.lauf().uebersprungen.length === 4, w.lauf().uebersprungen)

  while (w.offen().length && w.lauf()?.titel === 'B07VP6VPVR') w.ergebnis(w.offen()[0], {})
  pruefe('nach der letzten Naruto-Staffel: nächster Titel mit Titelseite, ein Frame', w.lauf().titel === 'B07FB4D9KM' && w.offen().length === 1 && kennung(w.offen()[0]) === 'B07FB4D9KM')
  pruefe('Naruto gilt im Lauf als fertig', w.lauf().fertig.includes('B07VP6VPVR'))
  pruefe('der Knopf kennt den Fortschritt: 2 Titel mit Titelseite, 5 Seiten gemeldet (26.09.2026)', w.lauf().titelGesamt === 2 && w.lauf().seiten === 5, w.lauf())
  pruefe('… und wird nach jeder Seite neu gezeichnet', w.gezeichnet >= 9, w.gezeichnet)
  pruefe('eine Frame-Meldung gilt auf der sichtbaren Seite sofort als gemeldet — der Worker-Stand hinkt eine Minute nach (26.09.2026)', k.frischGemeldet.has('https://www.amazon.de/gp/video/detail/B07VP6VPVR'), [...k.frischGemeldet])

  w.ergebnis(w.offen()[0], { hier: 'B07FB4D9KM', staffeln: [] })
  pruefe('Titel ohne Staffelliste: eine Seite, dann Ende', w.lauf() === null)
  const ende = w.ende()
  pruefe('Suchaufträge werden nie geöffnet — Ende mit „nichts mehr offen"', ende?.grund === 'nichts mehr offen', ende)
  pruefe('das Ende nennt die übersprungenen Staffeln und die Suchaufträge', ende?.uebersprungen?.length === 4 && ende?.suchen === 1, ende)
  pruefe('am Ende holt die Seite den Briefkasten neu — sonst „nur auf diesem Rechner“ (26.09.2026)', w.briefkasten === 1, w.briefkasten)
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

/* ---- Titel unter JustWatchs gti (11.10.2026) ---- */
{
  const GTI = 'amzn1.dv.gti.a42a7992-811d-4616-8b19-e160276b57ad'
  const ZWEITE = 'B0AAAAAAA2'
  const w = welt()
  const k = w.kontext
  k.liste = {
    [GTI]: { titel: 'Antiks', url: `https://watch.amazon.de/detail?gti=${GTI}` },
    SUCHE: { titel: 'Anonymous Noise', url: 'https://www.amazon.de/s?k=Anonymous+Noise&i=instant-video' },
  }
  k.listenId = 'irgendwas'
  const gemerkt = []
  k.gtiSprungMerken = (g) => gemerkt.push(g)
  pruefe('gti-Titel zählen als Titel mit Titelseite, die Suche nicht', vm.runInContext('primeLaufStarten()', k) === true && w.lauf().titelGesamt === 1, w.lauf())
  pruefe('der erste Frame geht über watch.amazon.de/detail?gti=…', w.offen().length === 1 && w.offen()[0].src === `https://watch.amazon.de/detail?gti=${GTI}`, w.offen().map((f) => f.src))
  pruefe('… und merkt sich den Auftrag wie der Klick in der Prüfliste', gemerkt.join() === GTI, gemerkt)
  w.ergebnis(w.offen()[0], { hier: 'B0REDIRECT1', staffeln: [{ kennung: 'B0REDIRECT1', nummer: 1 }, { kennung: ZWEITE, nummer: 2 }] })
  pruefe('weitere Staffeln laufen über ihre ASIN, die Zielseite des ersten Frames nicht doppelt', w.offen().length === 1 && w.offen()[0].src === `https://www.amazon.de/gp/video/detail/${ZWEITE}`, w.offen().map((f) => f.src))
  pruefe('der Auftrag wird nur für den ersten Frame gemerkt', gemerkt.length === 1, gemerkt)
  w.ergebnis(w.offen()[0], {})
  pruefe('danach endet der Lauf: die Suche wird nie geöffnet', w.lauf() === null && w.ende()?.grund === 'nichts mehr offen' && w.frames.length === 2, w.frames.map((f) => f.src))
}

{
  /* Jeder Eintrag der echten Prüfliste hat eine Titelseite oder ist eine Suche — eine dritte Form fiele sonst lautlos heraus. */
  const roh = readFileSync(__dirname + '/offene-amazon.js', 'utf8')
  const huelle = {}
  vm.runInNewContext(roh, huelle)
  const eintraege = Object.values(huelle.AK_OFFENE_AMAZON ?? {})
  const ohne = eintraege.filter((e) => !/\/detail(?:\/|\?gti=)/.test(e.url) && !/\/s\?k=/.test(e.url))
  pruefe('Prüfliste: jeder Eintrag hat eine Titelseite oder eine Suchadresse', eintraege.length > 0 && ohne.length === 0, ohne.slice(0, 3))
}

/* ---- Verdrahtung ---- */
{
  const manifest = JSON.parse(readFileSync(__dirname + '/manifest.json', 'utf8'))
  const hilfen = manifest.content_scripts.find((c) => c.js.includes('amazon.js')).js
  pruefe('Manifest: prime-titelseite.js lädt vor amazon.js', hilfen.indexOf('prime-titelseite.js') > 0 && hilfen.indexOf('prime-titelseite.js') < hilfen.indexOf('amazon.js'), hilfen)
  const amazon = manifest.content_scripts.filter((c) => c.js.includes('amazon.js') || c.js.includes('amazon-leser.js'))
  pruefe('Manifest: Leser und Melder laufen auch in Frames', amazon.length === 2 && amazon.every((c) => c.all_frames === true))
  const waechter = "window.top && window !== window.top && window.name !== 'ak-durchgang') return"
  pruefe('… aber nur in unseren (Name), nicht in Amazons Werbe-Frames', quelle.includes(waechter) && readFileSync(__dirname + '/amazon-leser.js', 'utf8').includes(waechter))
  /*
    **Hörer und Takt stehen vor dem Warten auf eine Titel-Kennung** (11.10.2026). Die Startseite hat nie eine:
    Das Skript wartete dort fünf Minuten und stieg dann aus, `primeTakt` und der Hörer wurden nie angemeldet,
    und "alle durchgehen" stand ewig auf "Titel 1/116 · 0 Seiten gemeldet". Der Hauptlistener bleibt der
    eine für den Leser (die Sandkästen führen einen Hörer je Art, der letzte gilt) und übergeht die Antwort.
  */
  const zeilen = quelle.split('\n')
  const zeileWarten = zeilen.findIndex((z) => z.includes('id = await new Promise')) + 1
  const zeileHoerer = zeilen.findIndex((z) => z.includes("window.addEventListener('message', primeHoerer)")) + 1
  const zeileTakt = zeilen.findIndex((z) => z.trim() === 'if (!IM_FRAME) setTimeout(primeTakt, 500)') + 1
  pruefe('der Durchgangs-Hörer steht vor dem Warten auf die Kennung', zeileHoerer > 0 && zeileHoerer < zeileWarten, `${zeileHoerer} vor ${zeileWarten}`)
  /* Auf der Seite vor dem Warten; im Frame erst hinten, nach der Initialisierung — den Lauf prüft amazon-durchgang-takt.test.cjs. */
  pruefe('der Takt startet auf der Seite vor dem Warten, im Frame erst am Ende des Skripts', zeileTakt > 0 && zeileTakt < zeileWarten && /\n {2}if \(IM_FRAME\) setTimeout\(primeTakt, 500\)\n\}\)\(\)/.test(quelle), `${zeileTakt} vor ${zeileWarten}`)
  pruefe('der Hauptlistener übergeht die Frame-Antwort', /if \(e\?\.data\?\.marke === 'ak-prime-frame'\) return/.test(quelle))
  pruefe('der Bericht nennt „noch nicht angelegt“ statt eines Fehlers, solange die Seite wartet', /before initialization\/\.test\(e\?\.message\)/.test(quelle))
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
  pruefe('Frame: Klick, den der Handler gar nicht beantwortet (echtes Ausbleiben) — nach 15 s als nicht gemeldet', w.gepostet[0]?.ok === false && /keine Rückmeldung/.test(w.gepostet[0].grund), w.gepostet[0])
}

{
  const w = welt({ imFrame: true })
  w.kontext.letzteMeldung = { pfad: '/x', ok: false, am: w.uhr - 5000, abgewiesen: 'alt, vor dem Klick' }
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  w.zeige('trage ein …', 16_000, false)
  pruefe('Frame: eine Abweisung von vor dem Klick zählt nicht', /keine Rückmeldung/.test(w.gepostet[0]?.grund ?? ''), w.gepostet[0])
}

/* Bewusster Ausstieg des Klicks: der Grund geht sofort zurück, nicht erst nach 15 s als „keine Rückmeldung“. */
/* Die zweite `zeige`-Zeile ist der Takt, der den Ausstieg liest; ihr Text darf die Sperre „nur der sichtbare Knopf
   spricht“ nicht auslösen. Beide Texte, die der Knopf heute anzeigt, laufen durch: der erste steht in amazon.js, der zweite
   kommt aus akPrimeLeseStand (prime-region.js, mit „für“). */
const regionQuelle = readFileSync(__dirname + '/prime-region.js', 'utf8')
for (const [text, teil, ort] of [
  ['75 von 99 Folgen gelesen — 24 fehlen noch', '} fehlen noch`', quelle],
  ['75 von 99 Folgen gelesen — für „kein Deutsch" fehlen 24', 'Folgen gelesen — für „kein Deutsch" fehlen ${Math.max(0, sollFolgen - geladen - gesperrt)}`', regionQuelle],
]) {
  pruefe(`Frame: der Knopftext steht so im Quelltext (${teil})`, ort.includes(teil))
  const w = welt({ imFrame: true })
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  w.kontext.letzteMeldung = { pfad: '/x', ok: false, am: w.uhr, abgewiesen: 'Staffel nicht vollständig gelesen' }
  pruefe(`Frame: vor dem Takt keine Antwort (${text})`, !w.gepostet.length)
  w.zeige(text, 500)
  const d = w.gepostet[0]
  pruefe(`Frame: abgewiesener Klick → sofort „nicht gesendet: <Grund>" (${text})`, d?.ok === false && d.grund === 'nicht gesendet: Staffel nicht vollständig gelesen', d)
  pruefe('Frame: … und ohne 15 s Wartezeit', w.uhr - 1_000_000 < 5000 && !/keine Rückmeldung/.test(d?.grund ?? ''), w.uhr)
}

/* Gesperrte Lage bei sichtbarem „melden“ (mitSperre würde den Klick schlucken): sofort „schon gemeldet“, kein Klick, kein 15-s-Warten. */
{
  const w = welt({ imFrame: true })
  w.gesperrt = true
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  const d = w.gepostet[0]
  pruefe('Frame: gesperrte Lage → kein Klick', w.geklickt === 0, w.geklickt)
  pruefe('Frame: gesperrte Lage → sofort ok „schon gemeldet“', d?.ok === true && d.grund === 'schon gemeldet', d)
  pruefe('Frame: gesperrte Lage → ohne 15 s Wartezeit', w.uhr - 1_000_000 < 5000, w.uhr)
}

{
  const w = welt({ imFrame: true })
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  w.kontext.letzteMeldung = { pfad: '/x', ok: true, am: w.uhr, abgewiesen: 'schon gemeldet' }
  w.zeige('✓ Staffel 9 gemeldet', 500)
  const d = w.gepostet[0]
  pruefe('Frame: Ausstieg „schon gemeldet" → ok, nicht als Fehler', d?.ok === true && d.grund === 'schon gemeldet', d)
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

/* Fushigi Yûgi Staffel 1 (31.10.2026): die Marke kam erst in der letzten Sekunde vor der Frist — das ist gemeldet, nicht gescheitert. */
{
  const w = welt({ imFrame: true })
  w.zeige('Staffel wechselt — einen Moment', 59_500)
  pruefe('Frame: vor der Frist noch keine Antwort', !w.gepostet.length, w.gepostet)
  w.zeige('gemeldet ✓', 1500)
  pruefe('Frame: Marke „gemeldet ✓" erst an der Frist → ok, nicht „Knopf blieb bei"', w.gepostet[0]?.ok === true && /schon gemeldet/.test(w.gepostet[0].grund), w.gepostet[0])
}

/* Dragon Quest: The Adventure of Dai (31.10.2026): 75 von 100 gelesen — der Grund nennt die fehlenden Folgen, die Spur die Abschnitte. */
{
  const w = welt({ imFrame: true })
  const nummern = new Set([...Array(72).keys()].map((i) => i + 1).concat([98, 99, 100]))
  const log = [
    { token: 'a', status: 200, roh: 24, gelesen: 24, von: 49, bis: 72 },
    { token: 'd', status: 200, roh: 25, gelesen: 0, kollisionen: 25, von: 73, bis: 97 },
  ]
  w.kontext.gesehen = { seite: { staffeln: [] }, gesamt: 100, nummern, abschnitte: { gesamt: 5, offen: 0, log } }
  w.zeige('75 Folgen gelesen — mehr zeigt die Seite nicht', 61_000)
  const d = w.gepostet[0]
  pruefe('Frame: Frist mit Lücke → nicht ok, Grund nennt Folge 73–97', d?.ok === false && /von 100 fehlen Folge 73–97/.test(d.grund), d)
  pruefe('Frame: … und die Abschnitte stehen in der Meldung', d?.abschnitte?.[1] === '73–97: 0/25, HTTP 200, 25 Kollision', d?.abschnitte)
}

/* Die Steuerung nimmt Grund und Abschnitte in Spur und Endanzeige. */
{
  const w = welt()
  vm.runInContext('primeLaufStarten()', w.kontext)
  w.ergebnis(w.offen()[0], { ok: false, grund: 'Knopf blieb bei: 75 Folgen gelesen (von 100 fehlen Folge 73–97)', abschnitte: ['73–97: 0/25, HTTP 200'], staffeln: [] })
  pruefe('Steuerung: der Eintrag nennt den Grund', /^Naruto – Knopf blieb bei: 75 Folgen gelesen \(von 100 fehlen Folge 73–97\)$/.test(w.lauf().uebersprungen[0]), w.lauf().uebersprungen)
  pruefe('Steuerung: die Spur trägt die Abschnitte', w.lauf().spur.some((s) => s.was === 'seite' && s.abschnitte?.[0] === '73–97: 0/25, HTTP 200'), w.lauf().spur)
  pruefe('Endanzeige: Titel und Grund stehen in der Liste', /offen \(Fehler beim Melden\): Naruto – Knopf blieb bei: 75 Folgen/.test(w.kontext.akPrimeEndeText({ grund: 'nichts mehr offen', uebersprungen: w.lauf().uebersprungen, suchen: 0 })))
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

{
  /*
    **Ein Fehler in einem Takt beendet die Kette nicht** (29.09.2026). Daniel sah den Durchgang auf
    „Titel 1/3 · 0 Seiten gemeldet" stehen — Ursache war die Reihenfolge in `primeTakt`: Warf
    `frameSchritt()`/`primeKoordinieren()` einmal, wurde `setTimeout` nie erreicht, es gab keinen
    nächsten Takt, und nichts sagte warum. Der Sandkasten kann das nicht auslösen (sein Ausschnitt
    endet vor `primeTakt`), deshalb wird der Quelltext geprüft.
  */
  pruefe(
    'der Takt wird auch nach einem Fehler neu gestellt',
    /finally \{\s*setTimeout\(primeTakt, 500\)/.test(quelle),
  )
  pruefe('der Fehler wird sichtbar statt lautlos weiterzulaufen', /Takt wirft/.test(quelle))
}

/* ---- Tageslimit im Frame (13.10.2026): „Fehler 429" auf der letzten Seite ist kein Überspringen ---- */
{
  /** `tageslimit.js` in einem eigenen Sandkasten; `limitSekunden`: die Pause, die dieser Tab schon kennt. */
  const limitFuer = (limitSekunden) => {
    const k = { Date, Intl, setTimeout, console, Promise, Number, Math, JSON, String, fetch: async () => ({ status: 200 }) }
    k.globalThis = k
    vm.runInNewContext(readFileSync(__dirname + '/tageslimit.js', 'utf8'), k)
    if (limitSekunden) k.AK_TAGESLIMIT.merken(limitSekunden)
    return k.AK_TAGESLIMIT
  }
  const frame = welt({ imFrame: true })
  frame.kontext.AK_TAGESLIMIT = limitFuer(3600)
  frame.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1500)
  frame.kontext.letzteMeldung = { pfad: '/x', ok: false, am: frame.uhr }
  frame.zeige('Fehler 429', 500)
  const antwort = frame.gepostet[0]
  pruefe('Frame am Limit: die Antwort trägt die Pause, die er sah', antwort?.ok === false && antwort.limit?.sekunden > 3590, antwort)

  const seite = welt()
  seite.kontext.AK_TAGESLIMIT = limitFuer(0)
  vm.runInContext('primeLaufStarten()', seite.kontext)
  const hoerer = vm.runInContext('primeHoerer', seite.kontext)
  pruefe('Seite kennt das Limit noch nicht (Speicher nicht angekommen)', !seite.kontext.AK_TAGESLIMIT.aktiv())
  hoerer({ data: antwort, origin: 'https://www.amazon.de', source: seite.offen()[0].contentWindow })
  pruefe('Antwort „Fehler 429": die Staffel wird nicht übersprungen', seite.lauf().uebersprungen.length === 0, seite.lauf().uebersprungen)
  pruefe('… sondern geht zurück an den Anfang des Plans und wird nach dem Limit nachgeholt', seite.lauf().plan[0] === 'B07VP6VPVR', seite.lauf().plan)
  pruefe('… die Seite pausiert und öffnet keinen Frame mehr', seite.kontext.AK_TAGESLIMIT.aktiv() && seite.offen().length === 0, seite.offen().length)
  const spurSeite = seite.lauf().spur.find((s) => s.was === 'seite')
  pruefe('… und die Spur nennt das Tageslimit statt „Fehler 429"', /^Tageslimit erreicht/.test(spurSeite?.grund ?? ''), spurSeite)

  const ohne = welt()
  ohne.kontext.AK_TAGESLIMIT = limitFuer(0)
  vm.runInContext('primeLaufStarten()', ohne.kontext)
  vm.runInContext('primeHoerer', ohne.kontext)({ data: { ...antwort, limit: null }, origin: 'https://www.amazon.de', source: ohne.offen()[0].contentWindow })
  pruefe('Gegenprobe: ein Fehler ohne Limit bleibt „übersprungen" (wie bisher)', ohne.lauf().uebersprungen.length === 1 && !ohne.kontext.AK_TAGESLIMIT.aktiv(), ohne.lauf().uebersprungen)
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Prime-Durchgang halten.')
