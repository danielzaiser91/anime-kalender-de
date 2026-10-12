/**
 * Schutz vor stummen Serverfehlern (12.10.2026): Riss das D1-Leselimit, antwortete der Worker mit 500
 * statt 429 mit `tageslimit`. Netflix lief weiter, Prime pausierte stumm. Jetzt pausiert `tageslimit.js`
 * nach drei 5xx in Folge auf Meldungen (POST) für 30 Minuten und nennt den Grund.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'
const POST = { method: 'POST' }
const antwortAus = (status) => ({ status, ok: status < 400, clone() { return this }, json: async () => { throw new Error('kein JSON') } })

/** Ein gemeinsamer Speicher wie `chrome.storage.local`; jeder Sandkasten ist ein Frame, der Änderungen der anderen hört. */
function speicherMit() {
  const daten = {}
  const frames = []
  return {
    daten,
    chromeFuer(hoerer) {
      frames.push(hoerer)
      return {
        storage: {
          local: {
            get: async () => ({ ...daten }),
            set: (werte) => {
              const aenderung = {}
              for (const [k, v] of Object.entries(werte)) {
                aenderung[k] = { oldValue: daten[k], newValue: v }
                daten[k] = v
              }
              for (const f of frames) if (f !== hoerer) f.forEach((fn) => fn(aenderung, 'local'))
            },
          },
          onChanged: { addListener: (fn) => hoerer.push(fn) },
        },
      }
    },
  }
}

/** Ein Frame: `tageslimit.js` mit einem `fetch`, das die Status der Reihe nach liefert. */
function frame(speicher, status, hostname) {
  const kontext = { Date, Intl, setTimeout, console, Promise, Number, Math, JSON, String, Object }
  kontext.globalThis = kontext
  if (hostname) kontext.location = { hostname }
  const rest = [...status]
  kontext.fetch = async () => antwortAus(rest.shift() ?? 200)
  if (speicher) kontext.chrome = speicher.chromeFuer([])
  vm.runInNewContext(readFileSync(__dirname + '/tageslimit.js', 'utf8'), kontext)
  return kontext
}

async function einFrame() {
  console.log('Serverfehler: Pause nach drei 5xx in Folge\n')
  {
    const k = frame(null, [500, 500, 500])
    await k.fetch(WORKER, POST)
    await k.fetch(WORKER, POST)
    pruefe('nach zwei 5xx gilt noch keine Pause', !k.AK_TAGESLIMIT.aktiv())
    await k.fetch(WORKER, POST)
    pruefe('die dritte 5xx in Folge pausiert', k.AK_TAGESLIMIT.aktiv())
    pruefe('Netflix/Disney+ enden: der Text sagt, dass neu gestartet werden muss', /^Server antwortet nicht, Durchgang ab \d\d:\d\d neu starten$/.test(k.AK_TAGESLIMIT.text()), k.AK_TAGESLIMIT.text())
    pruefe('Netflix-Weg: grund() liefert diesen Text statt „abgebrochen"', k.AK_TAGESLIMIT.grund('abgebrochen') === k.AK_TAGESLIMIT.text())
    const durchlauf = { abbruch: false }
    k.AK_TAGESLIMIT.fehlgeschlagen(durchlauf)
    pruefe('Netflix-Weg: der Durchgang hält an', durchlauf.abbruch === true)
    const plan = ['b']
    pruefe('Prime-Weg: die Staffel geht zurück in den Plan', k.AK_TAGESLIMIT.zurueckstellen(plan, 'a') === true && plan.join() === 'a,b', plan)
    pruefe('Prime-Pille: der Vorspann nennt den Grund', k.AK_TAGESLIMIT.vorspann() === `⏸ ${k.AK_TAGESLIMIT.text()} ·`, k.AK_TAGESLIMIT.vorspann())
  }
  {
    const k = frame(null, [500, 500, 500], 'www.amazon.de')
    for (let i = 0; i < 3; i++) await k.fetch(WORKER, POST)
    pruefe('Prime macht von allein weiter: "nächster Versuch"', /^Server antwortet nicht, nächster Versuch \d\d:\d\d$/.test(k.AK_TAGESLIMIT.text()), k.AK_TAGESLIMIT.text())
  }
  {
    const speicher = speicherMit()
    const k = frame(speicher, [500, 500, 500])
    k.AK_TAGESLIMIT.merken(3600)
    const bis = speicher.daten.akTageslimitBis
    for (let i = 0; i < 3; i++) await k.fetch(WORKER, POST)
    pruefe('Vorrang: bei aktivem Tageslimit ändern drei 5xx die Pause nicht', speicher.daten.akTageslimitBis === bis && /^Tageslimit erreicht/.test(k.AK_TAGESLIMIT.text()), { bis, jetzt: speicher.daten.akTageslimitBis, text: k.AK_TAGESLIMIT.text() })
  }
  {
    const k = frame(null, [500, 500, 200, 500, 500])
    for (let i = 0; i < 5; i++) await k.fetch(WORKER, POST)
    pruefe('ein Erfolg setzt den Zähler zurück: 500, 500, 200, 500, 500 pausiert nicht', !k.AK_TAGESLIMIT.aktiv())
  }
  {
    const k = frame(null, [503, 502, 504])
    for (let i = 0; i < 3; i++) await k.fetch(WORKER, POST)
    pruefe('jede 5xx zählt (503, 502, 504)', k.AK_TAGESLIMIT.aktiv())
  }
  {
    const k = frame(null, [500, 500, 500, 500, 500])
    for (let i = 0; i < 5; i++) await k.fetch(WORKER)
    pruefe('Lesen (GET, ?gemeldet=) zählt nicht', !k.AK_TAGESLIMIT.aktiv())
    for (let i = 0; i < 5; i++) await k.fetch('https://fremd.example/x', POST)
    pruefe('ein fremder Dienst zählt nicht', !k.AK_TAGESLIMIT.aktiv())
  }
  {
    const k = frame(null, [400, 400, 400, 404])
    for (let i = 0; i < 4; i++) await k.fetch(WORKER, POST)
    pruefe('4xx ohne 429 zählt nicht', !k.AK_TAGESLIMIT.aktiv())
  }
  {
    const k = frame(null, [500, 500, 500])
    for (let i = 0; i < 3; i++) await k.fetch(WORKER, POST)
    k.AK_TAGESLIMIT.merken(3600)
    pruefe('ein späteres Tageslimit ersetzt den Serverfehler-Text', /^Tageslimit erreicht/.test(k.AK_TAGESLIMIT.text()), k.AK_TAGESLIMIT.text())
  }
  {
    const speicher = speicherMit()
    const k = frame(speicher, [500, 500, 500])
    for (let i = 0; i < 3; i++) await k.fetch(WORKER, POST)
    const minuten = (speicher.daten.akTageslimitBis - Date.now()) / 60000
    pruefe('die Pause dauert 30 Minuten', minuten > 29.9 && minuten <= 30, minuten)
    pruefe('nach der Pause beginnt die Zählung neu (Reihe 0)', speicher.daten.akWorkerFehlerReihe === 0, speicher.daten)
  }
}

async function ueberFrames() {
  console.log('\nDie Reihe gilt über Frames hinweg (Prime sendet je Staffel aus einem eigenen Frame)')
  {
    const speicher = speicherMit()
    const frames = [frame(speicher, [500]), frame(speicher, [500]), frame(speicher, [500])]
    await new Promise((r) => setImmediate(r))
    await frames[0].fetch(WORKER, POST)
    await frames[1].fetch(WORKER, POST)
    pruefe('zwei Fehler in zwei Frames: noch keine Pause', !frames[2].AK_TAGESLIMIT.aktiv())
    await frames[2].fetch(WORKER, POST)
    pruefe('der dritte Fehler im dritten Frame pausiert', frames[2].AK_TAGESLIMIT.aktiv())
    pruefe('... und die anderen Frames wissen es', frames[0].AK_TAGESLIMIT.aktiv() && frames[1].AK_TAGESLIMIT.aktiv() && /^Server antwortet nicht/.test(frames[0].AK_TAGESLIMIT.text() ?? ''), frames[0].AK_TAGESLIMIT.text())
    const spaeter = frame(speicher, [])
    await new Promise((r) => setImmediate(r))
    pruefe('ein neuer Frame liest Pause und Grund aus dem Speicher', /^Server antwortet nicht/.test(spaeter.AK_TAGESLIMIT.text() ?? ''), spaeter.AK_TAGESLIMIT.text())
  }
  {
    const speicher = speicherMit()
    const a = frame(speicher, [500, 500])
    const b = frame(speicher, [200, 500])
    await new Promise((r) => setImmediate(r))
    await a.fetch(WORKER, POST)
    await a.fetch(WORKER, POST)
    await b.fetch(WORKER, POST)
    await b.fetch(WORKER, POST)
    pruefe('ein Erfolg in einem Frame setzt die Reihe für alle zurück', !a.AK_TAGESLIMIT.aktiv() && !b.AK_TAGESLIMIT.aktiv())
  }
}

async function haupt() {
  await einFrame()
  await ueberFrames()
  if (fehler.length) {
    console.error(`\n${fehler.length} Prüfung(en) fehlgeschlagen.`)
    process.exit(1)
  }
  console.log('\nAlles in Ordnung.')
}

haupt()
