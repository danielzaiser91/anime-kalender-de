/**
 * **Statusanzeige (Worker) und Erweiterungsknopf zählen Prime gleich, auch mit veraltetem Paket** (29.10.2026).
 *
 * Anlass (Daniel, 26.10.2026, dritte Wiederholung): Statusanzeige „Amazon 62 offen“, Knopf „32 Prime-Titel“. Das Paket
 * (`AK_OFFENE_AMAZON`) war älter als der Worker-Stand und kannte 39 von 62 Adressen. Hier rechnet `berechnePruefstand`
 * (Attrappe) die Titelzahl; die echte `briefkastenHolen()`, `fertig()` und `offeneZahl` aus `extension/amazon.js` laufen im
 * Sandkasten mit einem Paket, das nur einen Teil der Ziele kennt. Knopfzahl muss die Worker-Zahl sein.
 *
 * Aufruf: `npx tsx tools/worker-amazon-zahl-gleich.test.ts [Ordner der Erweiterung]` (der Ordner dient der Gegenprobe am alten Stand).
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
const asin = (n: number) => `B0TEST${String(n).padStart(4, '0')}`
const url = (n: number) => `https://www.amazon.de/gp/video/detail/${asin(n)}`
const suche = (n: number) => `https://www.amazon.de/s?k=Test${n}&i=instant-video`

/* Acht Titelseiten und zwei Suchen im Worker; Titel 3 ist nach dem Prüfstand gemeldet (Briefkasten-Zeile), also kein Ziel mehr. */
const titel = [1, 2, 3, 4, 5, 6, 7, 8]
const anbieter: Anbieter = {
  name: 'Prime Video',
  plattform: 'primevideo',
  offen: 10,
  gesamt: 10,
  gemeldet: 0,
  ziele: titel.map((n) => ({ url: url(n), titel: `Titel ${n}` })),
  suchAdressen: [suche(1), suche(2)],
}
const zeilen: Zeile[] = [{ plattform: 'primevideo', url: url(3), staffel: 1, uebernommen: 0, gemeldet_am: '2026-10-29T08:00:00Z' }]

function sandkasten(paket: Record<string, unknown>, antwort: 'stand' | 'fehler' | 'status', stand: unknown) {
  const k: Record<string, any> = {
    Date: class extends Date {
      static now() {
        return FEST
      }
    },
    Set,
    Array,
    Object,
    String,
    Math,
    Number,
    Promise,
    JSON,
    WORKER: 'https://w.example/pruefung',
    BRIEFKASTEN_FRIST_MS: 60_000,
    briefkastenGeholtAm: 0,
    standZiele: null,
    frischGemeldet: new Set<string>(),
    suchliste: {},
    suchErledigt: {},
    liste: paket,
    erledigt: {},
    briefkastenSeiten: null,
    briefkastenAdressen: null,
    briefkastenSuchen: null,
    briefkastenErwartungen: null,
    speicherSchreiben: async () => {},
    uebersichtZeichnen: () => {},
    nichtAngekommen: () => false,
    wiedervorlage: () => null,
    fetch: async (adresse: string) => {
      if (String(adresse).includes('zaehlen=1')) return { ok: true, json: async () => ({ adressen: [], gemeldet: [] }) }
      if (antwort === 'fehler') throw new Error('Netz')
      if (antwort === 'status') return { ok: false, json: async () => ({}) }
      return { ok: true, json: async () => stand }
    },
  }
  k.globalThis = k
  k.akGemeldetSeit = async () => {}
  k.akPruefstandAm = '2026-10-29T06:00:00.000Z'
  k.akPrimeAufraeumen = () => ({ bereinigt: {}, entfernt: 0 })
  const ctx = vm.createContext(k)
  vm.runInContext(lies('pruefstand-zeit.js'), ctx)
  vm.runInContext(lies('prime-such-bruecke.js'), ctx)
  vm.runInContext(lies('prime-titelseite.js'), ctx)
  /* Die Datei gibt es erst mit der Lösung; am alten Stand fehlt sie (Gegenprobe). */
  if (existsSync(join(ordner, 'prime-stand-ziele.js'))) vm.runInContext(lies('prime-stand-ziele.js'), ctx)
  const q = lies('amazon.js')
  const schneide = (kopf: string) => {
    const a = q.indexOf(`\n  ${kopf}`)
    if (a < 0) throw new Error(`${kopf} nicht in amazon.js`)
    return q.slice(a, q.indexOf('\n  }\n', a) + 4)
  }
  const offeneZahl = /\n {2}const offeneZahl = .*\n/.exec(q)?.[0]
  if (!offeneZahl) throw new Error('offeneZahl nicht in amazon.js')
  vm.runInContext([schneide('async function briefkastenHolen('), schneide('function fertig('), offeneZahl].join('\n'), ctx)
  return {
    holen: () => vm.runInContext('briefkastenHolen(true)', ctx) as Promise<void>,
    zahl: () => vm.runInContext('offeneZahl()', ctx) as number,
    veraltet: () => (ctx.akPrimeListeVeraltet ? (ctx.akPrimeListeVeraltet(false, ctx.liste) as boolean) : false),
    knopf: (offen: number, suchen: number) => (ctx.akPrimeKnopfText ? (ctx.akPrimeKnopfText(offen, suchen, ctx.akPrimeListeVeraltet(false, ctx.liste)) as string) : ''),
    liste: () => ctx.liste as Record<string, { titel: string; url: string }>,
  }
}

const paketVon = (ns: number[]) => Object.fromEntries(ns.map((n) => [asin(n), { titel: `Paket ${n}`, url: url(n), eintraege: [] }]))

const worker = (await rechnePruefstand(zeilen, [anbieter], ERZEUGT)).anbieter[0]!
pruefe(worker.titel === 7, `Worker: sieben Titelseiten offen (Titel 3 gemeldet): ${worker.titel}`)
pruefe(worker.ohneSeite === 2, `Worker: zwei Suchen: ${worker.ohneSeite}`)
const stand = { anbieter: [worker] }

/* Paket kennt nur 3 von 7 offenen Zielen (und eines, das der Worker nicht mehr führt): Knopf = Worker-Zahl. */
const kleines = sandkasten(paketVon([1, 2, 3, 4]), 'stand', stand)
await kleines.holen()
pruefe(kleines.zahl() === worker.titel, `verkleinertes Paket (4 Einträge): Knopfzahl ${kleines.zahl()} = Worker ${worker.titel}`)
pruefe(kleines.veraltet(), 'Worker führt Ziele ohne Paket-Eintrag: Hinweis „Liste veraltet“')
pruefe(kleines.knopf(kleines.zahl(), 2).endsWith('· Liste veraltet'), `Knopftext trägt den Hinweis: ${kleines.knopf(kleines.zahl(), 2)}`)
pruefe(kleines.liste()[asin(8)]?.titel === 'Titel 8' && kleines.liste()[asin(8)]?.url === url(8), 'fehlendes Ziel erscheint mit Titel und Adresse des Workers')
pruefe(kleines.liste()[asin(1)]?.titel === 'Paket 1', 'Eintrag aus dem Paket behält seinen Namen')
pruefe(!(suche(1) in kleines.liste()) && Object.keys(kleines.liste()).length === 8, 'Suchadressen werden keine Titel-Einträge (8 Einträge: Paket 4 + 4 vom Worker)')

/* Zweiter Abruf: nichts doppelt. */
await kleines.holen()
pruefe(kleines.zahl() === worker.titel && Object.keys(kleines.liste()).length === 8, 'zweiter Abruf: gleiche Zahl, keine Doppelten')

/* Vollständiges Paket: kein Hinweis, gleiche Zahl. */
const voll = sandkasten(paketVon(titel), 'stand', stand)
await voll.holen()
pruefe(voll.zahl() === worker.titel && !voll.veraltet(), `vollständiges Paket: ${voll.zahl()} = ${worker.titel}, kein Hinweis`)

/* Nichtauskunft (Netz weg, HTTP-Fehler): nichts wird erfunden, kein Hinweis, die Paketzahl gilt. */
for (const art of ['fehler', 'status'] as const) {
  const ohne = sandkasten(paketVon([1, 2, 3, 4]), art, stand)
  await ohne.holen()
  pruefe(ohne.zahl() === 4 && !ohne.veraltet() && Object.keys(ohne.liste()).length === 4, `Nichtauskunft (${art}): Paketzahl ${ohne.zahl()}, kein Hinweis, keine neuen Einträge`)
}

/* Der Worker führt weniger als das Paket: überzählige Paket-Einträge zählen nicht. */
const weniger = sandkasten(paketVon(titel), 'stand', { anbieter: [{ ...worker, ziele: worker.ziele.slice(0, 2) }] })
await weniger.holen()
pruefe(weniger.zahl() === 2, `Worker führt 2 Ziele, Paket 8: Knopf ${weniger.zahl()}`)

if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
console.log('\nPrime: Knopf- und Worker-Zahl gleich, auch mit veraltetem Paket (alle Fälle ok).')
