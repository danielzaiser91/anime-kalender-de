/**
 * **Statusanzeige und Erweiterungsknopf zählen Netflix aus demselben Stand — und die Differenz ist erklärt** (24.10.2026).
 *
 * Anlass: Statusanzeige „Netflix 46 offen · 27 Titel · 19 ohne Kennung", Knopf „Anime-Kalender 5". Der Worker
 * (`rechneAnbieter`) zieht nur Meldungen seit dem Prüfstand-Bau ab, die Erweiterung zusätzlich jede im Briefkasten
 * gedeckte Reihe (`akNetflixWartet`). Beide Zählungen laufen hier an denselben Daten; die Zerlegung des Knopf-Tooltips
 * (`akNetflixZaehlung`) muss die Titelzahl des Workers vollständig erklären, sonst ist der Test rot.
 *
 * Aufruf: `npx tsx tools/netflix-zahl-gleich.test.ts`
 */
import { readFileSync } from 'node:fs'
import { rechneAnbieter, type Gemeldet } from '../worker/src/pruefung-stand-anbieter.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const url = (id: number) => `https://www.netflix.com/title/${id}`
const A = 900001 // offen, nie gemeldet
const B = 900002 // vor dem Prüfstand gemeldet: Worker offen, Erweiterung wartet
const C = 900003 // nach dem Prüfstand gemeldet: beide erledigt
const D = 900004 // im Stand, nicht in der Liste der Erweiterung
const E = 900005 // zweite offene Reihe wie A (mehr als ein Fall je Zweig)

const roh = {
  name: 'Netflix',
  plattform: 'netflix',
  offen: 5,
  gesamt: 9,
  gemeldet: 4,
  ohneSeite: 19,
  ziele: [A, B, C, D, E].map((id) => ({ url: url(id), titel: `T${id}` })),
}
const gemeldet: Gemeldet = {
  unterwegs: new Map(),
  seitPruefstand: new Map([['netflix', new Set([url(C)])]]),
  staffeln: new Map(),
  wartendeStaffeln: new Map(),
}
const worker = rechneAnbieter(roh, gemeldet)

const lade = (datei: string, g: Record<string, unknown>) => {
  const quelle = readFileSync(new URL(`../extension/${datei}`, import.meta.url), 'utf8')
  new Function('globalThis', 'fetch', quelle)(g, g.fetch)
}
const offene = Object.fromEntries([A, B, C, E].map((id) => [String(id), { staffeln: [{ nr: 1, offen: true }] }]))
const briefkasten: Record<string, unknown> = { [url(B)]: { paare: [{ nummer: 1, staffel: 1, am: '2026-10-01T00:00:00Z' }] } }

async function lauf(netzAus: boolean) {
  const g: Record<string, any> = {
    fetch: async (adresse: string) => {
      if (netzAus) throw new Error('kein Netz')
      const u = decodeURIComponent(String(adresse).split('?gemeldet=')[1])
      return { ok: true, json: async () => briefkasten[u] ?? { paare: [] } }
    },
  }
  lade('disney-netz.js', g)
  lade('netflix-uebernahme.js', g)
  const stand = new Set<string>(worker.ziele.map((z) => z.url))
  const wartet = await g.akNetflixUebernahme(stand, offene, 'https://w.example/pruefung')
  const frisch = new Set<string>()
  const z = g.akNetflixZaehlung(stand, offene, frisch, wartet)
  /* Der Knopf zählt die Reihen der Liste, die `fertig()` nicht als erledigt führt — unabhängig von `akNetflixZaehlung` gerechnet. */
  let knopf = 0
  for (const id of Object.keys(offene)) if (stand.has(url(Number(id))) && !wartet.has(id) && !frisch.has(id)) knopf++
  return { z, knopf, text: g.akNetflixZaehlText(z, 19) as string }
}

pruefe(worker.titel === 4, `Worker zählt A, B, D, E als Titel (4), nicht C: ${worker.titel}`)
pruefe(worker.ohneSeite === 19, `Worker reicht die 19 Verweise ohne Kennung durch: ${worker.ohneSeite}`)

const mit = await lauf(false)
pruefe(mit.z.imStand === worker.titel, `Zerlegung nennt die Titelzahl des Workers: ${mit.z.imStand}`)
pruefe(mit.knopf === 2 && mit.z.offen === 2, `Knopf zählt A und E: ${mit.knopf} / ${mit.z.offen}`)
pruefe(mit.z.gemeldet === 1 && mit.z.ausserListe === 1, `B gemeldet, D nicht in der Liste: ${JSON.stringify(mit.z)}`)
pruefe(mit.z.imStand === mit.z.offen + mit.z.gemeldet + mit.z.ausserListe, 'Summe der Teile = Titelzahl des Stands')
pruefe(mit.z.offen === mit.knopf, 'Zerlegung und Knopf zählen dasselbe')
pruefe(mit.text.includes('4 Titel offen = 2 hier zu prüfen + 1 hier schon gemeldet'), `Text nennt Zahl und Teile: ${mit.text}`)
pruefe(mit.text.includes('1 nicht in dieser Liste') && mit.text.includes('19 Verweise ohne Kennung'), 'Text nennt Rest und Verweise ohne Kennung')

/* Nichtauskunft (Netz weg): nichts gilt als gemeldet, B zählt wieder offen — Worker-Zahl bleibt erklärt. */
const aus = await lauf(true)
pruefe(aus.z.gemeldet === 0 && aus.z.offen === 3, `ohne Auskunft: gemeldet 0, offen 3: ${JSON.stringify(aus.z)}`)
pruefe(aus.z.imStand === aus.z.offen + aus.z.gemeldet + aus.z.ausserListe, 'ohne Auskunft: Summe stimmt')
pruefe(aus.knopf === aus.z.offen, 'ohne Auskunft: Knopf = Zerlegung')

/* Eigene Meldung dieser Sitzung (A) zählt hier sofort als gemeldet, der Worker kennt sie noch nicht. */
const gF: Record<string, any> = {}
lade('netflix-uebernahme.js', gF)
const standF = new Set<string>(worker.ziele.map((z) => z.url))
const zF = gF.akNetflixZaehlung(standF, offene, new Set([String(A)]), new Set([String(B)]))
pruefe(zF.offen === 1 && zF.gemeldet === 2 && zF.imStand === 4, `frisch gemeldetes A: offen 1, gemeldet 2: ${JSON.stringify(zF)}`)

/* Ohne Stand (Worker stumm): keine Zerlegung, kein Text. */
const g0: Record<string, any> = {}
lade('netflix-uebernahme.js', g0)
pruefe(g0.akNetflixZaehlung(null, offene, new Set(), new Set()) === null && g0.akNetflixZaehlText(null, 19) === '', 'ohne Stand: leer')
const g1: Record<string, any> = {}
lade('netflix-uebernahme.js', g1)
pruefe(!g1.akNetflixZaehlText({ imStand: 1, offen: 1, gemeldet: 0, ausserListe: 0 }, 0).includes('Verweise'), 'ohne Verweise ohne Kennung: kein Satz dazu')

console.log(fehler ? `netflix-zahl-gleich: ${fehler} Fehler` : 'netflix-zahl-gleich: alle Fälle ok')
process.exit(fehler ? 1 : 0)
