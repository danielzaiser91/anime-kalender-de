/**
 * **Lese-Deckel für jede Anfrage** (15.10.2026, `worker/src/lesedeckel.ts`).
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers; `rows_read` ist die Zahl
 * der gelieferten Zeilen plus `extra` (ein Vollscan an der D1). R2 mit steuerbarer Uhr. Nie gegen D1 oder Worker.
 *
 * Aufruf: `npx tsx tools/worker-lesedeckel-alle.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { mitEingang } from '../worker/src/auffangnetz.ts'
import { BUCHEN_AB, GEDECKELT, istFrei, mitLesedeckel, ungebuchtFuerTest } from '../worker/src/lesedeckel.ts'
import { DECKEL_LESEN, RIEGEL_LESEN_JE_ANFRAGE, utcTag, zaehlendeDb } from '../worker/src/tagesdeckel.ts'
import { type Env } from '../worker/src/env.ts'
import { festeUhr } from './feste-uhr.ts'

/** Feste Uhr für Test und Worker: kein Lauf hängt am UTC-Tageswechsel (K6). */
const FEST = new Date('2026-10-12T12:00:00Z')
festeUhr(FEST.toISOString())

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch
/* Der Cache der Edge trifft in diesen Tests nie: jede Lese-Route rechnet und fragt D1. */
const leererCache = {
  match: async () => undefined,
  put: async () => {},
}
Object.assign(globalThis, { caches: { default: leererCache } })

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status|titel_zeile/

function neueDatenbank() {
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync('worker/migrations').sort()) {
    const sql = readFileSync(`worker/migrations/${f}`, 'utf8')
    if (NUR.test(sql) && !f.startsWith('023')) db.exec(sql)
  }
  return db
}

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }
/** Jede Anweisung landet in `abfragen`; `extra` gibt gewählten Leseanweisungen zusätzliche gelesene Zeilen. */
type Spur = { abfragen: string[]; extra?: (sql: string) => number; langsam?: boolean }

function d1(db: DatabaseSync, spur: Spur) {
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    run: async () => {
      /* Wie die echte D1: eine Schreibanweisung braucht Zeit; was nicht abgewartet wird, steht beim Rückgabewert noch nicht da. */
      if (spur.langsam) await new Promise((fertig) => setTimeout(fertig, 20))
      spur.abfragen.push(sql)
      const r = db.prepare(sql).run(...(werte as never[]))
      return { meta: { changes: Number(r.changes), rows_written: Number(r.changes), rows_read: 0 } }
    },
    all: async () => {
      spur.abfragen.push(sql)
      const results = db.prepare(sql).all(...(werte as never[]))
      return { results, meta: { rows_written: 0, rows_read: results.length + (spur.extra?.(sql) ?? 0) } }
    },
    first: async () => {
      spur.abfragen.push(sql)
      return db.prepare(sql).get(...(werte as never[])) ?? null
    },
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

/* R2 mit steuerbarer Uhr (`uhr`), wie in worker-export-marke.test.ts; nach der echten, weil die Marken-Sperre je Isolate sie schon kennt. */
const echteUhr = Date.now
let uhr = echteUhr() + 86_400_000
const objekte = new Map<string, { text: string; uploaded: Date }>()
const belege = {
  get: async (k: string) => {
    const o = objekte.get(k)
    return o ? { uploaded: o.uploaded, text: async () => o.text } : null
  },
  head: async (k: string) => objekte.get(k) ?? null,
  put: async (k: string, text: string) => void objekte.set(k, { text, uploaded: new Date(uhr) }),
}

const umgebung = (db: DatabaseSync, spur: Spur, mitR2 = false) =>
  ({ LAUF_TOKEN: 't', DEBUG_TOKEN: 'd', SITE_URL: 'https://attrappe.test/', TITELZEILE_PLATTFORMEN: '', BELEGE: mitR2 ? belege : undefined, DB: d1(db, spur) }) as unknown as Env

const gelesenHeute = (db: DatabaseSync) => Number((db.prepare('SELECT gelesen FROM schreib_tag WHERE tag = ?').get(utcTag(FEST)) as { gelesen: number } | undefined)?.gelesen ?? 0)
const setzeHeute = (db: DatabaseSync, gelesen: number) =>
  db.prepare('INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?, 0, ?) ON CONFLICT(tag) DO UPDATE SET gelesen = ?').run(utcTag(FEST), gelesen, gelesen)
const anfrage = (pfad: string, init?: RequestInit) => new Request(`https://worker.test${pfad}`, init)
/** Ganzer Eingang (Auffangnetz + Lese-Deckel) vor der Prüfungs-Route, wie `fetch` in index.ts. */
const eingang = (r: Request, env: Env) => mitEingang(r, env, { 'Access-Control-Allow-Origin': 'https://site.test' }, (e) => handlePruefung(r, e))
/** Eine Route, die `n` Zeilen liest (über `all`, `extra` liefert die Menge). */
const liesZeilen = (n: number) => async (e: Env) => {
  await e.DB.prepare(`SELECT ${n} AS lies`).all()
  return new Response('{}')
}
const extraAusSql = (sql: string) => Number(/SELECT (\d+) AS lies/.exec(sql)?.[1] ?? 0) - (/AS lies/.test(sql) ? 1 : 0)
const meldung = (nr: number) => ({
  plattform: 'disneyplus',
  url: 'https://www.disneyplus.com/de-de/browse/entity-x',
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: 'Testtitel',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `pb-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: 'ja' }],
})
const melde = (body: unknown) =>
  anfrage('/pruefung', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify(body) })

console.log('Welche Anfragen der Deckel sperren darf (istFrei)')
{
  const env = { LAUF_TOKEN: 't', DEBUG_TOKEN: 'd' } as unknown as Env
  pruefe(!istFrei(anfrage('/pruefung?zaehlen=1'), env), 'Zähler der Erweiterung ohne Token: gedeckelt')
  pruefe(DECKEL_LESEN <= 3_000_000, `DECKEL_LESEN höchstens 3,0 Mio.: ungezählte Lesungen nach dem Deckel (~1,8 Mio.) bleiben unter 5 Mio. (${DECKEL_LESEN})`)
  pruefe(GEDECKELT.join(' ') === '/pruefung /netzfund /vorfall', `die gesperrten Routen genau: ${GEDECKELT.join(' ')}`)
  for (const pfad of ['/pruefung', '/netzfund', '/vorfall']) pruefe(!istFrei(anfrage(pfad), env), `${pfad} ohne Token: gedeckelt`)
  pruefe(['/lauf', '/verlauf', '/status'].every((pfad) => istFrei(anfrage(pfad), env)), 'Statusanzeige (/lauf, /verlauf, /status): nie gesperrt, sonst am Deckel blind')
  pruefe(istFrei(anfrage('/pruefung?token=t'), env), 'Bau mit Token in der Adresse: frei')
  pruefe(istFrei(anfrage('/pruefung', { method: 'POST', headers: { 'X-Lauf-Token': 't' } }), env), 'Meldung/Auftrag mit Token im Kopf: frei (eigener Deckel)')
  pruefe(istFrei(anfrage('/lauf?token=d'), env), 'Wartung mit DEBUG_TOKEN: frei')
  pruefe(!istFrei(anfrage('/pruefung?token=falsch'), env), 'falsches Token: gedeckelt')
  pruefe(!istFrei(anfrage('/pruefung'), { LAUF_TOKEN: '' } as unknown as Env), 'leeres Token bei leerem Secret: gedeckelt')
  pruefe(istFrei(anfrage('/unsubscribe'), env) && istFrei(anfrage('/health'), env), 'Besucher-Wege (Abmeldung, Health): frei')
}

console.log('Jede Anfrage zählt, gebucht wird gesammelt')
{
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [], extra: extraAusSql }
  const env = umgebung(db, spur)
  ungebuchtFuerTest(0)
  await mitLesedeckel(anfrage('/status'), env, {}, liesZeilen(BUCHEN_AB - 1))
  pruefe(gelesenHeute(db) === 0 && ungebuchtFuerTest() === BUCHEN_AB - 1, `unter BUCHEN_AB: gesammelt, noch nicht gebucht (${ungebuchtFuerTest()})`)
  await mitLesedeckel(anfrage('/health'), env, {}, liesZeilen(1))
  pruefe(gelesenHeute(db) === BUCHEN_AB && ungebuchtFuerTest() === 0, `spätestens nach BUCHEN_AB Zeilen steht alles im Tageszähler (${gelesenHeute(db)}), auch von freien Routen`)
  await mitLesedeckel(anfrage('/pruefung?token=t'), env, {}, liesZeilen(36_000))
  pruefe(gelesenHeute(db) === BUCHEN_AB + 36_000, `eine große Anfrage wird sofort gebucht (${gelesenHeute(db)})`)
}
{
  /* Nach der Antwort bricht der Worker unbeachtete Arbeit ab: Die Buchung muss vor der Rückgabe fertig sein. */
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [], extra: extraAusSql, langsam: true }
  ungebuchtFuerTest(0)
  await mitLesedeckel(anfrage('/health'), umgebung(db, spur), {}, liesZeilen(BUCHEN_AB))
  pruefe(gelesenHeute(db) === BUCHEN_AB, `die Buchung ist bei der Rückgabe abgeschlossen, nicht im Hintergrund (${gelesenHeute(db)})`)
}
{
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [], extra: () => 4 }
  ungebuchtFuerTest(0)
  const z = zaehlendeDb(umgebung(db, spur).DB)
  const zeile = await z.db.prepare('SELECT gelesen FROM schreib_tag').first()
  const ganz = await z.db.prepare("SELECT 'y' AS b").first<{ b: string }>()
  const spalte = await z.db.prepare("SELECT 'x' AS a").first('a')
  pruefe(z.zeilen().gelesen === 4 + 5 + 5, `first() wird gezählt (${z.zeilen().gelesen} gelesene Zeilen)`)
  pruefe(zeile === null && spalte === 'x' && ganz?.b === 'y', `first() liefert wie D1 die Zeile, die Spalte oder null (${String(zeile)}, ${String(spalte)})`)
}
{
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [], extra: extraAusSql }
  ungebuchtFuerTest(0)
  const r = await mitEingang(anfrage('/status'), umgebung(db, spur), {}, async (e) => {
    await e.DB.prepare('SELECT 300 AS lies').all()
    throw new Error('kaputt')
  })
  pruefe(r.status === 500 && ungebuchtFuerTest() === 300, `eine gescheiterte Anfrage zählt ihre Zeilen trotzdem (${ungebuchtFuerTest()}), der Fehler bleibt 500`)
}

console.log('Am Deckel')
{
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [] }
  const env = umgebung(db, spur)
  ungebuchtFuerTest(0)
  setzeHeute(db, DECKEL_LESEN - 1)
  pruefe((await eingang(anfrage('/pruefung?zaehlen=1'), env)).status === 200, 'knapp unter dem Deckel: der Zähler antwortet')
  setzeHeute(db, DECKEL_LESEN)
  spur.abfragen.length = 0
  const r = await eingang(anfrage('/pruefung?zaehlen=1'), env)
  const inhalt = (await r.json()) as { tageslimit?: boolean }
  const retry = Number(r.headers.get('Retry-After'))
  pruefe(r.status === 429 && inhalt.tageslimit === true, 'am Deckel: 429 mit tageslimit (dieselbe Antwort wie bei Meldungen)')
  pruefe(retry > 0 && retry <= 86_400 && r.headers.get('Access-Control-Allow-Origin') === '*', `Retry-After bis 00:00 UTC (${retry} s) und CORS * (die Erweiterung liest die Antwort)`)
  pruefe(spur.abfragen.length === 1 && spur.abfragen[0]!.includes('schreib_tag'), `die Route selbst läuft nicht: nur der Blick in den Zähler (${spur.abfragen.length} Anweisung)`)
  const bau = await eingang(anfrage('/pruefung?token=t'), env)
  pruefe(bau.status === 200 && Array.isArray(((await bau.json()) as { pruefungen?: unknown[] }).pruefungen), 'der Bau (Token) bekommt am Deckel seine Liste')
  pruefe((await mitLesedeckel(anfrage('/subscribe'), env, {}, liesZeilen(1))).status === 200, 'Besucher-Wege (Newsletter) lesen am Deckel weiter')
  pruefe((await mitLesedeckel(anfrage('/pruefung?zaehlen=1'), env, {}, async () => new Response('aus dem Cache'))).status === 200, 'eine Antwort aus dem Cache (kein D1-Zugriff) kommt am Deckel weiter')
  const gefangen = await mitLesedeckel(anfrage('/pruefung?zaehlen=1'), env, {}, async (e) => {
    try {
      await e.DB.prepare('SELECT 1').all()
      return new Response('{}')
    } catch {
      return new Response('{}', { status: 500 })
    }
  })
  pruefe(gefangen.status === 429, `fängt die Route den Fehler selbst, bleibt es die 429 (${gefangen.status})`)
  spur.abfragen.length = 0
  setzeHeute(db, 0)
  await mitLesedeckel(anfrage('/pruefung?zaehlen=1'), env, {}, async (e) => {
    for (let i = 0; i < 3; i++) await e.DB.prepare('SELECT 1').all()
    return new Response('{}')
  })
  const blicke = spur.abfragen.filter((s) => s.includes('FROM schreib_tag')).length
  pruefe(blicke === 1, `der Zähler wird je Anfrage einmal gelesen, nicht je Anweisung (${blicke})`)
}

console.log('Die Statusanzeige bleibt am Deckel erreichbar und zählt weiter')
{
  const db = neueDatenbank()
  const env = umgebung(db, { abfragen: [], extra: extraAusSql })
  ungebuchtFuerTest(0)
  setzeHeute(db, DECKEL_LESEN)
  for (const pfad of ['/lauf', '/verlauf', '/status']) {
    const vorher = ungebuchtFuerTest()
    const r = await mitLesedeckel(anfrage(pfad), env, {}, liesZeilen(11))
    pruefe(r.status === 200 && ungebuchtFuerTest() === vorher + 11, `${pfad} am Deckel: 200, ${ungebuchtFuerTest() - vorher} Zeilen gezählt`)
  }
}

console.log('Ein Fehler beim Ablegen in R2 kostet die Antwort nicht')
{
  const db = neueDatenbank()
  const env = umgebung(db, { abfragen: [] })
  /* R2: ein Schreibzugriff je Sekunde und Schlüssel; Bau und Erweiterung können gleichzeitig ablegen. */
  const werfend = { get: async () => null, head: async () => null, put: async () => Promise.reject(new Error('429 Too Many Requests')) }
  const r = await eingang(anfrage('/pruefung?token=t'), { ...env, BELEGE: werfend } as unknown as Env)
  pruefe(r.status === 200 && Array.isArray(((await r.json()) as { pruefungen?: unknown[] }).pruefungen), `put wirft: ?token= antwortet trotzdem 200 mit der Liste (${r.status})`)
}

console.log('Riegel je Anfrage: der Bau sperrt den Tag nicht, eine teure Meldung schon')
{
  const db = neueDatenbank()
  const offen = /FROM pruefung WHERE uebernommen = 0/
  const spur: Spur = { abfragen: [], extra: (sql) => (offen.test(sql) ? 36_000 : 0) }
  const env = umgebung(db, spur)
  ungebuchtFuerTest(0)
  const bau = await eingang(anfrage('/pruefung?token=t'), env)
  pruefe(bau.status === 200 && gelesenHeute(db) === 36_000, `Bau-Abruf mit 36.000 Zeilen: gezählt, ohne Riegel-Aufschlag (${gelesenHeute(db)})`)
  pruefe((await eingang(anfrage('/pruefung?zaehlen=1'), env)).status === 200, 'danach antworten die Lese-Routen weiter')
  pruefe((await eingang(melde(meldung(1)), env)).status === 200, 'danach werden Meldungen weiter gespeichert')
}
{
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [], extra: (sql) => (/CROSS JOIN pruefung p|FROM pruefung/.test(sql) ? RIEGEL_LESEN_JE_ANFRAGE + 1 : 0) }
  const env = umgebung(db, spur)
  ungebuchtFuerTest(0)
  pruefe((await eingang(melde(meldung(1)), env)).status === 200, 'Ausgang: eine Meldung über dem Riegel wird gespeichert')
  pruefe(gelesenHeute(db) >= DECKEL_LESEN, `... und sperrt den Tag (${gelesenHeute(db)})`)
  spur.extra = undefined
  pruefe((await eingang(anfrage('/pruefung?zaehlen=1'), env)).status === 429, 'danach bekommen auch die Lese-Routen ohne Token 429')
}

console.log('Die offene Liste des Baus kommt aus R2 (?token=)')
/** Zugesagt: Der Bau sieht eine neue Meldung spätestens nach fünf Minuten (`OFFEN_FRIST_MS`). */
const SPAETESTENS = 5 * 60_000
{
  const db = neueDatenbank()
  const spur: Spur = { abfragen: [] }
  const env = umgebung(db, spur, true)
  Date.now = () => uhr
  ungebuchtFuerTest(0)
  const liste = async () => ((await (await eingang(anfrage('/pruefung?token=t'), env)).json()) as { pruefungen: unknown[] }).pruefungen.length
  await eingang(melde(meldung(1)), env)
  uhr += 2 * 60_000
  pruefe((await liste()) === 1, 'Ausgang: eine offene Meldung')
  spur.abfragen.length = 0
  pruefe((await liste()) === 1 && !spur.abfragen.some((s) => s.includes('FROM pruefung')), 'der zweite Abruf liest D1 nicht (aus R2)')
  await eingang(melde(meldung(2)), env)
  uhr += SPAETESTENS - 60_000
  pruefe((await liste()) === 1, 'innerhalb der Frist: noch die alte Liste')
  uhr += 60_001
  pruefe((await liste()) === 2, 'spätestens nach 5 min sieht der Bau die neue Meldung')
  uhr += 2 * 60_000
  await eingang(melde({ uebernommen: [1, 2] }), env)
  uhr += SPAETESTENS + 1
  pruefe((await liste()) === 0, 'nach dem Abhaken (Marke offen) spätestens nach der Frist leer')
  Date.now = echteUhr
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { abfragen: [] }, true)
  ungebuchtFuerTest(0)
  objekte.clear()
  const liste = async (suche: string) => ((await (await eingang(anfrage(`/pruefung?token=t${suche}`), env)).json()) as { pruefungen: unknown[] }).pruefungen.length
  await eingang(melde(meldung(1)), env)
  const alle = await liste('')
  pruefe(alle === 1 && (await liste('&plattform=netflix')) === 0, 'je Plattform eine eigene Liste in R2 (nicht die Liste aller)')
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
