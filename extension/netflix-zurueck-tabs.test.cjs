/**
 * Netflix: die Merkliste gehört allen Tabs, jeder Titel hat seinen eigenen Schlüssel (Issue 4071, Schnitt 3, Befund 8a).
 *
 * Vorher schrieb jeder Tab beim Ändern den ganzen Stand, den er beim Start gelesen hatte: Tab 3 stellte einen Titel zurück, Tab 1 schrieb danach
 * seinen älteren Stand und löschte die Zurückstellung von Tab 3 — die Knopfzahl sprang. Jetzt schreibt und löscht jeder Tab nur den Schlüssel seines
 * Titels und übernimmt Änderungen anderer Tabs über `onChanged`.
 *
 * Geprüft mit der echten `netflix-zurueckgestellt.js` und drei Tabs an einem gemeinsamen Speicher, der wie `chrome.storage.local` allen Tabs
 * (auch dem schreibenden) jede Änderung meldet.
 *
 * Aufruf: `node extension/netflix-zurueck-tabs.test.cjs`
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

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const datei of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) vm.runInContext(lies(datei), kontext)

const TAG = 24 * 3600 * 1000
const JETZT = Date.UTC(2026, 10, 17, 10, 0)
const kopie = (x) => JSON.parse(JSON.stringify(x))

/** Der gemeinsame Speicher: `get(null)` liefert alles, jede Änderung geht an alle Hörer (auch an den, der geschrieben hat). */
function gemeinsamerSpeicher(start = {}) {
  const s = { daten: kopie(start), hoerer: [] }
  const melden = (aenderungen) => s.hoerer.forEach((h) => h(aenderungen, 'local'))
  s.fuerTab = () => ({
    speicher: {
      get: async (k) => (k === null ? kopie(s.daten) : k in s.daten ? { [k]: kopie(s.daten[k]) } : {}),
      set: async (o) => {
        const a = Object.fromEntries(Object.entries(o).map(([k, w]) => [k, { oldValue: s.daten[k], newValue: kopie(w) }]))
        Object.assign(s.daten, kopie(o))
        melden(a)
      },
      remove: async (k) => {
        const a = { [k]: { oldValue: s.daten[k] } }
        delete s.daten[k]
        melden(a)
      },
    },
    beiAenderung: (fn) => s.hoerer.push(fn),
  })
  return s
}

const ID = ['1', '2', '3', '4', '5', '6']
/** Das Zustandsprotokoll (eines je Seite; hier alle Tabs in einem, in der Reihenfolge der Ereignisse). */
const protokoll = []
kontext.akProtokoll = (art, daten) => protokoll.push({ art, ...daten })

/** Ein Tab: eine Merkliste über dem gemeinsamen Speicher. */
async function tab(s, o = {}) {
  const titel = Object.fromEntries(ID.map((k) => [k, {}]))
  const geaendert = { n: 0 }
  const karte = kontext.akNetflixZurueckNeu(titel, () => false, { ...s.fuerTab(), jetzt: () => o.jetzt ?? JETZT, datum: () => null, geaendert: () => geaendert.n++ })
  await karte.geladen()
  return { karte, geaendert }
}
const warte = () => new Promise((r) => setImmediate(r))

async function teilZweiTabs() {
  const s = gemeinsamerSpeicher()
  const t1 = await tab(s)
  const t3 = await tab(s)
  protokoll.length = 0
  t3.karte.set('3', 'keine Folgenliste')
  await t3.karte.geladen()
  t1.karte.set('1', 'keine Folgenliste')
  await t1.karte.geladen()
  await warte()
  const frisch = await tab(s)
  pruefe('Tab 3 stellt Titel 3 zurück, Tab 1 danach Titel 1: ein neuer Tab sieht beide', frisch.karte.zurueckgestellt('1') && frisch.karte.zurueckgestellt('3'), s.daten)
  pruefe('Tab 1 übernimmt die Zurückstellung von Tab 3 sofort (onChanged), ohne neu zu laden', t1.karte.zurueckgestellt('3') === true)
  pruefe('Tab 3 übernimmt umgekehrt die von Tab 1', t3.karte.zurueckgestellt('1') === true && t3.karte.zurueckZahl() === 2, t3.karte.zurueckZahl())
  pruefe('Ein Tab, der eine fremde Änderung übernimmt, zeichnet die Zahlen neu (geaendert)', t1.geaendert.n >= 3, t1.geaendert.n)
  const kurz = protokoll.filter((e) => e.art === 'merkliste').map((e) => `${e.aenderung}:${e.kennung}`)
  pruefe('Protokoll: jede Schreibung einmal, jede fremde Änderung einmal im anderen Tab, die eigene nie als fremd', kurz.join() === 'gesetzt:3,fremd-gesetzt:3,gesetzt:1,fremd-gesetzt:1', kurz)
}

async function teilEntfernen() {
  const s = gemeinsamerSpeicher()
  const t1 = await tab(s)
  const t2 = await tab(s)
  t1.karte.set('1', 'keine Folgenliste')
  t1.karte.set('2', 'keine Folgenliste')
  await t1.karte.geladen()
  await warte()
  t2.karte.set('1', 'fertig')
  await t2.karte.geladen()
  await warte()
  pruefe('Ein Tab nimmt Titel 1 aus der Merkliste: nur dieser Schlüssel geht, Titel 2 bleibt', !t1.karte.zurueckgestellt('1') && t1.karte.zurueckgestellt('2') && t2.karte.zurueckgestellt('2'), s.daten)
  const spaeter = await tab(s, { jetzt: JETZT + 2 * TAG })
  await warte()
  pruefe('Läuft ein Eintrag ab, entfernt der Tab, der es merkt, nur diesen Schlüssel', !spaeter.karte.zurueckgestellt('2') && !Object.keys(s.daten).some((k) => k.includes('2')), s.daten)
  const alt = Object.keys(s.daten)
  pruefe('Im Speicher steht kein Sammelschlüssel mehr, nur ein Schlüssel je Titel', !alt.includes('netflixZurueckgestellt'), alt)
}

async function teilMigration() {
  const alt = { netflixZurueckgestellt: { 1: { grund: 'x', bis: JETZT + TAG }, 2: { grund: 'y', bis: JETZT + TAG } } }
  const s = gemeinsamerSpeicher(alt)
  protokoll.length = 0
  const t = await tab(s)
  await warte()
  pruefe('Die eigene Übernahme steht nicht als Änderung eines anderen Tabs im Protokoll', !protokoll.some((e) => /^fremd/.test(e.aenderung)), protokoll)
  pruefe('Der alte Sammelschlüssel (bis 17.11.2026) wird übernommen: beide Titel bleiben zurückgestellt', t.karte.zurueckgestellt('1') && t.karte.zurueckgestellt('2'), s.daten)
  pruefe('… und wandert in je einen Schlüssel, der alte verschwindet', !('netflixZurueckgestellt' in s.daten) && Object.keys(s.daten).length === 2, s.daten)
  const zweiter = await tab(s)
  pruefe('Ein zweiter Tab liest dasselbe', zweiter.karte.zurueckZahl() === 2)
  /* Steht ein Titel im alten und im neuen Schlüssel (ein Tab mit älterem Stand schrieb nach), gilt der neue. */
  const gemischt = gemeinsamerSpeicher({ ...alt, 'netflixZurueck:1': { grund: 'neu', bis: JETZT + 3 * TAG } })
  const g = await tab(gemischt)
  await warte()
  pruefe('Alt und neu für denselben Titel: der Schlüssel je Titel gilt, der alte Wert geht verloren', gemischt.daten['netflixZurueck:1']?.grund === 'neu' && g.karte.zurueckInfo('1')?.grund === 'neu', gemischt.daten)
}

async function haupt() {
  console.log('Netflix: Merkliste je Titel, mehrere Tabs (4071, Schnitt 3)')
  await teilZweiTabs()
  await teilEntfernen()
  await teilMigration()
  if (fehler.length) {
    console.log(`\n${fehler.length} Fall/Fälle rot`)
    process.exit(1)
  }
  console.log('\nMerkliste mehrere Tabs: alle Fälle grün')
}
haupt().catch((e) => {
  console.error(e)
  process.exit(1)
})
