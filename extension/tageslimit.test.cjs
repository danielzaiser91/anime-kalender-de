/**
 * Das Tageslimit des Workers (11.10.2026) im Sandkasten: `tageslimit.js` erkennt die 429 des Workers,
 * der Disney+-Durchgang und das Senden halten an, Netflix und Prime fragen `aktiv()`.
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
const antwortAus = (status, inhalt) => ({
  status,
  ok: status < 400,
  clone() {
    return this
  },
  json: async () => {
    if (inhalt === undefined) throw new Error('kein JSON')
    return inhalt
  },
})

function sandkasten(antwort) {
  const kontext = { Date, Intl, setTimeout, console, Promise, Number, Math, JSON, String }
  kontext.globalThis = kontext
  kontext.fetch = async () => antwort
  vm.runInNewContext(readFileSync(__dirname + '/tageslimit.js', 'utf8'), kontext)
  return kontext
}

async function erkennung() {
  console.log('Tageslimit im Sandkasten\n')
  {
    const k = sandkasten(antwortAus(429, { tageslimit: true, retryAfter: 3600 }))
    pruefe('ohne 429 gilt kein Limit', !k.AK_TAGESLIMIT.aktiv() && k.AK_TAGESLIMIT.text() === null)
    await k.fetch(WORKER, { method: 'POST' })
    pruefe('429 mit tageslimit vom Worker setzt das Limit', k.AK_TAGESLIMIT.aktiv())
    pruefe('der Hinweis nennt die Uhrzeit', /^Tageslimit erreicht, weiter ab \d\d:\d\d$/.test(k.AK_TAGESLIMIT.text()), k.AK_TAGESLIMIT.text())
    pruefe('grund() liefert das Limit statt des üblichen Grundes', k.AK_TAGESLIMIT.grund('abgebrochen') === k.AK_TAGESLIMIT.text())
    const durchlauf = { abbruch: false }
    pruefe('fehlgeschlagen() gibt false zurück ...', k.AK_TAGESLIMIT.fehlgeschlagen(durchlauf) === false)
    pruefe('... und hält den Durchgang an', durchlauf.abbruch === true)
    const planMit = ['b']
    pruefe('Prime: am Limit geht die Staffel zurück an den Anfang des Plans (wird nachgeholt)', k.AK_TAGESLIMIT.zurueckstellen(planMit, 'a') === true && planMit.join() === 'a,b', planMit)
  }
  {
    const k = sandkasten(antwortAus(429, { tageslimit: true, retryAfter: 3600 }))
    await k.fetch('https://fremd.example/x')
    pruefe('eine 429 eines fremden Dienstes zählt nicht', !k.AK_TAGESLIMIT.aktiv())
  }
  {
    const k = sandkasten(antwortAus(429, undefined))
    await k.fetch(WORKER)
    pruefe('eine 429 ohne unser JSON (Cloudflare) zählt nicht', !k.AK_TAGESLIMIT.aktiv())
    const durchlauf = { abbruch: false }
    k.AK_TAGESLIMIT.fehlgeschlagen(durchlauf)
    pruefe('ohne Limit bleibt der Durchgang unberührt', durchlauf.abbruch === false)
    const planOhne = ['b']
    pruefe('Prime: ohne Limit bleibt der Plan, die Staffel gilt als übersprungen', k.AK_TAGESLIMIT.zurueckstellen(planOhne, 'a') === false && planOhne.join() === 'b')
  }
  {
    const k = sandkasten(antwortAus(200, { tageslimit: true, retryAfter: 3600 }))
    await k.fetch(WORKER)
    pruefe('nur der Status 429 wird gelesen', !k.AK_TAGESLIMIT.aktiv())
  }
  await frameAntwort()
}

/** Prime (13.10.2026): Die Antwort eines Frames trägt das Limit, das er sah; die Seite übernimmt es sofort. */
async function frameAntwort() {
  const imFrame = sandkasten(antwortAus(429, { tageslimit: true, retryAfter: 3600 }))
  pruefe('Frame ohne Limit: rest() ist null', imFrame.AK_TAGESLIMIT.rest() === null)
  await imFrame.fetch(WORKER, { method: 'POST' })
  const rest = imFrame.AK_TAGESLIMIT.rest()
  pruefe('Frame mit Limit: rest() nennt Sekunden (≤ 3600) und Art', rest.sekunden > 3590 && rest.sekunden <= 3600 && rest.art === null, rest)

  const seite = sandkasten(antwortAus(200, {}))
  const daten = { ok: false, grund: 'Fehler: Fehler 429', limit: rest }
  pruefe('Seite ohne Wissen vom Limit (Speicher noch nicht angekommen): aktiv() ist falsch', !seite.AK_TAGESLIMIT.aktiv())
  const plan = ['b']
  const uebernommen = seite.AK_TAGESLIMIT.ausFrame(daten)
  pruefe('ausFrame: gilt die Pause hier ab sofort', seite.AK_TAGESLIMIT.aktiv())
  pruefe('ausFrame: der Grund nennt das Tageslimit statt „Fehler 429"', /^Tageslimit erreicht, weiter ab \d\d:\d\d$/.test(uebernommen.grund), uebernommen.grund)
  pruefe('ausFrame: die Staffel wird zurückgestellt, nicht übersprungen', seite.AK_TAGESLIMIT.zurueckstellen(plan, 'a') === true && plan.join() === 'a,b', plan)
  pruefe('ausFrame: ein Erfolg bleibt unverändert (Grund „gemeldet")', seite.AK_TAGESLIMIT.ausFrame({ ok: true, grund: 'gemeldet', limit: rest }).grund === 'gemeldet')
  const ohne = sandkasten(antwortAus(200, {}))
  const unveraendert = { ok: false, grund: 'Knopf blieb bei: x', limit: null }
  pruefe('Gegenprobe: ohne Limit im Frame bleibt Antwort und Zustand unverändert', ohne.AK_TAGESLIMIT.ausFrame(unveraendert) === unveraendert && !ohne.AK_TAGESLIMIT.aktiv())
}

async function senden() {
  console.log('\nSenden und Disney+-Durchgang halten an')
  {
    const k = sandkasten(antwortAus(429, { tageslimit: true, retryAfter: 3600 }))
    vm.runInNewContext(readFileSync(__dirname + '/disney-netz.js', 'utf8'), k)
    let aufrufe = 0
    /* Wie im Betrieb: der Standardweg ruft das (umhüllte) globale fetch. */
    const holen = async (...a) => {
      aufrufe++
      return k.fetch(...a)
    }
    const r = await k.AK_DISNEY_NETZ.sende(WORKER, { body: '{}' }, { holen, pause: 0, warte: async () => {} })
    pruefe('eine Tageslimit-429 wird nicht wiederholt', r.ok === false && aufrufe === 1, { r, aufrufe })
    k.AK_TAGESLIMIT.merken(3600)
    const r2 = await k.AK_DISNEY_NETZ.sende(WORKER, { body: '{}' }, { holen, pause: 0, warte: async () => {} })
    pruefe('bei aktivem Limit geht gar keine Anfrage mehr raus', r2.ok === false && aufrufe === 1 && /Tageslimit/.test(r2.fehler), { r2, aufrufe })

    const kd = { JSON, globalThis: {} }
    kd.globalThis = kd
    vm.runInNewContext(readFileSync(__dirname + '/disney-durchgang.js', 'utf8'), kd)
    const m = new Map()
    const w = { geoeffnet: [], ende: null, grenze: null }
    const A = { id: 'a', url: 'https://www.disneyplus.com/series/a/1' }
    const B = { id: 'b', url: 'https://www.disneyplus.com/series/b/2' }
    const lauf = kd.akDisneyDurchgang({
      speicher: { getItem: (s) => (m.has(s) ? m.get(s) : null), setItem: (s, v) => m.set(s, String(v)), removeItem: (s) => m.delete(s) },
      jetzt: () => 1_000_000,
      offene: () => [A, B],
      oeffne: (e) => w.geoeffnet.push(e.url),
      melde: () => {},
      ende: (info) => (w.ende = info),
      limit: () => w.grenze,
    })
    lauf.starten()
    lauf.geprueft({ url: A.url, zuMelden: 5 })
    w.grenze = 'Tageslimit erreicht, weiter ab 02:00'
    lauf.gemeldet({ ok: false })
    pruefe('Meldung scheitert am Limit: der Durchgang endet, öffnet keinen weiteren Titel', w.geoeffnet.length === 1 && w.ende?.grund === w.grenze, w)
    pruefe('die Endanzeige nennt das Limit', /Tageslimit erreicht, weiter ab 02:00/.test(kd.akDisneyEndeText(w.ende, (u) => u)), kd.akDisneyEndeText(w.ende, (u) => u))
    const w2 = { geoeffnet: [], ende: null }
    const lauf2 = kd.akDisneyDurchgang({
      speicher: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      jetzt: () => 1_000_000,
      offene: () => [A],
      oeffne: (e) => w2.geoeffnet.push(e.url),
      melde: () => {},
      ende: (info) => (w2.ende = info),
      limit: () => 'Tageslimit erreicht, weiter ab 02:00',
    })
    lauf2.starten()
    pruefe('bei aktivem Limit startet der Durchgang gar nicht erst', w2.geoeffnet.length === 0 && w2.ende?.grund.startsWith('Tageslimit'), w2)
  }

}

async function haupt() {
  await erkennung()
  await senden()
  if (fehler.length) {
    console.error(`\n${fehler.length} Prüfung(en) fehlgeschlagen.`)
    process.exit(1)
  }
  console.log('\nAlles in Ordnung.')
}

haupt()
