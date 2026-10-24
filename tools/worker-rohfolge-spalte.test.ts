/**
 * **Die Rohfolge von Netflix und Disney+ in der Meldungszeile** (13.10.2026, Migration 054).
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers. Geprüft wird:
 * - wohin die Rohfolge geschrieben wird (eine ja, keine oder mehrere sowie Prime nein),
 * - dass die Rohfolgen-Route dieselben Zeilen liefert wie bei der Ablage in `prime_folge` (Leser-Vergleich),
 * - dass die Seitenfortsetzung über beide Quellen stimmt und das Abhaken beide erreicht.
 * `rows_written` mit Indexen misst `tools/worker-schreibzeilen-messen.ts` (lokal in workerd).
 *
 * Aufruf: `npx tsx tools/worker-rohfolge-spalte.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { festeUhr } from './feste-uhr.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { speichereRohfolgen } from '../worker/src/pruefung-rohfolgen-speichern.ts'
import { PRUEFUNG_ID_AB, SEITE } from '../worker/src/rohfolgen-seiten.ts'

festeUhr('2026-10-12T12:00:00Z') // Query-Übergang gilt nur bis 07.11.2026
let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status/

function neueDatenbank() {
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync('worker/migrations').sort()) {
    const sql = readFileSync(`worker/migrations/${f}`, 'utf8')
    if (NUR.test(sql) && !f.startsWith('023')) db.exec(sql)
  }
  return db
}

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }

function d1(db: DatabaseSync) {
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    run: async () => {
      const r = db.prepare(sql).run(...(werte as never[]))
      return { meta: { changes: Number(r.changes), rows_written: Number(r.changes), rows_read: 0 } }
    },
    all: async () => ({ results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0, rows_read: 0 } }),
    first: async () => db.prepare(sql).get(...(werte as never[])) ?? null,
  })
  return {
    prepare: (sql: string) => anweisung(sql),
    batch: async (liste: Anweisung[]) => {
      const antworten = []
      for (const a of liste) antworten.push(await a.run())
      return antworten
    },
  }
}

const umgebung = (db: DatabaseSync) => ({ LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db) }) as never
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch

const post = (body: unknown) =>
  new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify(body),
  })
const hole = async (env: never, suche: string) =>
  (await handlePruefung(new Request(`https://worker.test/pruefung?rohfolgen=1&token=t&${suche}`), env).then((r) => r.json())) as {
    folgen: Record<string, unknown>[]
    weiter: number | null
  }
const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)

const netflix = (nr: number, ton = 'ja') => ({
  plattform: 'netflix',
  url: 'https://www.netflix.com/title/80000001',
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'NF Test',
  folge_nr: nr,
  staffel: 1,
  titelId: 77,
  serientitel: 'NF Serie',
  rohfolgen: [
    {
      gti: `nf-${nr}`,
      nummer: nr,
      titel: `Folge ${nr}`,
      staffelText: 'Staffel 1',
      staffelNr: 1,
      sprachen: ['de|Deutsch', 'ja|Japanisch'],
      vorhanden: 'ja',
      ton_de: ton,
      roh: { liste: { runtimeSec: 1428 + nr }, angenommen: nr === 2 },
    },
  ],
})
const disney = (nr: number) => ({
  plattform: 'disneyplus',
  url: 'https://www.disneyplus.com/de-de/browse/entity-a',
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: 'Disney Test',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `pb-${nr}`, nummer: nr, titel: `D-Folge ${nr}`, sprachen: ['de'], staffelNr: 1, vorhanden: 'ja', ton_de: 'ja' }],
})
const prime = {
  plattform: 'primevideo',
  url: 'https://www.amazon.de/dp/B0TEST',
  seiten_kennung: 's1',
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: 'Prime Test',
  rohfolgen: [
    { asin: 'A1', gti: 'g1', nummer: 1, titel: 'P1', vorhanden: 'ja', ton_de: 'ja' },
    { asin: 'A2', gti: 'g2', nummer: 2, titel: 'P2', vorhanden: 'ja', ton_de: 'ja' },
  ],
}

console.log('Wohin die Rohfolge geschrieben wird')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  await handlePruefung(post(netflix(1)), env)
  await handlePruefung(post(disney(1)), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'Netflix und Disney+ mit einer Rohfolge: nichts in prime_folge')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE rohfolge IS NOT NULL AND roh_uebernommen = 0') === 2, 'beide Zeilen tragen die Rohfolge, offen für den Zuordner (roh_uebernommen = 0)')
  const r = JSON.parse((db.prepare("SELECT rohfolge FROM pruefung WHERE plattform = 'netflix'").get() as { rohfolge: string }).rohfolge)
  pruefe(r.gti === 'nf-1' && r.nummer === 1 && r.titel === 'Folge 1' && r.staffel_text === 'Staffel 1' && r.dauer_sek === 1429 && r.titel_id === 77, 'die Rohfolge trägt gti, Nummer, Titel, Staffeltext, Laufzeit (aus roh.liste) und Titelkennung')

  await handlePruefung(post(prime), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 2, 'Prime (zwei Rohfolgen je Seite): bleibt in prime_folge')
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE plattform = 'primevideo' AND rohfolge IS NOT NULL") === 0, '... und die Meldungszeile trägt keine Rohfolge')

  const zwei = { ...netflix(5), rohfolgen: [netflix(5).rohfolgen[0]!, { ...netflix(5).rohfolgen[0]!, gti: 'nf-5b' }] }
  await handlePruefung(post(zwei), env)
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM prime_folge WHERE plattform = 'netflix'") === 2, 'Netflix mit zwei Rohfolgen: wie bisher in prime_folge')
  const keine = { ...disney(6), rohfolgen: [] }
  await handlePruefung(post(keine), env)
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 6 AND rohfolge IS NULL AND roh_uebernommen IS NULL") === 1, 'Meldung ohne Rohfolge: Spalten leer')
}

const adn = (nr: number) => ({
  plattform: 'adn',
  url: 'https://animationdigitalnetwork.com/de/video/1375-dorohedoro',
  vorhanden: 'ja',
  ton_de: nr > 12 ? 'ja' : 'nein',
  art: 'gemessen',
  titel: 'Dorohedoro',
  folge: `Dorohedoro - Folge ${nr}`,
  folge_nr: nr,
  staffel: nr > 12 ? 2 : 1,
  rohfolgen: [{ gti: `${31262 + nr}`, nummer: nr, titel: `Folge ${nr}`, sprachen: ['ja'], staffelNr: nr > 12 ? 2 : 1, vorhanden: 'ja', ton_de: nr > 12 ? 'ja' : 'nein', roh: { referenz: `dorohedoro_tv_${nr}` } }],
})

console.log('ADN: ein Stapel zu zehn Meldungen, die Rohfolge bleibt in der Meldungszeile')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  const antwort = (await handlePruefung(post({ stapel: Array.from({ length: 10 }, (_, i) => adn(i + 8)) }), env).then((r) => r.json())) as { ergebnisse: { ok: boolean }[] }
  pruefe(antwort.ergebnisse.length === 10 && antwort.ergebnisse.every((e) => e.ok), 'zehn Meldungen in einem Stapel, alle gespeichert')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'nichts in prime_folge (keine 6 + 5 Zeilen je Folge)')
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE plattform = 'adn' AND rohfolge IS NOT NULL AND roh_uebernommen = 0") === 10, 'jede Zeile trägt ihre Rohfolge, offen für den Zuordner')
  const r = JSON.parse((db.prepare("SELECT rohfolge FROM pruefung WHERE folge_nr = 13").get() as { rohfolge: string }).rohfolge)
  pruefe(r.gti === '31275' && r.nummer === 13 && r.staffel_nr === 2 && r.ton_de === 'ja', 'die Rohfolge trägt Videokennung, Nummer, Staffel und Sprache')
  const zweiter = (await handlePruefung(post(adn(13)), env).then((r) => r.json())) as { unveraendert?: boolean }
  pruefe(zweiter.unveraendert === true && zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 13") === 1, 'dieselbe Meldung noch einmal: nichts geschrieben (keine zweite Zeile)')
  const hole2 = await hole(env, 'nach=0')
  pruefe(hole2.folgen.length === 10 && hole2.folgen.every((f) => f.plattform === 'adn'), 'die Rohfolgen-Route liefert die zehn ADN-Zeilen')
}

console.log('Leser-Vergleich: Spalte gegen prime_folge liefert dieselben Zeilen')
{
  const meldungen = [netflix(1), netflix(2, 'nein'), netflix(3), disney(1), disney(2)]
  const a = neueDatenbank()
  const envA = umgebung(a)
  const b = neueDatenbank()
  const envB = umgebung(b)
  for (const m of meldungen) {
    await handlePruefung(post(m), envA)
    await handlePruefung(post(m), envB)
  }
  /* B legt dieselben Rohfolgen wie bisher in prime_folge ab (derselbe Schreibcode, den Prime nutzt). */
  b.exec('UPDATE pruefung SET rohfolge = NULL, roh_uebernommen = NULL')
  for (const m of meldungen) await speichereRohfolgen(envB, m, m.url, null)
  b.exec("UPDATE prime_folge SET gemeldet_am = (SELECT gemeldet_am FROM pruefung WHERE pruefung.folge_nr = prime_folge.nummer AND pruefung.plattform = prime_folge.plattform)")
  a.exec("UPDATE pruefung SET gemeldet_am = '2026-10-13T10:00:00Z'")
  b.exec("UPDATE pruefung SET gemeldet_am = '2026-10-13T10:00:00Z'; UPDATE prime_folge SET gemeldet_am = '2026-10-13T10:00:00Z'")
  const ohneId = (zeilen: Record<string, unknown>[]) =>
    zeilen
      .map(({ id: _id, ...rest }) => JSON.stringify(Object.entries(rest).sort(([x], [y]) => x.localeCompare(y))))
      .sort()
  for (const modus of ['nach=0', 'alle=1&nach=0']) {
    const x = await hole(envA, modus)
    const y = await hole(envB, modus)
    pruefe(x.folgen.length === 5 && JSON.stringify(ohneId(x.folgen)) === JSON.stringify(ohneId(y.folgen)), `${modus}: fünf Zeilen, Feld für Feld gleich (${x.folgen.length} gegen ${y.folgen.length})`)
    pruefe(x.folgen.every((f) => Number(f.id) > PRUEFUNG_ID_AB), `${modus}: die Ids der Spalten-Rohfolgen beginnen bei ${PRUEFUNG_ID_AB}`)
  }
  const alle = await hole(envA, 'alle=1&nach=0')
  const angenommen = alle.folgen.filter((f) => f.angenommen === 1).map((f) => f.gti)
  pruefe(angenommen.join() === 'nf-2', `angenommen (roh.angenommen) wird auch aus der Spalte gelesen (${angenommen.join()})`)
  /* Gesperrte Folgen liest der offene Auszug nicht (Stufe 2 erst), der vollständige schon. */
  a.exec("UPDATE pruefung SET rohfolge = json_set(rohfolge, '$.vorhanden', 'nein') WHERE folge_nr = 3 AND plattform = 'netflix'")
  pruefe((await hole(envA, 'nach=0')).folgen.length === 4 && (await hole(envA, 'alle=1&nach=0')).folgen.length === 5, 'vorhanden = nein: nicht im offenen, aber im vollständigen Auszug')
}

console.log('Seiten über beide Quellen und Abhaken')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  db.exec(`WITH RECURSIVE z(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM z WHERE n < ${SEITE - 2})
           INSERT INTO prime_folge (url, nummer, plattform, gemeldet_am, uebernommen, gti) SELECT 'https://www.amazon.de/dp/X', n, 'primevideo', '2026-10-13T10:00:00Z', 0, 'g' || n FROM z`)
  for (const nr of [1, 2, 3, 4]) await handlePruefung(post(netflix(nr)), env)
  for (const modus of ['nach=', 'alle=1&nach=']) {
    const erste = await hole(env, modus + '0')
    pruefe(erste.folgen.length === SEITE && erste.weiter === Number(erste.folgen[SEITE - 1]!.id), `${modus}: volle Seite aus ${SEITE - 2} Prime- und 2 Spalten-Zeilen, Fortsetzung = letzte Id`)
    const zweite = await hole(env, modus + erste.weiter)
    pruefe(zweite.folgen.length === 2 && zweite.weiter === null, `${modus}: die zweite Seite hat die übrigen 2, weiter = null`)
    pruefe(new Set([...erste.folgen, ...zweite.folgen].map((f) => f.id)).size === SEITE + 2, `${modus}: keine Zeile doppelt, keine fehlt (${SEITE + 2})`)
  }
  const dritte = await hole(env, 'nach=' + (PRUEFUNG_ID_AB + 10_000))
  pruefe(dritte.folgen.length === 0 && dritte.weiter === null, 'eine Fortsetzung hinter allen Ids: leer')

  const ids = (await hole(env, `nach=${SEITE - 2}`)).folgen.map((f) => Number(f.id))
  await handlePruefung(post({ rohfolgenUebernommen: [ids[0], ids[1], 1] }), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE roh_uebernommen = 1') === 2, 'Abhaken mit Ids der Spalte: roh_uebernommen = 1 (zwei Zeilen)')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge WHERE uebernommen = 1') === 1, '... und die Prime-Id wie bisher in prime_folge')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE uebernommen = 1') === 0, '... ohne das Abhaken der Meldung (pruefung.uebernommen) anzufassen')
  const rest = (await hole(env, `nach=${SEITE - 2}`)).folgen
  pruefe(rest.length === 2, `abgehakte Rohfolgen erscheinen im offenen Auszug nicht mehr (${rest.length} übrig)`)
}

console.log('Nur Neues für den Zuordner (Prüfer-Befund zu PR 1150)')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  const mitNotiz = (nr: number, notiz: string, ton = 'ja') => ({ ...netflix(nr, ton), notiz })
  const offen = async () => (await hole(env, 'nach=0')).folgen.length
  const alle = async () => (await hole(env, 'alle=1&nach=0')).folgen.length
  await handlePruefung(post(mitNotiz(1, 'a')), env)
  const roh = (await hole(env, 'nach=0')).folgen.map((f) => Number(f.id))
  await handlePruefung(post({ rohfolgenUebernommen: roh }), env)
  await handlePruefung(post(mitNotiz(1, 'b')), env)
  pruefe((await offen()) === 0 && (await alle()) === 1, 'offene Meldung, abgehakte Rohfolge, Notiz wechselt: die neue Zeile erbt den Stand, nichts offen, keine Dublette')
  db.exec('UPDATE pruefung SET uebernommen = 1')
  await handlePruefung(post(mitNotiz(1, 'c')), env)
  pruefe((await offen()) === 0 && (await alle()) === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE rohfolge IS NULL AND roh_uebernommen IS NULL') === 1, 'übernommene Meldung, gleiche Rohfolge, Notiz wechselt: die neue Zeile trägt keine Rohfolge (kein Doppelter, nichts offen)')
  db.exec('UPDATE pruefung SET uebernommen = 1')
  await handlePruefung(post(mitNotiz(1, 'c', 'nein')), env)
  pruefe((await offen()) === 1 && (await alle()) === 2, 'andere Rohfolge (Ton): neue Zeile mit offener Rohfolge')
  const neuRoh = (await hole(env, 'nach=0')).folgen.map((f) => Number(f.id))
  await handlePruefung(post({ rohfolgenUebernommen: neuRoh }), env)
  db.exec('UPDATE pruefung SET uebernommen = 1')
  await handlePruefung(post(mitNotiz(1, 'c')), env)
  pruefe((await offen()) === 1, 'zurück zum alten Stand (A, B, A): A kommt wieder offen an, weil B zuletzt übernommen wurde')
}

console.log('Probe (?rohfolgen=1&probe=<Anbieter>) liest auch die Spalte')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  const probe = async (suche: string) => ((await hole(env, suche)) as unknown as { probe: Record<string, unknown>[] }).probe
  await handlePruefung(post(netflix(1)), env)
  await handlePruefung(post(netflix(2)), env)
  db.exec("INSERT INTO prime_folge (url, nummer, plattform, roh, gemeldet_am, uebernommen) VALUES ('https://www.netflix.com/title/9', 7, 'netflix', '{\"alt\":true}', '2026-01-01T00:00:00Z', 1)")
  const liste = await probe('probe=netflix')
  pruefe(liste.length === 3 && Number(liste[0]!.id) > PRUEFUNG_ID_AB && Number(liste[2]!.id) < PRUEFUNG_ID_AB, 'Netflix: die jüngsten Rohfolgen aus der Spalte zuerst, danach die alte aus prime_folge')
  pruefe(liste[0]!.nummer === 2 && liste[0]!.titel === 'Folge 2' && liste[0]!.uebernommen === 0 && typeof liste[0]!.roh === 'string' && String(liste[0]!.roh).includes('angenommen'), 'Felder wie bei prime_folge: Nummer, Titel, Stand, roh')
  const eine = await probe('probe=netflix&id=' + Number(liste[1]!.id))
  pruefe(eine.length === 1 && eine[0]!.nummer === 1, '&id= mit der Id aus der Spalte holt genau diese Rohfolge')
  const alt = await probe('probe=netflix&id=' + Number(liste[2]!.id))
  pruefe(alt.length === 1 && alt[0]!.nummer === 7, '&id= mit einer Id aus prime_folge wie bisher')
  pruefe((await probe('probe=primevideo')).length === 0, 'anderer Anbieter: leer')
}

if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
process.exit(0)
