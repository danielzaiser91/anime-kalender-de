/**
 * **Statusanzeige (Worker) und Erweiterungsknopf zählen Netflix gleich** (24.10.2026).
 *
 * Anlass: Statusanzeige „Netflix 46 offen · 27 Titel · 19 ohne Kennung“, Knopf „Anime-Kalender 5“. Der Worker zog nur
 * Meldungen seit dem Prüfstand-Bau ab, die Erweiterung jede gedeckte Reihe (`akNetflixWartet`). Jetzt rechnet der Worker
 * die Deckung (`pruefung-gedeckt.ts`). Beide Zählungen laufen hier an denselben Daten: `berechnePruefstand` (mit
 * Attrappe) gegen `akNetflixUebernahme` + `akNetflixErledigtLautStand` aus der Erweiterung; Titelzahl und Knopfzahl müssen
 * gleich sein, auch bei Nichtauskunft (Titelzeilen nicht lesbar / Netz weg).
 *
 * Aufruf: `npx tsx tools/netflix-zahl-gleich.test.ts`
 */
import { readFileSync } from 'node:fs'
import { rechnePruefstand, type Anbieter, type Zeile } from './worker-pruefstand-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const url = (id: number) => `https://www.netflix.com/title/${id}`
const ERZEUGT = '2026-10-11T16:00:00.000Z'
const VOR = '2026-10-10T08:00:00Z'
const NACH = '2026-10-12T08:00:00Z'

type Fall = { id: number; staffeln: number[]; seit?: string; meldungen: { staffel: number | null; am: string; nummer?: number | null }[]; nachPruefstand?: boolean }
const A = 900001 // nie gemeldet
const B = 900002 // jede offene Staffel vor dem Prüfstand gemeldet: gedeckt
const C = 900003 // nach dem Prüfstand gemeldet (Briefkasten-Zeile): erledigt
const E = 900005 // zwei offene Staffeln, nur eine gemeldet
const F = 900006 // Wiedervorlage: Meldung älter als `seit`
const G = 900007 // zwei offene Staffeln, beide gemeldet, die zweite genau am `seit` (Grenze zählt)
const H = 900008 // nur eine Rohfolge ohne Nummer gemeldet: deckt nichts
const J = 900009 // Meldung ohne Staffelangabe zählt als Staffel 1
const K = 900010 // keine offene Staffel genannt und nie gemeldet: bleibt offen
const faelle: Fall[] = [
  { id: A, staffeln: [1], meldungen: [] },
  { id: B, staffeln: [1], meldungen: [{ staffel: 1, am: VOR }] },
  { id: C, staffeln: [1], meldungen: [{ staffel: 1, am: NACH }], nachPruefstand: true },
  { id: E, staffeln: [1, 2], meldungen: [{ staffel: 1, am: VOR }] },
  { id: F, staffeln: [1], seit: '2026-10-05T00:00:00Z', meldungen: [{ staffel: 1, am: '2026-10-01T00:00:00Z' }] },
  { id: G, staffeln: [1, 2], seit: '2026-10-05T00:00:00Z', meldungen: [{ staffel: 1, am: VOR }, { staffel: 2, am: '2026-10-05T00:00:00Z' }] },
  { id: H, staffeln: [1], meldungen: [{ staffel: 1, am: VOR, nummer: null }] },
  { id: J, staffeln: [1], meldungen: [{ staffel: null, am: VOR }] },
  { id: K, staffeln: [], meldungen: [] },
]

const eintrag = (staffel: number | null, nummer: number | null, am: string) => {
  const e: unknown[] = Array(16).fill(null)
  e[0] = staffel
  e[1] = nummer
  e[9] = am
  return e
}
const titelzeilen = faelle.map((f) => ({ url: url(f.id), daten: JSON.stringify({ s: null, t: null, st: null, f: f.meldungen.map((m, i) => eintrag(m.staffel, m.nummer === undefined ? i + 1 : m.nummer, m.am)) }) }))
const briefkasten = Object.fromEntries(
  faelle.map((f) => [url(f.id), { paare: f.meldungen.filter((m) => m.nummer !== null).map((m, i) => ({ nummer: i + 1, staffel: m.staffel ?? 1, am: m.am })) }]),
)
const anbieter: Anbieter = {
  name: 'Netflix',
  plattform: 'netflix',
  offen: faelle.length,
  gesamt: faelle.length,
  gemeldet: 0,
  ziele: faelle.map((f) => ({ url: url(f.id), titel: `T${f.id}`, staffeln: f.staffeln, seit: f.seit })),
}
const zeilen: Zeile[] = faelle
  .filter((f) => f.nachPruefstand)
  .map((f) => ({ plattform: 'netflix', url: url(f.id), staffel: 1, uebernommen: 1, gemeldet_am: NACH }))

const lade = (datei: string, g: Record<string, unknown>) => {
  const quelle = readFileSync(new URL(`../extension/${datei}`, import.meta.url), 'utf8')
  new Function('globalThis', 'fetch', quelle)(g, g.fetch)
}
/** Die Reihen der Erweiterungsliste (`AK_OFFENE_TITEL`): dieselben Staffeln und Wiedervorlagen wie die Ziele. */
const offene = Object.fromEntries(
  faelle.map((f) => [String(f.id), { staffeln: f.staffeln.map((nr) => ({ nr, offen: true, seit: f.seit })) }]),
)

/** Der Knopf: Reihen der Liste, die `fertig()` laut Stand nicht als erledigt führt (Stand = `ziele` der Worker-Antwort). */
async function knopfZahl(standUrls: string[], netzAus: boolean, frischIds: string[] = []) {
  const g: Record<string, any> = {
    fetch: async (adresse: string) => {
      if (netzAus) throw new Error('kein Netz')
      const u = decodeURIComponent(String(adresse).split('?gemeldet=')[1]!)
      return { ok: true, json: async () => briefkasten[u] ?? { paare: [] } }
    },
  }
  lade('disney-netz.js', g)
  lade('netflix-uebernahme.js', g)
  const stand = new Set<string>(standUrls)
  const wartet: Set<string> = await g.akNetflixUebernahme(stand, offene, 'https://w.example/pruefung')
  const frisch = new Set<string>(frischIds)
  return Object.keys(offene).filter((id) => !g.akNetflixErledigtLautStand(id, stand, frisch, wartet)).length
}

const worker = (await rechnePruefstand(zeilen, [anbieter], ERZEUGT, titelzeilen)).anbieter[0]!
const standUrls = worker.ziele.map((z) => z.url)
pruefe(worker.titel === 5, `Worker: A, E, F, H, K offen; B, G, J gedeckt, C nach dem Prüfstand gemeldet: ${worker.titel}`)
pruefe(
  JSON.stringify(standUrls) === JSON.stringify([A, E, F, H, K].map(url)),
  `Worker-Ziele: A, E, F, H, K: ${standUrls.join(' ')}`,
)
const knopf = await knopfZahl(standUrls, false)
pruefe(knopf === worker.titel, `Knopf = Titelzahl des Workers (${knopf} = ${worker.titel})`)

/* Die Erweiterung allein, mit dem Stand von vorher (ohne Deckung): sie zöge B und G selbst ab — Beleg, dass die Regel dieselbe ist. */
const alterStand = [A, B, E, F, G, H, J, K].map(url)
pruefe((await knopfZahl(alterStand, false)) === 5, 'Erweiterungsregel auf altem Stand: ebenfalls 5 (A, E, F, H, K)'
)
pruefe(
  (await knopfZahl(standUrls, false, [String(A)])) === worker.titel - 1,
  'eigene Meldung dieser Sitzung (A) nimmt die Reihe sofort aus dem Knopf')

/* Nichtauskunft: Titelzeilen nicht lesbar → der Worker deckt nichts ab; ohne Netz die Erweiterung ebenso. */
const ohne = (await rechnePruefstand(zeilen, [anbieter], ERZEUGT, new Error('D1 weg'))).anbieter[0]!
pruefe(ohne.titel === 8, `Nichtauskunft des Briefkastens: kein Ziel gedeckt (alle außer C): ${ohne.titel}`)
const knopfOhne = await knopfZahl(ohne.ziele.map((z) => z.url), true)
pruefe(knopfOhne === ohne.titel, `ohne Auskunft zählen beide gleich (${knopfOhne} = ${ohne.titel})`)

/* Genau eine offene Staffel mit genau einer Meldung deckt (1 Meldung, Staffel 1). */
const nurB = (await rechnePruefstand([], [{ ...anbieter, ziele: anbieter.ziele.filter((z) => z.url === url(B)) }], ERZEUGT, titelzeilen)).anbieter[0]!
pruefe(nurB.titel === 0, `genau eine Meldung deckt die eine offene Staffel: ${nurB.titel}`)

console.log(fehler ? `netflix-zahl-gleich: ${fehler} Fehler` : 'netflix-zahl-gleich: alle Fälle ok')
process.exit(fehler ? 1 : 0)
