/**
 * **Lesezeilen der Rohfolgen-Abfragen** (12.10.2026): Serienname einmal je Adresse statt je Rohfolge,
 * keine Gesamtzahl per `COUNT(*)`, offene Rohfolgen geordnet aus dem Teilindex, Serienamen sechs Stunden
 * im Speicher. Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers; die
 * Zeilenzahlen mit Indexen misst `tools/worker-lesezeilen-messen.ts` (workerd). Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-lesezeilen.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { exporteVerwerfen } from '../worker/src/export-speicher.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status/
const db = new DatabaseSync(':memory:')
for (const f of readdirSync('worker/migrations').sort()) {
  const sql = readFileSync(`worker/migrations/${f}`, 'utf8')
  if (NUR.test(sql) && !f.startsWith('023')) db.exec(sql)
}

const abfragen: string[] = []
type Anweisung = { all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }
const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
  bind: (...w) => anweisung(sql, w),
  all: async () => {
    abfragen.push(sql)
    return { results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0 } }
  },
  first: async () => db.prepare(sql).get(...(werte as never[])) ?? null,
})

/* Ein Speicher (R2) mit steuerbarer Uhr: `uploaded` ist die gesetzte Zeit. */
let uhr = Date.parse('2026-10-12T00:00:00Z')
Date.now = () => uhr
const objekte = new Map<string, { text: string; uploaded: Date }>()
const belege = {
  get: async (k: string) => {
    const o = objekte.get(k)
    return o ? { uploaded: o.uploaded, text: async () => o.text } : null
  },
  head: async (k: string) => objekte.get(k) ?? null,
  put: async (k: string, text: string) => void objekte.set(k, { text, uploaded: new Date(uhr) }),
}
const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: { prepare: (s: string) => anweisung(s) }, BELEGE: belege } as never

const meldung = (url: string, titel: string | null, zeit: string) =>
  db
    .prepare(`INSERT INTO pruefung (plattform, url, befund, titel, gemeldet_am, uebernommen) VALUES ('primevideo', ?, 'ja', ?, ?, 1)`)
    .run(url, titel, zeit)
const rohfolge = (url: string, nr: number, offen: number) =>
  db
    .prepare(`INSERT INTO prime_folge (url, nummer, plattform, gemeldet_am, uebernommen) VALUES (?, ?, 'primevideo', '2026-10-12T00:00:00Z', ?)`)
    .run(url, nr, offen ? 0 : 1)

meldung('https://www.amazon.de/dp/A', 'Alt', '2026-10-01T00:00:00Z')
meldung('https://www.amazon.de/dp/A', 'Neu', '2026-10-02T00:00:00Z')
meldung('https://www.amazon.de/dp/A', null, '2026-10-03T00:00:00Z')
meldung('https://www.amazon.de/dp/B', null, '2026-10-03T00:00:00Z')
for (let i = 1; i <= 3; i++) rohfolge('https://www.amazon.de/dp/A', i, 1)
rohfolge('https://www.amazon.de/dp/A', 4, 0)
for (let i = 1; i <= 2; i++) rohfolge('https://www.amazon.de/dp/B', i, 1)

const hole = async (suche: string) => {
  abfragen.length = 0
  const r = await handlePruefung(new Request(`https://worker.test/pruefung?rohfolgen=1&${suche}`, { headers: { Authorization: 'Bearer t' } }), env)
  return (await r.json()) as { folgen?: { url: string; serientitel: string | null }[]; weiter?: number | null; gesamt?: number; namen?: unknown[] }
}
const plan = (sql: string, ...werte: unknown[]) =>
  (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(werte as never[])) as { detail: string }[]).map((z) => z.detail).join(' ; ')

console.log('Rohfolgen: Serienname einmal je Adresse nachgeschlagen')
{
  const seite = await hole('nach=0')
  const titel = (url: string) => seite.folgen?.filter((f) => f.url.endsWith(url)).map((f) => f.serientitel)
  pruefe(seite.folgen?.length === 5, 'fünf offene Rohfolgen, die übernommene fehlt')
  pruefe(JSON.stringify(titel('/A')) === '["Neu","Neu","Neu"]', 'Adresse A: Titel der jüngsten Meldung mit Titel (die neueste ohne Titel zählt nicht)')
  pruefe(JSON.stringify(titel('/B')) === '[null,null]', 'Adresse B ohne Titel: serientitel ist null')
  pruefe(seite.gesamt === undefined && !abfragen.some((s) => /COUNT\(\*\)/.test(s)), 'keine Gesamtzahl, kein COUNT(*)')
  const lookups = abfragen.filter((s) => /FROM pruefung/.test(s) && /json_each/.test(s))
  pruefe(lookups.length === 1 && /json_each/.test(lookups[0]!), `eine Abfrage auf pruefung für alle Adressen der Seite (${lookups.length})`)
  const seitenAbfrage = abfragen.find((s) => /FROM prime_folge f/.test(s)) ?? ''
  pruefe(!/SELECT p\.titel/.test(seitenAbfrage), 'die Seitenabfrage trägt keine Unterabfrage je Zeile')
  pruefe(/SEARCH f USING INDEX prime_folge_offen \(id>\?\)/.test(plan(seitenAbfrage, 0)) && !/TEMP B-TREE/.test(plan(seitenAbfrage, 0)), `Plan: Teilindex in Kennungs-Reihenfolge, keine Sortierung (${plan(seitenAbfrage, 0)})`)
  const leer = (await handlePruefung(new Request('https://worker.test/pruefung?rohfolgen=1&nach=999', { headers: { Authorization: 'Bearer t' } }), env).then((r) => r.json())) as { folgen: unknown[] }
  pruefe(leer.folgen.length === 0, 'Seite ohne Zeilen: leere Liste, keine Abfrage mit leerer Adressliste')
  const bearer = (token: string, suche: string) =>
    handlePruefung(new Request(`https://worker.test/pruefung?rohfolgen=1&${suche}`, { headers: { Authorization: `Bearer ${token}` } }), env)
  pruefe((await bearer('t', 'nach=0')).status === 200, 'Rohfolgen: Token im Kopf (Bearer) genügt')
  pruefe((await bearer('falsch', 'nach=0')).status === 403, 'Rohfolgen: falscher Bearer: 403')
  const ohne = await handlePruefung(new Request('https://worker.test/pruefung?rohfolgen=1&nach=0'), env)
  pruefe(ohne.status === 403, 'Rohfolgen: ohne Token: 403')
  const liste = await handlePruefung(new Request('https://worker.test/pruefung', { headers: { Authorization: 'Bearer t' } }), env)
  pruefe(liste.status === 200, 'Meldungsliste: Bearer genügt')
}

console.log('Rohfolgen: Serienamen sechs Stunden im Speicher, offene Seiten zehn Minuten')
{
  /** Wie oft die Abfrage zu `suche` die Datenbank anfasste, die gesucht wird: `re` trifft ihre SQL. */
  const rechnungen = async (suche: string, re: RegExp) => {
    await hole(suche)
    return abfragen.filter((s) => re.test(s)).length
  }
  objekte.clear()
  uhr = Date.parse('2026-10-12T00:00:00Z')
  pruefe((await rechnungen('namen=1', /GROUP BY url/)) === 1, 'erster Abruf rechnet die Serienamen')
  await hole('nach=0')
  uhr += 60_000
  await exporteVerwerfen(env)
  uhr += 29 * 60_000
  pruefe((await rechnungen('namen=1', /GROUP BY url/)) === 0, 'nach einer Meldung und 30 Minuten: Serienamen noch aus dem Speicher')
  pruefe((await rechnungen('nach=0', /FROM prime_folge f/)) === 1, '... die offene Seite (Frist zehn Minuten) wird neu gerechnet')
  uhr += 6 * 60 * 60_000
  pruefe((await rechnungen('namen=1', /GROUP BY url/)) === 1, 'nach sechs Stunden: Serienamen neu gerechnet')
}

console.log('Rohfolgen (alle=1): angenommene Folgen einer Netflix-Randprobe sind erkennbar')
{
  const mitRoh = (plattform: string, nr: number, roh: string) =>
    db.prepare(`INSERT INTO prime_folge (url, nummer, plattform, roh, gemeldet_am, uebernommen) VALUES ('https://www.netflix.com/title/1', ?, ?, ?, '2026-10-12T00:00:00Z', 1)`).run(nr, plattform, roh)
  mitRoh('netflix', 1, '{"angenommen":false}')
  mitRoh('netflix', 2, '{"angenommen":true}')
  mitRoh('netflix', 3, '{"liste":{}}')
  mitRoh('primevideo', 4, '{"angenommen":true}')
  mitRoh('netflix', 5, '{"liste":{"a":"abgeschnitt')
  await exporteVerwerfen(env)
  const alle = (await hole('alle=1&nach=0')).folgen as unknown as { plattform: string; nummer: number; angenommen: number | null }[]
  const von = (plattform: string, nr: number) => alle.find((f) => f.plattform === plattform && f.nummer === nr)?.angenommen
  pruefe(von('netflix', 2) === 1, 'Netflix mit roh.angenommen = true: angenommen = 1')
  pruefe(von('netflix', 1) === 0 && von('netflix', 3) === null, 'Netflix gemessen oder ohne das Feld: 0 bzw. null, nie 1')
  pruefe(alle.length >= 5 && von('netflix', 5) === null, 'gekürztes (ungültiges) roh: null statt Fehler der ganzen Seite')
  pruefe(von('primevideo', 4) === null, 'andere Anbieter: null, das Feld wird dort nicht gelesen')
  pruefe(alle.every((f) => !('roh' in f)), '`roh` selbst kommt weiter nicht heraus (Menge)')
}

if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
process.exit(0)
