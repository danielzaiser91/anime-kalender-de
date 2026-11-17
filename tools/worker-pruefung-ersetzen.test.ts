/**
 * Zusicherungen zu `loescheOffene()` aus `worker/src/pruefung-ersetzen.ts` gegen echtes SQLite (`node:sqlite`, D1-Attrappe): mit den
 * offenen Zeilen nur deren Ids, ohne Ids keine Abfrage; ohne sie über die Adresse — nur offene Zeilen derselben Folge, Staffel und
 * Seitenkennung, wobei `NULL` nur `NULL` trifft (`IS`), und eine Meldung ohne Folgennummer nur Zeilen ohne Folgennummer.
 * Läuft in `check:worker`.
 */
import { DatabaseSync } from 'node:sqlite'
import type { Env } from '../worker/src/env.ts'
import { loescheOffene } from '../worker/src/pruefung-ersetzen.ts'
import { schluessel, type Folge, type OffeneHashes } from '../worker/src/pruefung-unveraendert.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

type Z = [id: number, url: string, folge: number | null, staffel: number | null, kennung: string | null, uebernommen: number]
const ZEILEN: Z[] = [
  [1, 'u', 3, 1, 'K', 0],
  [2, 'u', 3, 1, 'K', 1], // übernommen
  [3, 'u', 3, null, 'K', 0], // ohne Staffel
  [4, 'u', 3, 1, null, 0], // ohne Kennung
  [5, 'u', 4, 1, 'K', 0], // andere Folge
  [6, 'v', 3, 1, 'K', 0], // andere Adresse
  [7, 'u', null, 1, 'K', 0], // ohne Folgennummer
  [8, 'u', null, null, null, 0], // ohne alles
  [9, 'u', 3, 2, 'K', 0], // andere Staffel
]

/** Frische Datenbank mit `ZEILEN`; die Attrappe zählt Abfragen. */
function umgebung() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE pruefung (id INTEGER PRIMARY KEY, url TEXT, folge_nr INTEGER, staffel INTEGER, seiten_kennung TEXT, uebernommen INTEGER)')
  const rein = db.prepare('INSERT INTO pruefung VALUES (?, ?, ?, ?, ?, ?)')
  for (const z of ZEILEN) rein.run(...z)
  const zaehler = { abfragen: 0 }
  const anweisung = (sql: string, werte: unknown[] = []) => ({
    bind: (...w: unknown[]) => anweisung(sql, w),
    run: async () => {
      zaehler.abfragen++
      return { meta: { changes: Number(db.prepare(sql).run(...(werte as never[])).changes) } }
    },
  })
  const env = { DB: { prepare: (sql: string) => anweisung(sql) } } as unknown as Env
  const uebrig = () => (db.prepare('SELECT id FROM pruefung ORDER BY id').all() as { id: number }[]).map((r) => r.id)
  return { env, uebrig, zaehler }
}

const folge = (url: string, folgeNr: number | null, staffelNr: number | null, seitenKennung: string | null): Folge => ({ url, folgeNr, staffelNr, seitenKennung })
const alle = ZEILEN.map((z) => z[0])
const ohne = (...ids: number[]) => alle.filter((id) => !ids.includes(id))

async function main() {
  // Über die Adresse (ohne gelesene offene Zeilen).
  const faelle: [string, Folge, number[]][] = [
    ['Folge 3, Staffel 1, Kennung K', folge('u', 3, 1, 'K'), [1]],
    ['Staffel null trifft nur Staffel null', folge('u', 3, null, 'K'), [3]],
    ['Kennung null trifft nur Kennung null', folge('u', 3, 1, null), [4]],
    ['ohne Folgennummer: nur Zeilen ohne Nummer', folge('u', null, 1, 'K'), [7]],
    ['ohne alles: nur die Zeile ohne alles', folge('u', null, null, null), [8]],
    ['unbekannte Adresse: nichts', folge('w', 3, 1, 'K'), []],
  ]
  for (const [text, f, weg] of faelle) {
    const u = umgebung()
    await loescheOffene(u.env, undefined, f)
    pruefe(`Adresse: ${text}`, u.uebrig(), ohne(...weg))
    pruefe(`Adresse: ${text} (eine Abfrage)`, u.zaehler.abfragen, 1)
  }

  // Mit den gelesenen offenen Zeilen: genau deren Ids, sonst nichts — auch keine weitere Zeile derselben Folge.
  const f = folge('u', 3, 1, 'K')
  const offene = (ids: number[]): OffeneHashes =>
    ({ zeilen: new Map([[schluessel(f), ids.map((id) => ({ id }))]]), uebernommene: new Map(), uebernommeneRoh: new Map(), listenbauAm: async () => null }) as unknown as OffeneHashes
  const mit = umgebung()
  await loescheOffene(mit.env, offene([1, 5]), f)
  pruefe('Ids: genau diese', mit.uebrig(), ohne(1, 5))
  const leer = umgebung()
  await loescheOffene(leer.env, offene([]), f)
  pruefe('Ids leer: keine Abfrage', [leer.zaehler.abfragen, leer.uebrig()], [0, alle])
  const fremd = umgebung()
  await loescheOffene(fremd.env, offene([1]), folge('u', 4, 1, 'K'))
  pruefe('andere Folge ohne offene Zeilen: keine Abfrage', [fremd.zaehler.abfragen, fremd.uebrig()], [0, alle])

  if (fehler) {
    console.error(`worker-pruefung-ersetzen: ${fehler} Fehler`)
    process.exit(1)
  }
  console.log('worker-pruefung-ersetzen: ok')
}

void main()
