/**
 * **Statusanzeige (Worker) und Erweiterungsknopf zählen Disney+ gleich, auch mit veraltetem Paket** (29.10.2026).
 *
 * Anlass (Daniel, dritte Wiederholung nach Prime, PR 2337): Der Knopf zählte aus `AK_OFFENE_DISNEY`, beim Packen
 * eingefroren; am Worker-Stand vom 29.10.2026 fehlten einem älteren Paket 3 von 8 Zielen. Hier rechnet
 * `berechnePruefstand` (Attrappe) die Titelzahl; die echten `istErledigt`, `offeneEintraege` und `briefkastenHolen` aus
 * `extension/disney.js` laufen im Sandkasten (mit `disney-stand-ziele.js`, `pruefstand-zeit.js`, `disney-weg.js`) gegen ein
 * Paket, das nur einen Teil der Ziele kennt. Die acht Ziele sind wörtlich der Worker-Stand vom 29.10.2026.
 *
 * Aufruf: `npx tsx tools/worker-disney-zahl-gleich.test.ts [Ordner der Erweiterung]` (der Ordner dient der Gegenprobe am alten Stand).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { rechnePruefstand, type Anbieter, type Zeile } from './worker-pruefstand-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const ordner = process.argv[2] ?? new URL('../extension', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const lies = (datei: string) => readFileSync(join(ordner, datei), 'utf8')
const FEST = Date.parse('2026-10-29T12:00:00Z')
const ERZEUGT = '2026-10-29T06:00:00.000Z'

const ZIELE = [
  { url: 'https://www.disneyplus.com/de-de/series/bleach-thousand-year-blood-war/4Afet1Q421gy', titel: 'Bleach: Thousand-Year Blood War', seit: '2026-10-15' },
  { url: 'https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51', titel: 'Welcome to Demon School! Iruma-kun' },
  { url: 'https://www.disneyplus.com/de-de/browse/entity-5973d358-1997-47d0-942d-e85b455ed9db', titel: 'Fire Force: Staffel 3', seit: '2026-08-26' },
  { url: 'https://www.disneyplus.com/de-de/browse/entity-54a25fcf-a472-4d40-9968-13e2957e5abf', titel: 'One-Punch Man: Staffel 3', seit: '2026-08-26' },
  { url: 'https://www.disneyplus.com/de-de/series/the-rising-of-the-shield-hero-aka-tate-no-yuusha-no/4lgHH2jdAefe', titel: 'The Rising of the Shield Hero: Staffel 2' },
  { url: 'https://www.disneyplus.com/de-de/series/chainsaw-man/2gMK1kC3JIEh', titel: 'Chainsaw Man' },
  { url: 'https://www.disneyplus.com/de-de/series/aoashi/27OVvACG0ySD', titel: 'Aoashi' },
  { url: 'https://www.disneyplus.com/de-de/movies/children-of-the-sea/PPmmokvapG3T', titel: 'Children of the Sea' },
]
/* Ein Titel, den das Paket noch offen führt, der Worker aber nicht (inzwischen gemeldet). */
const NUR_PAKET = { url: 'https://www.disneyplus.com/browse/entity-faa35b37-3287-4a7c-9d42-a3a5f9ad9185', titel: 'Star Wars: Die Abenteuer der jungen Jedi' }

const anbieter: Anbieter = { name: 'Disney+', plattform: 'disneyplus', offen: 8, gesamt: 8, gemeldet: 0, ziele: ZIELE }
const paketEintrag = (z: { url: string; titel: string; seit?: string }, offen = true) => ({
  titel: `Paket ${z.titel}`,
  url: z.url,
  ...(z.seit ? { seit: z.seit } : {}),
  staffeln: [{ nr: 1, id: 1234, name: z.titel, folgen: 12, film: false, offen }],
})
const paketVon = (ziele: { url: string; titel: string; seit?: string }[], offen = true) =>
  Object.fromEntries(ziele.map((z, i) => [`k${i}-${z.url.slice(-6)}`, paketEintrag(z, offen)]))

type Antwort = 'stand' | 'fehler' | 'status' | 'ohne-disney' | 'ohne-ziele'
function sandkasten(paket: Record<string, any>, antwort: Antwort, stand: any, gemeldet: string[] = []) {
  const k: Record<string, any> = {
    Date: class extends Date {
      static now() {
        return FEST
      }
    },
    Set,
    Map,
    Array,
    Object,
    Promise,
    JSON,
    Number,
    String,
    WORKER: 'https://w.example/pruefung',
    localStorage: { getItem: () => null, setItem: () => {} },
    briefkasten: new Map(),
    gemeldeteAdressen: new Set(),
    erneutBeantwortet: new Set(),
    wartetAufUebernahme: new Set(),
    liste: paket,
    gemeldeteHolen: async () => new Set(),
    fetch: async (adresse: string) => {
      if (String(adresse).includes('zaehlen=1')) return { ok: true, json: async () => ({ adressen: [], gemeldet, eintraege: [] }) }
      if (antwort === 'fehler') throw new Error('Netz')
      if (antwort === 'status') return { ok: false, json: async () => ({}) }
      if (antwort === 'ohne-disney') return { ok: true, json: async () => ({ anbieter: [{ plattform: 'netflix', ziele: [] }] }) }
      if (antwort === 'ohne-ziele') return { ok: true, json: async () => ({ anbieter: [{ plattform: 'disneyplus' }] }) }
      return { ok: true, json: async () => stand }
    },
  }
  k.globalThis = k
  k.AK_DISNEY_NETZ = { frischGemeldet: async () => new Set() }
  const ctx = vm.createContext(k)
  vm.runInContext(lies('pruefstand-zeit.js'), ctx)
  vm.runInContext(lies('disney-weg.js'), ctx)
  vm.runInContext(lies('disney-staffeln.js'), ctx)
  /* Die Datei gibt es erst mit der Lösung; am alten Stand fehlt sie (Gegenprobe). */
  if (existsSync(join(ordner, 'disney-stand-ziele.js'))) vm.runInContext(lies('disney-stand-ziele.js'), ctx)
  else ctx.akDisneyStandEinarbeiten = async () => null
  const q = lies('disney.js')
  const schneide = (name: string) => {
    const t = new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`).exec(q)
    if (!t) throw new Error(`${name}() nicht in disney.js`)
    return t[0]
  }
  vm.runInContext([schneide('istErledigt'), schneide('offeneEintraege'), schneide('briefkastenHolen')].join('\n'), ctx)
  ctx.AK_DISNEY_WEG = ctx.akDisneyWeg({ dauer: ctx.localStorage, jetzt: () => FEST })
  return {
    holen: () => vm.runInContext('briefkastenHolen()', ctx) as Promise<void>,
    zahl: () => vm.runInContext('offeneEintraege().filter((e) => !istErledigt(e)).length', ctx) as number,
    liste: () => ctx.liste as Record<string, any>,
    pruefstandAm: () => ctx.akPruefstandAm as string | null,
    titelId: (e: any) => ctx.AK_DISNEY_STAFFELN.titelIdFuer(e?.staffeln, 1, [{ gesamt: 12 }]) as number | null,
  }
}

const rechne = async (zeilen: Zeile[] = []) => (await rechnePruefstand(zeilen, [anbieter], ERZEUGT)).anbieter[0]!
const worker = await rechne()
pruefe(worker.titel === 8, `Worker: acht Disney+-Titel offen: ${worker.titel}`)
const stand = { anbieter: [worker], pruefstandAm: ERZEUGT }

/* Paket kennt nur 5 der 8 Ziele (und eines, das der Worker nicht führt): Knopf = Worker-Zahl. */
const PAKET_ALT = [ZIELE[1]!, ZIELE[4]!, ZIELE[5]!, ZIELE[6]!, ZIELE[7]!]
const alt = sandkasten(paketVon([...PAKET_ALT, NUR_PAKET]), 'stand', stand)
await alt.holen()
pruefe(alt.zahl() === worker.titel, `verkleinertes Paket (5 + 1 überzählig): Knopfzahl ${alt.zahl()} = Worker ${worker.titel}`)
const fehlend = Object.values(alt.liste()).find((e) => e.url === ZIELE[0]!.url)
pruefe(fehlend?.titel === ZIELE[0]!.titel, 'fehlendes Ziel erscheint mit Titel und Adresse des Workers')
pruefe(Object.values(alt.liste()).find((e) => e.url === ZIELE[1]!.url)?.titel === `Paket ${ZIELE[1]!.titel}`, 'Eintrag aus dem Paket behält seinen Namen')
const mitSeit = Object.values(alt.liste()).find((e) => e.url === ZIELE[2]!.url)
pruefe(fehlend?.seit === '2026-10-15', 'Wiedervorlage (seit) des Workers kommt mit')
pruefe(mitSeit?.seit === '2026-08-26' && mitSeit?.titel === ZIELE[2]!.titel, 'zweites fehlendes Ziel mit seit')
pruefe(alt.pruefstandAm() === ERZEUGT, 'Prüfstand-Zeit für die Vermerke gesetzt (akGemeldetSeit läuft mit)')
pruefe(alt.titelId(fehlend) === null, 'angelegter Eintrag meldet ohne Kennung (titelId null, nie eine falsche)')
pruefe(Object.keys(alt.liste()).length === 9, `Einträge: 5 Paket + 1 überzählig + 3 vom Worker = 9 (${Object.keys(alt.liste()).length})`)

/* Zweiter Abruf: nichts doppelt. */
await alt.holen()
pruefe(alt.zahl() === worker.titel && Object.keys(alt.liste()).length === 9, 'zweiter Abruf: gleiche Zahl, keine Doppelten')

/* Der Worker führt 7 Ziele (eines inzwischen gemeldet): das Paket-Ziel zählt nicht mehr. */
const sieben = sandkasten(paketVon(ZIELE), 'stand', { anbieter: [{ ...worker, titel: 7, ziele: worker.ziele.slice(0, 7) }] })
await sieben.holen()
pruefe(sieben.zahl() === 7, `Worker führt 7 Ziele, Paket 8: Knopf ${sieben.zahl()}`)

/* Vollständiges Paket: gleiche Zahl, nichts angelegt. */
const voll = sandkasten(paketVon(ZIELE), 'stand', stand)
await voll.holen()
pruefe(voll.zahl() === worker.titel && Object.keys(voll.liste()).length === 8, `vollständiges Paket: ${voll.zahl()} = ${worker.titel}, nichts angelegt`)

/* Paket führt das Ziel, aber ohne offene Staffel: der Worker zählt es, also der Knopf auch. */
const zu = sandkasten(paketVon(ZIELE, false), 'stand', stand)
await zu.holen()
pruefe(zu.zahl() === worker.titel, `Paket ohne offene Staffel, Worker mit 8 Zielen: Knopf ${zu.zahl()}`)

/* Nichtauskunft (Netz weg, HTTP-Fehler, Disney+ fehlt im Stand oder ohne ziele-Feld): nichts wird erfunden, die Paketzahl gilt. */
for (const art of ['fehler', 'status', 'ohne-disney', 'ohne-ziele'] as const) {
  const ohne = sandkasten(paketVon(ZIELE.slice(0, 5)), art, stand, [ZIELE[1]!.url])
  await ohne.holen()
  pruefe(ohne.zahl() === 4 && Object.keys(ohne.liste()).length === 5, `Nichtauskunft (${art}): Paketzahl (eine Adresse laut Briefkasten gemeldet, sie wird weiter gelesen) ${ohne.zahl()}, keine neuen Einträge`)
}

/* Paket-Eintrag ohne Staffeln (Worker führt ihn): zählt mit; Ziel ohne Titel wird nicht angelegt (die Liste sortiert nach Titel). */
const leer = sandkasten({ x: { titel: 'Leer', url: ZIELE[0]!.url, staffeln: [] } }, 'stand', {
  anbieter: [{ ...worker, ziele: [ZIELE[0]!, { url: 'https://www.disneyplus.com/browse/entity-ohne-titel' }] }],
})
await leer.holen()
pruefe(leer.zahl() === 1 && Object.keys(leer.liste()).length === 1, `leere Staffelliste zählt mit, titelloses Ziel bleibt draußen: ${leer.zahl()} / ${Object.keys(leer.liste()).length} Einträge`)

/* Der Worker führt genau ein Ziel (Grenze 1, nicht 0). */
const eins = sandkasten(paketVon(ZIELE), 'stand', { anbieter: [{ ...worker, titel: 1, ziele: worker.ziele.slice(0, 1) }] })
await eins.holen()
pruefe(eins.zahl() === 1, `Worker führt 1 Ziel, Paket 8: Knopf ${eins.zahl()}`)

if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
console.log('\nDisney+: Knopf- und Worker-Zahl gleich, auch mit veraltetem Paket (alle Fälle ok).')
