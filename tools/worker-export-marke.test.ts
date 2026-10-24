/**
 * **Die Marke der Bau-Auszüge (R2) wird nur nach echten Änderungen gesetzt** (12.10.2026,
 * `daniel-zum-abarbeiten/berichte/d1-umbau-entwurf-2026-10-12.md`, Maßnahme 1).
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers und ein R2 mit
 * steuerbarer Uhr. Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-export-marke.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { PRUEFUNG_ID_AB } from '../worker/src/rohfolgen-seiten.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status/
const db = new DatabaseSync(':memory:')
for (const f of readdirSync('worker/migrations').sort()) {
  const sql = readFileSync(`worker/migrations/${f}`, 'utf8')
  if (NUR.test(sql) && !f.startsWith('023')) db.exec(sql)
}

const abfragen: string[] = []
type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }
const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
  bind: (...w) => anweisung(sql, w),
  run: async () => {
    const r = db.prepare(sql).run(...(werte as never[]))
    return { meta: { changes: Number(r.changes), rows_written: Number(r.changes) } }
  },
  all: async () => {
    abfragen.push(sql)
    return { results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0 } }
  },
  first: async () => db.prepare(sql).get(...(werte as never[])) ?? null,
})

/* R2 mit steuerbarer Uhr; `puts` zählt die Schreibzugriffe je Schlüssel. */
let uhr = Date.parse('2026-10-12T00:00:00Z')
Date.now = () => uhr
const objekte = new Map<string, { text: string; uploaded: Date }>()
const puts = new Map<string, number>()
const belege = {
  get: async (k: string) => {
    const o = objekte.get(k)
    return o ? { uploaded: o.uploaded, text: async () => o.text } : null
  },
  head: async (k: string) => objekte.get(k) ?? null,
  put: async (k: string, text: string) => {
    puts.set(k, (puts.get(k) ?? 0) + 1)
    objekte.set(k, { text, uploaded: new Date(uhr) })
  },
}
const env = {
  LAUF_TOKEN: 't',
  SITE_URL: 'https://attrappe.test/',
  BELEGE: belege,
  DB: {
    prepare: (s: string) => anweisung(s),
    batch: async (liste: Anweisung[]) => {
      const antworten = []
      for (const a of liste) antworten.push(await a.run())
      return antworten
    },
  },
} as never

const MARKE = 'export/_ungueltig'
const MARKE_OFFEN = 'export/_ungueltig-offen'
const marken = () => `${puts.get(MARKE) ?? 0}/${puts.get(MARKE_OFFEN) ?? 0}`
const minuten = (n: number) => void (uhr += n * 60_000)

const post = (body: unknown) =>
  handlePruefung(
    new Request('https://worker.test/pruefung', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify(body) }),
    env,
  )
const loesche = (body: unknown) =>
  handlePruefung(new Request('https://worker.test/pruefung', { method: 'DELETE', headers: { 'X-Lauf-Token': 't' }, body: JSON.stringify(body) }), env)
const hole = (suche: string) => handlePruefung(new Request(`https://worker.test/pruefung?rohfolgen=1&${suche}`, { headers: { Authorization: 'Bearer t' } }), env)

const URL_A = 'https://www.disneyplus.com/de-de/browse/entity-a'
const folge = (nr: number, ton = 'ja') => ({
  plattform: 'disneyplus',
  url: URL_A,
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Testtitel',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `pb-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton }],
})

console.log('Marke nur nach geschriebenen Zeilen')
{
  await post(folge(1))
  pruefe(marken() === '1/0', `neue Meldung setzt die Marke (alle/offen: ${marken()})`)

  minuten(2)
  await post(folge(1))
  pruefe(marken() === '1/0', `dieselbe Meldung am selben Tag schreibt nichts und setzt keine Marke (${marken()})`)
  await post({ stapel: [folge(1), folge(1)] })
  pruefe(marken() === '1/0', `ein Stapel unveränderter Meldungen ebenso (${marken()})`)

  await post(folge(2))
  pruefe(marken() === '2/0', `eine geänderte Meldung setzt sie wieder (${marken()})`)
}

console.log('Marke höchstens einmal in 60 Sekunden')
{
  minuten(1)
  uhr -= 30_000
  await post(folge(3))
  pruefe(marken() === '2/0', `zweite Änderung 30 s nach der Marke: kein zweiter Schreibzugriff (${marken()})`)
  uhr += 31_000
  await post(folge(4))
  pruefe(marken() === '3/0', `31 s später (61 s nach der Marke): wieder (${marken()})`)
}

console.log('Löschen: Marke nur, wenn Zeilen verschwunden sind')
{
  minuten(2)
  const keine = await loesche({ url: 'https://www.disneyplus.com/de-de/browse/gibt-es-nicht' })
  pruefe(keine.status === 200 && marken() === '3/0', `Löschen ohne Treffer setzt keine Marke (${marken()})`)
  const echt = await loesche({ url: URL_A, nummern: [4] })
  pruefe(echt.status === 200 && marken() === '4/0', `Löschen einer vorhandenen Folge setzt sie (${marken()})`)
}

console.log('Abhaken: nur der Auszug der offenen Zeilen wird ungültig')
{
  minuten(2)
  await hole('alle=1&nach=0')
  await hole('nach=0')
  await hole('namen=1')
  const id = (db.prepare('SELECT id FROM pruefung WHERE url = ? AND folge_nr = 1').get(URL_A) as { id: number }).id
  const roh = PRUEFUNG_ID_AB + id
  minuten(1)
  const vorher = marken()
  const r1 = await post({ uebernommen: [id] })
  const r2 = await post({ rohfolgenUebernommen: [roh] })
  pruefe(r1.status === 200 && r2.status === 200, 'beide Aufträge werden angenommen')
  pruefe(vorher === '4/0' && marken() === '4/1', `Abhaken setzt nur die Marke der offenen Auszüge (${vorher} -> ${marken()})`)

  const leer = await post({ uebernommen: [] })
  pruefe(leer.status === 200 && marken() === '4/1', 'eine leere Liste setzt keine Marke')

  minuten(11)
  const zaehle = async (suche: string, re: RegExp) => {
    abfragen.length = 0
    await hole(suche)
    return abfragen.filter((s) => re.test(s)).length
  }
  pruefe((await zaehle('alle=1&nach=0', /FROM prime_folge WHERE id >/)) === 0, 'nach Abhaken und Ablauf der Frist: der Auszug alle-* bleibt im Speicher (0 Abfragen)')
  pruefe((await zaehle('namen=1', /GROUP BY url/)) === 0, '... ebenso namen')
  pruefe((await zaehle('nach=0', /FROM prime_folge f/)) === 1, '... der Auszug offen-* wird neu gerechnet (1 Abfrage)')

  await post(folge(5))
  minuten(11)
  pruefe((await zaehle('alle=1&nach=0', /FROM prime_folge WHERE id >/)) === 1, 'nach einer geänderten Meldung und Ablauf der Frist wird alle-* neu gerechnet')

  /* Marke bei M, Auszug bei M+12 s, zweite Änderung bei M+30 s (Marke übersprungen): spätestens nach der Frist neu. */
  minuten(11)
  await post(folge(6))
  uhr += 12_000
  pruefe((await zaehle('alle=1&nach=0', /FROM prime_folge WHERE id >/)) === 1, 'Auszug 12 s nach der Marke neu gerechnet')
  uhr += 18_000
  const vorMarke = marken()
  await post(folge(7))
  pruefe(marken() === vorMarke, `die zweite Änderung 30 s nach der Marke setzt keine (${marken()})`)
  minuten(11)
  pruefe((await zaehle('alle=1&nach=0', /FROM prime_folge WHERE id >/)) === 1, 'Auszug kurz nach der Marke gebaut: nach Ablauf der Frist neu gerechnet, die übersprungene Änderung fehlt nicht dauerhaft')
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nalles ok')
