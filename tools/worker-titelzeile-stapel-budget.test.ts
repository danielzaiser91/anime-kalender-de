/**
 * **Abfragen eines Stapels mit Titelzeilen unter der 50er-Grenze** (21.10.2026, Prüfer-Fund zu PR 1215).
 *
 * Die D1-Abfragen der Titelzeilen (`titelzeile-stapel.ts`) zählten nicht zum `ANFRAGEN_BUDGET` des Stapels; der Rest des
 * Stapels (`verarbeiteStapel`) rechnete mit dem vollen Budget. Geprüft wird mit einer zählenden Attrappe vor der D1-Attrappe
 * des Prüfstands: ein Stapel mit mehr Titeln, als das Budget trägt; Zusammenstöße, die jede Gruppe wiederholen ließen; ein
 * gemischter Stapel mit Titelzeilen und Meldungen des bisherigen Wegs.
 *
 * Aufruf: `npx tsx tools/worker-titelzeile-stapel-budget.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { aendereGebuendelt } from '../worker/src/titelzeile-buendel.ts'
import { neueDatenbank, post, umgebung, zahl, type Hilfe } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch

type Anweisung = { bind: (...w: unknown[]) => Anweisung; run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown> }
const ROH = Symbol('roh')

/** Zählt jede Abfrage, die bei der D1-Attrappe ankommt; ein `batch` zählt als eine. */
function zaehlend(env: { DB: { prepare: (s: string) => Anweisung; batch: (l: Anweisung[]) => Promise<unknown[]> } }) {
  const z = { n: 0 }
  const innen = env.DB
  const huelle = (a: Anweisung): Anweisung => {
    const h: Anweisung & { [ROH]?: Anweisung } = {
      bind: (...w) => huelle(a.bind(...w)),
      run: async () => (z.n++, a.run()),
      all: async () => (z.n++, a.all()),
      first: async () => (z.n++, a.first()),
    }
    h[ROH] = a
    return h
  }
  env.DB = {
    prepare: (sql: string) => huelle(innen.prepare(sql)),
    batch: async (liste: Anweisung[]) => (z.n++, innen.batch(liste.map((a) => (a as { [ROH]?: Anweisung })[ROH] ?? a))),
  }
  return z
}

const AN = 'disneyplus,netflix,adn'
const titel = (i: number) => `https://www.netflix.com/title/8100${1000 + i}`
const folge = (i: number, nr: number) => ({
  plattform: 'netflix',
  url: titel(i),
  titel: `Serie ${i}`,
  serientitel: `Serie ${i}`,
  staffeln: { staffeln: [{ nr: 1, folgen: 10 }] },
  titelId: 500 + i,
  sprachen: ['de|Deutsch'],
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  folge: `8300${i}${nr}`,
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `8300${i}${nr}`, nummer: nr, titel: `Folge ${nr}`, staffelText: 'Staffel 1', staffelNr: 1, vorhanden: 'ja', ton_de: 'ja', art: 'gemessen', roh: { liste: null } }],
})
const adn = (i: number) => ({ plattform: 'adn', url: `https://animationdigitalnetwork.com/video/${i}-test`, vorhanden: 'ja', ton_de: 'ja', art: 'gemessen', folge_nr: 1, staffel: 1 })

type Ergebnis = { ok: boolean; status?: number; grund?: string }
async function stapel(env: never, liste: unknown[]): Promise<Ergebnis[]> {
  const r = await handlePruefung(post({ stapel: liste }), env)
  return ((await r.json()) as { ergebnisse?: Ergebnis[] }).ergebnisse ?? []
}
const budget503 = (e: Ergebnis) => !e.ok && e.status === 503 && e.grund === 'Subrequest-Budget des Stapels überschritten'

console.log('Zusammenstöße: Wiederholungen reißen das Budget nicht')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h, AN)
  await stapel(env, Array.from({ length: 10 }, (_, i) => folge(i, 1)))
  h.vorUpdate = () => db.exec('UPDATE titel_zeile SET version = version + 1')
  const z = zaehlend(env as never)
  const e = await stapel(env, Array.from({ length: 10 }, (_, i) => folge(i, 2)))
  pruefe(z.n <= 46, `Abfragen ${z.n} im Budget (44 für den Stapel, dazu der Zähler des Aufrufs)`)
  pruefe(e.length === 10 && e.every((x) => x.ok || x.status === 503), `jede Meldung antwortet ok oder 503 (${JSON.stringify(e.map((x) => x.status ?? 'ok'))})`)
  pruefe(e.some(budget503), 'mindestens eine Gruppe scheitert am Budget des Stapels')
}

console.log('Gemischter Stapel mit Zusammenstößen: Titelzeilen und bisheriger Weg teilen sich ein Budget')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h, AN)
  await stapel(env, Array.from({ length: 5 }, (_, i) => folge(i, 1)))
  h.vorUpdate = () => db.exec('UPDATE titel_zeile SET version = version + 1')
  const z = zaehlend(env as never)
  const liste = [...Array.from({ length: 5 }, (_, i) => folge(i, 2)), ...Array.from({ length: 5 }, (_, i) => adn(i))]
  const e = await stapel(env, liste)
  pruefe(e.length === 10, `10 Ergebnisse (${e.length})`)
  pruefe(e.slice(0, 5).every((x) => !x.ok && x.status === 503), 'die Titelzeilen scheitern an den Zusammenstößen mit 503')
  pruefe(e.slice(5).every(budget503), `der Rest findet das Budget verbraucht (${JSON.stringify(e.slice(5).map((x) => x.grund ?? 'ok'))})`)
  pruefe(z.n <= 46, `Abfragen ${z.n} im Budget (44 für den Stapel, dazu der Zähler des Aufrufs)`)
}

console.log('Gemischter Stapel ohne Zusammenstöße: alles angenommen, unter der Grenze')
{
  const env = umgebung(neueDatenbank(), { geschrieben: 0 }, AN)
  const z = zaehlend(env as never)
  const e = await stapel(env, [...Array.from({ length: 5 }, (_, i) => folge(i, 1)), ...Array.from({ length: 5 }, (_, i) => adn(i))])
  pruefe(e.length === 10 && e.every((x) => x.ok), `alle zehn angenommen (${JSON.stringify(e.map((x) => x.status ?? 'ok'))})`)
  pruefe(z.n <= 46, `Abfragen ${z.n} im Budget (44 für den Stapel, dazu der Zähler des Aufrufs)`)
}

console.log('Ein Stapel mit nur einem Titel braucht wenige Abfragen')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, AN)
  const z = zaehlend(env as never)
  const e = await stapel(env, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => folge(1, n)))
  pruefe(e.length === 10 && e.every((x) => x.ok) && zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 1, 'zehn Folgen eines Titels, eine Zeile')
  pruefe(z.n <= 8, `${z.n} Abfragen (lesen, Altzeilen suchen, schreiben, dazu Zähler des Aufrufs)`)
}
console.log('Dauerhafter Zusammenstoß bei 215 Titeln: die Wiederholungsrunden haben eine feste Obergrenze')
{
  const db = neueDatenbank()
  const ablage = db.prepare("INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am) VALUES (?, 'netflix', ?, '{}', '2020-01-01')")
  for (let i = 1; i <= 215; i++) ablage.run(titel(i), i)
  const n = { abfragen: 0, batches: 0 }
  const env = {
    DB: {
      prepare: (sql: string) => {
        const a = (werte: unknown[]) => ({
          bind: (...w: unknown[]) => a(w),
          all: async () => (n.abfragen++, { results: db.prepare(sql).all(...(werte as never[])) }),
        })
        return a([])
      },
      batch: async (liste: unknown[]) => (n.abfragen++, n.batches++, liste.map(() => ({ meta: { changes: 0 } }))),
    },
  } as never
  const alle = (db.prepare('SELECT nr, url, plattform, version, daten FROM titel_zeile').all() as { nr: number; url: string; plattform: string; version: number; daten: string }[])
  const fertig = await aendereGebuendelt(env, alle, (alt) => ({ daten: alt, zaehl: 1 }))
  pruefe(fertig.length === 0, `nichts geschrieben, nichts gezählt (${fertig.length})`)
  /* 6 Runden zu je 3 Stapeln (215 Anweisungen) und einer Lesung der Zusammenstöße; Obergrenze fest eingetragen */
  pruefe(n.abfragen <= 24, `höchstens 6 Runden: ${n.abfragen} Abfragen (Obergrenze 24)`)
  pruefe(n.abfragen >= 24, `alle 6 Runden laufen, nicht weniger: ${n.abfragen} Abfragen`)
  pruefe(n.batches === 18, `18 Stapel zu je höchstens 100 Anweisungen (${n.batches})`)
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nAlles in Ordnung')
