/**
 * Tageszähler der Anfragen je Route (09.11.2026): gegen echtes SQLite mit Migration 063. Prüft den Schlüssel
 * (Kennungen, Query), die Buchungsschwellen, die Obergrenze verschiedener Routen, Tageswechsel, Fehler beim Buchen,
 * die Tagesgrenze der Schreibzeilen und die Verdrahtung im Eingang jeder Anfrage (`mitEingang`).
 *
 * Aufruf: `npx tsx tools/worker-route-zaehler.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { leseRouten, neuerRouteSammler, routenSchluessel, standard, zaehleRoute } from '../worker/src/route-zaehler.ts'
import { mitEingang } from '../worker/src/auffangnetz.ts'
import { tagesstand } from '../worker/src/mail-zaehler.ts'
import { type Env } from '../worker/src/env.ts'

/* Feste Werte statt der Konstanten des Moduls. */
const BUCHEN_NACH_MS = 600_000
const MIN_ABSTAND_MS = 60_000
const BUCHEN_AB = 500
const MAX_ROUTEN = 40

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
let warnungen = 0
console.warn = () => {
  warnungen++
}

type Stapel = { stapel: number; scheitert: boolean }

function umgebung(db: DatabaseSync, z: Stapel): Env {
  const anweisung = (sql: string, werte: unknown[] = []) => ({
    bind: (...w: unknown[]) => anweisung(sql, w),
    run: () => db.prepare(sql).run(...(werte as never[])),
    all: async () => ({ results: db.prepare(sql).all(...(werte as never[])) }),
    first: async () => db.prepare(sql).get(...(werte as never[])) ?? null,
  })
  return {
    DB: {
      prepare: (sql: string) => anweisung(sql),
      batch: async (liste: ReturnType<typeof anweisung>[]) => {
        if (z.scheitert) throw new Error('D1_ERROR: no such table: route_abrufe')
        z.stapel++
        for (const a of liste) a.run()
      },
    },
  } as never
}

function neueWelt() {
  const db = new DatabaseSync(':memory:')
  for (const m of ['049-schreib-tag', '052-schreib-tag-gelesen', '059-schreib-tag-mails', '063-route-abrufe']) db.exec(readFileSync(`worker/migrations/${m}.sql`, 'utf8'))
  const z: Stapel = { stapel: 0, scheitert: false }
  return { db, z, env: umgebung(db, z), s: neuerRouteSammler() }
}
const n = (db: DatabaseSync, tag: string, route: string) =>
  (db.prepare('SELECT n FROM route_abrufe WHERE tag = ? AND route = ?').get(tag, route) as { n: number } | undefined)?.n
const summe = (db: DatabaseSync, tag: string) => (db.prepare('SELECT COALESCE(SUM(n), 0) AS s FROM route_abrufe WHERE tag = ?').get(tag) as { s: number }).s

const T0 = Date.parse('2026-11-06T12:00:00Z')
const tag0 = '2026-11-06'

console.log('Schlüssel:')
pruefe(routenSchluessel('/health') === '/health', '/health')
pruefe(routenSchluessel('/feed/favoriten.ics') === '/feed/favoriten.ics', 'Feed-Pfad bleibt lesbar')
pruefe(routenSchluessel('/') === '/' && routenSchluessel('') === '/', 'Wurzel')
pruefe(routenSchluessel('/titel/123456/x') === '/titel/:id/x', 'Ziffern → :id')
pruefe(routenSchluessel('/a/' + 'z'.repeat(25)) === '/a/:id', 'langes Segment (25 Zeichen) → :id')
pruefe(routenSchluessel('/a/' + 'z'.repeat(24)) === '/a/' + 'z'.repeat(24), '24 Zeichen bleiben')
pruefe(routenSchluessel('/a/b/c/d/e/f') === '/a/b/c/d', 'höchstens vier Segmente')

console.log('Schwellen:')
{
  const w = neueWelt()
  for (let i = 0; i < BUCHEN_AB - 1; i++) await zaehleRoute(w.env, '/health', new Date(T0 + i), w.s)
  pruefe(w.z.stapel === 0, '499 Anfragen: nichts gebucht (auch nicht der erste des Isolate)')
  await zaehleRoute(w.env, '/health', new Date(T0 + MIN_ABSTAND_MS - 1), w.s)
  pruefe(w.z.stapel === 0, '500. Anfrage 1 ms vor MIN_ABSTAND: nichts gebucht')
  await zaehleRoute(w.env, '/health', new Date(T0 + MIN_ABSTAND_MS), w.s)
  pruefe(w.z.stapel === 1 && n(w.db, tag0, '/health') === 501, `bei MIN_ABSTAND: 501 gebucht (${n(w.db, tag0, '/health')})`)
  pruefe(w.s.anzahl === 0 && w.s.zaehler.size === 0, 'Sammler danach leer')
  const w3 = neueWelt()
  for (let i = 0; i < BUCHEN_AB - 2; i++) await zaehleRoute(w3.env, '/x', new Date(T0), w3.s)
  await zaehleRoute(w3.env, '/x', new Date(T0 + MIN_ABSTAND_MS), w3.s)
  pruefe(w3.z.stapel === 0, '499. Anfrage nach MIN_ABSTAND: noch nicht gebucht')
  await zaehleRoute(w3.env, '/x', new Date(T0 + MIN_ABSTAND_MS), w3.s)
  pruefe(w3.z.stapel === 1 && n(w3.db, tag0, '/x') === BUCHEN_AB, '500. Anfrage nach MIN_ABSTAND: genau 500 gebucht')
  const w2 = neueWelt()
  await zaehleRoute(w2.env, '/a', new Date(T0), w2.s)
  await zaehleRoute(w2.env, '/b', new Date(T0 + BUCHEN_NACH_MS - 1), w2.s)
  pruefe(w2.z.stapel === 0, 'kurz vor BUCHEN_NACH_MS: nichts gebucht')
  await zaehleRoute(w2.env, '/b', new Date(T0 + BUCHEN_NACH_MS), w2.s)
  pruefe(w2.z.stapel === 1 && n(w2.db, tag0, '/a') === 1 && n(w2.db, tag0, '/b') === 2, 'bei BUCHEN_NACH_MS: /a 1, /b 2')
  const sz = w2.db.prepare('SELECT zeilen FROM schreib_tag WHERE tag = ?').get(tag0) as { zeilen: number }
  pruefe(sz.zeilen === 3, `Schreib-Deckel zählt Routen + 1 mit (${sz.zeilen})`)
}

console.log('Obergrenze verschiedener Routen:')
{
  const verschieden = new Set<string>()
  for (let i = 0; i < 60; i++) verschieden.add(`/route-${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`)
  const w3 = neueWelt()
  for (const p of verschieden) await zaehleRoute(w3.env, p, new Date(T0), w3.s)
  await zaehleRoute(w3.env, '/route-aa', new Date(T0 + BUCHEN_NACH_MS), w3.s)
  pruefe(verschieden.size === 60, '60 verschiedene Pfade')
  const zeilen = (w3.db.prepare('SELECT COUNT(*) AS c FROM route_abrufe WHERE tag = ?').get(tag0) as { c: number }).c
  pruefe(zeilen === MAX_ROUTEN + 1, `höchstens ${MAX_ROUTEN} Routen plus (andere) (${zeilen})`)
  pruefe(n(w3.db, tag0, '(andere)') === 20, `20 Anfragen unter (andere) (${n(w3.db, tag0, '(andere)')})`)
  pruefe(n(w3.db, tag0, '/route-aa') === 2, 'eine schon bekannte Route zählt weiter unter ihrem Namen')
  pruefe(summe(w3.db, tag0) === 61, `Summe 61 (${summe(w3.db, tag0)})`)
}

console.log('Tageswechsel:')
{
  const w = neueWelt()
  await zaehleRoute(w.env, '/a', new Date(T0), w.s)
  await zaehleRoute(w.env, '/a', new Date(Date.parse('2026-11-07T00:00:05Z')), w.s)
  pruefe(n(w.db, tag0, '/a') === 1, 'Rest des Vortags gebucht, unter dem alten Tag')
  pruefe(n(w.db, '2026-11-07', '/a') === undefined && w.s.anzahl === 1 && w.s.tag === '2026-11-07', 'neuer Tag beginnt im Sammler')
  pruefe(w.s.zuletzt === Date.parse('2026-11-07T00:00:05Z'), 'neuer Tag: letzte Buchung = jetzt, kein sofortiges Buchen')
}

console.log('Fehler beim Buchen:')
{
  const w = neueWelt()
  w.z.scheitert = true
  warnungen = 0
  await zaehleRoute(w.env, '/a', new Date(T0), w.s)
  await zaehleRoute(w.env, '/a', new Date(T0 + BUCHEN_NACH_MS), w.s)
  pruefe(warnungen >= 1 && w.s.zaehler.get('/a') === 2 && w.s.anzahl === 2, 'Fehler: Anfrage nicht abgebrochen, Stand zurück im Sammler')
  w.z.scheitert = false
  await zaehleRoute(w.env, '/b', new Date(T0 + 2 * BUCHEN_NACH_MS), w.s)
  pruefe(n(w.db, tag0, '/a') === 2 && n(w.db, tag0, '/b') === 1, 'nächster Versuch bucht alles, nichts doppelt')
  const ohneTabelle = new DatabaseSync(':memory:')
  const e = umgebung(ohneTabelle, { stapel: 0, scheitert: false })
  pruefe((await leseRouten(e, tag0)) === null, 'leseRouten ohne Tabelle: null, kein Fehler')
}

console.log('Tagesgrenze der Schreibzeilen:')
{
  const w = neueWelt()
  await zaehleRoute(w.env, '/a', new Date(T0), w.s)
  w.s.zeilen = 999
  await zaehleRoute(w.env, '/a', new Date(T0 + BUCHEN_NACH_MS), w.s)
  pruefe(w.z.stapel === 0 && w.s.aus, '999 + 2 Zeilen > 1000: nicht gebucht, Zähler heute aus')
  await zaehleRoute(w.env, '/a', new Date(T0 + 2 * BUCHEN_NACH_MS), w.s)
  pruefe(w.s.zaehler.size === 0, 'ausgeschaltet zählt nichts mehr')
  const w2 = neueWelt()
  await zaehleRoute(w2.env, '/a', new Date(T0), w2.s)
  w2.s.zeilen = 998
  await zaehleRoute(w2.env, '/a', new Date(T0 + BUCHEN_NACH_MS), w2.s)
  pruefe(w2.z.stapel === 1 && !w2.s.aus, '998 + 2 Zeilen = 1000: noch erlaubt')
}

console.log('Lesen für /health:')
{
  const w = neueWelt()
  for (const [route, c] of [['/a', 3], ['/b', 9], ['/c', 5]] as const) w.db.prepare('INSERT INTO route_abrufe VALUES (?, ?, ?)').run(tag0, route, c)
  const top = (await leseRouten(w.env, tag0, 2)) ?? []
  pruefe(top.length === 2 && top[0].route === '/b' && top[0].n === 9 && top[1].route === '/c', 'häufigste zuerst, begrenzt')
  const stand = await tagesstand(w.env, new Date(T0))
  pruefe(stand?.routen?.length === 3 && stand.routen[0].route === '/b', '/health (tagesstand) trägt die Routen des Tages')
}

console.log('Verdrahtung im Eingang jeder Anfrage:')
{
  const w = neueWelt()
  standard.zaehler.clear()
  standard.anzahl = 0
  const antwort = await mitEingang(new Request('https://w.example.invalid/health?k=geheim'), w.env, {}, async () => new Response('ok'))
  pruefe(antwort.status === 200, 'Anfrage läuft durch')
  pruefe(standard.zaehler.get('/health') === 1 && standard.anzahl === 1, 'mitEingang zählt die Route des Aufrufs (ohne Query)')
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('Route-Zähler: Schlüssel, Schwellen, Obergrenze, Tageswechsel, Fehlerweg, Tagesgrenze, /health, Verdrahtung ok.')
