/**
 * Zusicherungen zu `fuegePruefungEin()` aus `worker/src/pruefung-einfuegen.ts` an einer DB-Attrappe (keine D1): 26 Spalten und
 * 26 Platzhalter in derselben Reihenfolge wie die gebundenen Werte, Kürzungen je Feld, `null` für fehlende Angaben, `titelId` vor
 * `titel_id`, Zahlen über `zahlOderNull`, das Abgeleitete unverändert. Läuft in `check:worker`.
 */
import type { Env } from '../worker/src/env.ts'
import { fuegePruefungEin, type Abgeleitet } from '../worker/src/pruefung-einfuegen.ts'
import { festeUhr } from './feste-uhr.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

/** Attrappe: hält SQL, gebundene Werte und ob `run()` lief. */
function umgebung() {
  const fang = { sql: '', werte: [] as unknown[], gelaufen: 0 }
  const env = {
    DB: {
      prepare: (sql: string) => {
        fang.sql = sql
        return {
          bind: (...werte: unknown[]) => {
            fang.werte = werte
            return { run: async () => void fang.gelaufen++ }
          },
        }
      },
    },
  } as unknown as Env
  return { env, fang }
}

const abgeleitet: Abgeleitet = {
  befund: 'dub',
  vorhanden: 'ja',
  tonDe: 'gemessen',
  art: 'folge',
  staffelNr: 2,
  seitenKennung: 'B0SEITE001',
  hash: 'abc123',
  rohfolge: '{"nummer":3}',
  rohUebernommen: 0,
}

/** Gebundene Werte nach Spaltenname, aus der Spaltenliste des INSERT gelesen. */
function nachSpalte(sql: string, werte: unknown[]): Record<string, unknown> {
  const spalten = /INSERT INTO pruefung \(([^)]+)\)/.exec(sql)![1]!.split(',').map((s) => s.trim())
  return Object.fromEntries(spalten.map((s, i) => [s, werte[i]]))
}

async function fallVoll() {
  // Voll: jedes Feld gesetzt, lange Texte gekürzt.
  const voll = umgebung()
  const uhrZurueck = festeUhr('2026-11-12T10:20:30Z')
  await fuegePruefungEin(
    voll.env,
    {
      plattform: 'netflix',
      sprachen: ['Deutsch', 'Japanisch'],
      titel: 'T'.repeat(250),
      folgen: '12',
      folge_nr: 3.4,
      staffeln: [{ nr: 1, folgen: 12 }],
      serientitel: 'S'.repeat(250),
      notiz: 'N'.repeat(600),
      zugang: 'Z'.repeat(50),
      abos: ['Netflix Standard'],
      teil_von: 1,
      teil_bis: '13',
      titelId: 204011,
      titel_id: 999,
      suchUrl: 'https://s/'.padEnd(600, 'x'),
      folge: 'F'.repeat(250),
    },
    'https://www.netflix.com/title/1',
    abgeleitet,
  )
  uhrZurueck()
  const platzhalter = /VALUES \(([^)]+)\)/.exec(voll.fang.sql)![1]!.split(',').map((s) => s.trim())
  pruefe('26 Platzhalter ?1..?26 in Folge', platzhalter, Array.from({ length: 26 }, (_, i) => `?${i + 1}`))
  pruefe('26 gebundene Werte', voll.fang.werte.length, 26)
  pruefe('run() lief einmal', voll.fang.gelaufen, 1)
  const v = nachSpalte(voll.fang.sql, voll.fang.werte)
  pruefe('Spaltenzahl', Object.keys(v).length, 26)
  const am = String(v.gemeldet_am)
  pruefe('gemeldet_am: Sekunden-ISO mit Z, feste Uhr', am, '2026-11-12T10:20:30Z')
  delete v.gemeldet_am
  pruefe('voll: Werte je Spalte', v, {
    plattform: 'netflix',
    url: 'https://www.netflix.com/title/1',
    sprachen: '["Deutsch","Japanisch"]',
    befund: 'dub',
    titel: 'T'.repeat(200),
    folgen: 12,
    folge_nr: 3,
    staffel: 2,
    staffeln: '[{"nr":1,"folgen":12}]',
    serientitel: 'S'.repeat(200),
    notiz: 'N'.repeat(500),
    zugang: 'Z'.repeat(40),
    abos: '["Netflix Standard"]',
    teil_von: 1,
    teil_bis: 13,
    seiten_kennung: 'B0SEITE001',
    titel_id: 204011,
    such_url: 'https://s/'.padEnd(500, 'x'),
    folge: 'F'.repeat(200),
    vorhanden: 'ja',
    ton_de: 'gemessen',
    art: 'folge',
    hash: 'abc123',
    rohfolge: '{"nummer":3}',
    roh_uebernommen: 0,
  })
}

async function fallLeer() {
  // Leer: fehlende Angaben werden null, Plattform „unbekannt“; titel_id greift, wenn titelId fehlt.
  const leer = umgebung()
  await fuegePruefungEin(leer.env, { titel_id: '77', folgen: -1, folge_nr: 'abc', sprachen: [], titel: '' }, 'https://x/', {
    ...abgeleitet,
    staffelNr: null,
    seitenKennung: null,
    rohfolge: null,
    rohUebernommen: null,
  })
  const l = nachSpalte(leer.fang.sql, leer.fang.werte)
  delete l.gemeldet_am
  pruefe('leer: Werte je Spalte', l, {
    plattform: 'unbekannt',
    url: 'https://x/',
    sprachen: '[]',
    befund: 'dub',
    titel: null,
    folgen: null,
    folge_nr: null,
    staffel: null,
    staffeln: null,
    serientitel: null,
    notiz: null,
    zugang: null,
    abos: null,
    teil_von: null,
    teil_bis: null,
    seiten_kennung: null,
    titel_id: 77,
    such_url: null,
    folge: null,
    vorhanden: 'ja',
    ton_de: 'gemessen',
    art: 'folge',
    hash: 'abc123',
    rohfolge: null,
    roh_uebernommen: null,
  })
}

async function fallLang() {
  // Lange JSON-Felder werden als Text gekürzt (kein gültiges JSON mehr, aber begrenzt).
  const lang = umgebung()
  await fuegePruefungEin(lang.env, { staffeln: Array.from({ length: 2000 }, (_, i) => i), abos: ['A'.repeat(2000)] }, 'https://x/', abgeleitet)
  const g = nachSpalte(lang.fang.sql, lang.fang.werte)
  pruefe('staffeln auf 4000 Zeichen', String(g.staffeln).length, 4000)
  pruefe('abos auf 1000 Zeichen', String(g.abos).length, 1000)
}

async function main() {
  await fallVoll()
  await fallLeer()
  await fallLang()
  if (fehler) {
    console.error(`worker-pruefung-einfuegen: ${fehler} Fehler`)
    process.exit(1)
  }
  console.log('worker-pruefung-einfuegen: ok')
}

void main()
