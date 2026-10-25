/**
 * Disney+: Pille und Knopf zählen dieselbe Zahl, auch wenn die Adressen aus dem Gedächtnis kommen (4.32.5, 24.10.2026).
 *
 * Daniel am 24.10.2026: Die Pille zeigte 7 Titel, der Knopf im geöffneten Tab 1. Die „nichts da"-Antworten vom
 * Nachmittag (15:30 UTC) lagen vor dem neuen Prüfstand (16:07 UTC) und durften nicht mehr gelten. `akVermerkGilt`
 * liest aber `akPruefstandAm`, und das füllt nur `akGemeldetSeit`, das `frischGemeldet` je Adresse ruft — nicht,
 * wenn die Adresse im Gedächtnis steht (30 Minuten, `disney-netz.js`). Ohne Prüfstandzeit galt der Vermerk gegen das
 * Eintragsdatum (26.08.) und damit immer.
 *
 * Geprüft wird durch Ausführen der echten Funktionen `istErledigt` und `briefkastenHolen` aus `disney.js` (aus dem
 * Quelltext geschnitten) mit den echten `pruefstand-zeit.js` und `disney-weg.js`; `frischGemeldet` ist die Kulisse
 * „alles im Gedächtnis": sie ruft `holen` nie.
 *
 * Aufruf: `node extension/disney-stand-memo.test.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const schneide = (quelle, name) => {
  const treffer = new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`).exec(quelle)
  if (!treffer) throw new Error(`${name}() nicht im Quelltext`)
  return treffer[0]
}

const PRUEFSTAND = '2026-10-24T16:07:00.000Z'
const JETZT = Date.parse('2026-10-24T18:40:00Z')
const URL_FIRE = 'https://www.disneyplus.com/de-de/browse/entity-fire'
const URL_OPM = 'https://www.disneyplus.com/de-de/browse/entity-opm'
const eintrag = (url) => ({ url, titel: url, seit: '2026-08-26', staffeln: [{ nr: 1, offen: true }] })

/** Eine frisch geladene Seite: Vermerke aus `vermerke` (Adresse → Zeit), Prüfstand je nach `stand`. */
async function seite(vermerke, stand) {
  const speicher = new Map(Object.entries({ 'ak-disney-weg': JSON.stringify(vermerke) }))
  const abrufe = []
  const k = vm.createContext({
    console,
    Date,
    localStorage: { getItem: (s) => speicher.get(s) ?? null, setItem: (s, v) => speicher.set(s, v) },
    briefkasten: new Map(),
    gemeldeteAdressen: new Set(),
    erneutBeantwortet: new Set(),
    wartetAufUebernahme: new Set(),
    liste: { f: eintrag(URL_FIRE), o: eintrag(URL_OPM) },
    WORKER: 'https://w.example/pruefung',
    gemeldeteHolen: async () => new Set(),
    fetch: async (adresse) => {
      abrufe.push(String(adresse))
      if (String(adresse).includes('stand=1')) return { ok: stand !== null, json: async () => ({ pruefstandAm: stand }) }
      return { ok: true, json: async () => ({ gemeldet: ['https://x/gemeldet'], adressen: [], eintraege: [] }) }
    },
  })
  k.globalThis = k
  vm.runInContext(lies('pruefstand-zeit.js'), k)
  vm.runInContext(lies('disney-weg.js'), k)
  /* Alles im Gedächtnis: `frischGemeldet` ruft `holen` (und damit `akGemeldetSeit`) nie. */
  k.AK_DISNEY_NETZ = { frischGemeldet: async () => new Set() }
  const quelle = lies('disney.js')
  vm.runInContext(`${schneide(quelle, 'istErledigt')}\n${schneide(quelle, 'offeneEintraege')}\n${schneide(quelle, 'briefkastenHolen')}`, k)
  /* `AK_DISNEY_WEG` der Seite rechnet mit der festen Uhr dieser Probe. */
  k.AK_DISNEY_WEG = k.akDisneyWeg({ dauer: k.localStorage, jetzt: () => JETZT })
  return { k, abrufe, offen: () => vm.runInContext('offeneEintraege().filter((e) => !istErledigt(e)).map((e) => e.url)', k) }
}

async function lauf() {
  const vorm = { [URL_FIRE]: '2026-10-24T15:30:19.000Z', [URL_OPM]: '2026-10-24T15:30:14.000Z' }
  const s1 = await seite(vorm, PRUEFSTAND)
  pruefe('vor dem Abruf: ohne Prüfstandzeit gelten die Nachmittags-Vermerke (alter Stand, nur zum Vergleich)', s1.offen().length === 0, s1.offen())
  await vm.runInContext('briefkastenHolen()', s1.k)
  pruefe('nach dem Abruf: Vermerke vor dem Prüfstand gelten nicht mehr, beide Titel offen', JSON.stringify(s1.offen().sort()) === JSON.stringify([URL_OPM, URL_FIRE].sort()), s1.offen())
  pruefe('die Antwort des Workers (gemeldet) wird weiter gelesen', vm.runInContext("gemeldeteAdressen.has('https://x/gemeldet')", s1.k), s1.abrufe)
  pruefe('der Abruf holt den Prüfstand selbst (einmal)', s1.abrufe.filter((a) => a.includes('stand=1')).length === 1, s1.abrufe)

  const nachm = { [URL_FIRE]: '2026-10-24T17:00:00.000Z', [URL_OPM]: '2026-10-24T15:30:14.000Z' }
  const s2 = await seite(nachm, PRUEFSTAND)
  await vm.runInContext('briefkastenHolen()', s2.k)
  pruefe('ein Vermerk nach dem Prüfstand gilt, einer davor nicht', JSON.stringify(s2.offen()) === JSON.stringify([URL_OPM]), s2.offen())

  const genau = await seite({ [URL_FIRE]: PRUEFSTAND, [URL_OPM]: '2026-10-24T16:06:59.000Z' }, PRUEFSTAND)
  await vm.runInContext('briefkastenHolen()', genau.k)
  pruefe('Grenze: genau zur Prüfstandzeit gilt, eine Sekunde davor nicht', JSON.stringify(genau.offen()) === JSON.stringify([URL_OPM]), genau.offen())

  const ohneNetz = await seite(vorm, null)
  await vm.runInContext('briefkastenHolen()', ohneNetz.k)
  pruefe('Prüfstand nicht abrufbar: es bleibt beim Eintragsdatum, die Vermerke gelten', ohneNetz.offen().length === 0, ohneNetz.offen())
}

lauf().then(() => {
  const rot = faelle.filter((ok) => !ok).length
  console.log(rot ? `disney-stand-memo: ${rot} von ${faelle.length} Fällen rot` : `disney-stand-memo: ${faelle.length} Fälle ok`)
  process.exit(rot ? 1 : 0)
})
