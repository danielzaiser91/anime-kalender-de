/**
 * Tageszähler der Feed-Abrufe (B5, 23.10.2026): gegen echtes SQLite mit Migration 060.
 * Zählt Schreibzeilen je Abruf, prüft Tageswechsel, Fehler beim Buchen, Mehr-Token-Schätzung.
 *
 * Aufruf: `npx tsx tools/worker-feed-zaehler.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import {
  leseFeedAbrufe,
  rangVon,
  schaetzeTokens,
  zaehleWennFeed,
  neuerSammler,
  zaehleFeedAbruf,
} from '../worker/src/feed-zaehler.ts'
import { type Env } from '../worker/src/env.ts'
import { festeUhr } from './feste-uhr.ts'

/** Feste Werte statt der Konstanten des Moduls: 10 Minuten, 60 Sekunden, 500 Abrufe. */
const BUCHEN_NACH_MS = 600_000
const MIN_ABSTAND_MS = 60_000
const BUCHEN_AB = 500

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
let warnungen = 0
console.warn = () => {
  warnungen++
}

type Stapel = { geschrieben: number; stapel: number; scheitert: boolean; verzoegerung: number }

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
        if (z.verzoegerung) await new Promise((fertig) => setTimeout(fertig, z.verzoegerung))
        if (z.scheitert) throw new Error('D1_ERROR: no such table: feed_abrufe')
        z.stapel++
        for (const a of liste) z.geschrieben += Number((a.run() as { changes: number }).changes)
      },
    },
  } as never
}

function neueWelt() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync('worker/migrations/060-feed-abrufe.sql', 'utf8'))
  db.exec(readFileSync('worker/migrations/049-schreib-tag.sql', 'utf8'))
  db.exec(readFileSync('worker/migrations/052-schreib-tag-gelesen.sql', 'utf8'))
  db.exec('CREATE TABLE subscribers (feed_token TEXT, status TEXT, favorites TEXT)')
  const z: Stapel = { geschrieben: 0, stapel: 0, scheitert: false, verzoegerung: 0 }
  return { db, z, env: umgebung(db, z), s: neuerSammler() }
}

const T0 = Date.parse('2026-10-12T12:00:00Z')
const tag0 = '2026-10-12'
const zeile = (db: DatabaseSync, tag: string, reg: number) =>
  (db.prepare('SELECT wert FROM feed_abrufe WHERE tag = ? AND reg = ?').get(tag, reg) as { wert: number } | undefined)?.wert

async function viele(w: ReturnType<typeof neueWelt>, n: number, start: number, schritt: number, token = (i: number) => `t${i}`) {
  for (let i = 0; i < n; i++) await zaehleFeedAbruf(w.env, token(i), new Date(start + i * schritt), w.s)
}

console.log('Schreibzeilen je Abruf:')
{
  const w = neueWelt()
  /* 2000 Abrufe von 300 Token in 2000 s: gebucht wird ab BUCHEN_AB, nie öfter als alle MIN_ABSTAND_MS */
  await viele(w, 2000, T0, 1000, (i) => `t${i % 300}`)
  pruefe(w.z.stapel >= 3 && w.z.stapel <= 4, `2000 Abrufe -> 3 bis 4 Stapel (${w.z.stapel})`)
  pruefe(w.z.geschrieben / 2000 < 0.5, `Schreibzeilen je Abruf < 0,5 (${(w.z.geschrieben / 2000).toFixed(3)}: ${w.z.geschrieben} Zeilen)`)
  const gelesen = await leseFeedAbrufe(w.env, tag0)
  const gebucht = zeile(w.db, tag0, -1) ?? 0
  pruefe(gebucht + w.s.abrufe === 2000, `gebucht ${gebucht} + noch im Isolate ${w.s.abrufe} = 2000`)
  pruefe(gelesen.tokens > 255 && gelesen.tokens < 345, `300 verschiedene Token geschätzt als ${gelesen.tokens}`)
}

console.log('Schwellen:')
{
  const w = neueWelt()
  await viele(w, BUCHEN_AB - 2, T0, 1)
  await zaehleFeedAbruf(w.env, 'x', new Date(T0 + MIN_ABSTAND_MS), w.s)
  pruefe(w.z.stapel === 0, "499 Abrufe, der letzte genau MIN_ABSTAND nach dem Start: nichts gebucht")
  await zaehleFeedAbruf(w.env, 'y', new Date(T0 + MIN_ABSTAND_MS), w.s)
  pruefe(w.z.stapel === 1 && zeile(w.db, tag0, -1) === 500, `500. Abruf genau MIN_ABSTAND nach dem Start bucht einmal (${zeile(w.db, tag0, -1)})`)
pruefe(w.s.abrufe === 0 && w.s.register.size === 0 && warnungen === 0, 'Sammler nach dem Buchen leer, keine Warnung (auch beim ersten Abruf des Tages)')
  const w0 = neueWelt()
  await viele(w0, BUCHEN_AB - 1, T0, 1)
  await zaehleFeedAbruf(w0.env, 'x', new Date(T0 + MIN_ABSTAND_MS - 1), w0.s)
  pruefe(w0.z.stapel === 0, "500 Abrufe, aber 1 ms vor MIN_ABSTAND: nichts gebucht")
  const w2 = neueWelt()
  await zaehleFeedAbruf(w2.env, 'a', new Date(T0), w2.s)
  await zaehleFeedAbruf(w2.env, 'b', new Date(T0 + BUCHEN_NACH_MS - 1), w2.s)
  pruefe(w2.z.stapel === 0, 'ein einzelner Abruf kurz vor BUCHEN_NACH_MS: nichts gebucht')
  await zaehleFeedAbruf(w2.env, 'c', new Date(T0 + BUCHEN_NACH_MS), w2.s)
  pruefe(w2.z.stapel === 1 && zeile(w2.db, tag0, -1) === 3, `bei BUCHEN_NACH_MS: 3 Abrufe gebucht (${zeile(w2.db, tag0, -1)})`)
  await zaehleFeedAbruf(w2.env, 'd', new Date(T0 + BUCHEN_NACH_MS + 1), w2.s)
  pruefe(w2.z.stapel === 1, 'danach kein weiterer Stapel direkt hinterher')
}

console.log('Ein Token, zwei Läufe, Folgezeile ohne Änderung:')
{
  const w = neueWelt()
  await viele(w, 5, T0, 1, () => 'gleich')
  await zaehleFeedAbruf(w.env, 'gleich', new Date(T0 + BUCHEN_NACH_MS), w.s)
  const eins = await leseFeedAbrufe(w.env, tag0)
  pruefe(eins.abrufe === 6 && eins.tokens === 1, `6 Abrufe, 1 Token (${eins.abrufe}, ${eins.tokens})`)
  const vorher = w.z.geschrieben
  await viele(w, 3, T0 + 2 * BUCHEN_NACH_MS, 1, () => 'gleich')
  await zaehleFeedAbruf(w.env, 'gleich', new Date(T0 + 3 * BUCHEN_NACH_MS), w.s)
  const zwei = await leseFeedAbrufe(w.env, tag0)
  pruefe(zwei.abrufe === 10 && zwei.tokens === 1, `Wiederholung: 10 Abrufe, weiter 1 Token (${zwei.abrufe}, ${zwei.tokens})`)
  pruefe(w.z.geschrieben - vorher === 4, `zwei Stapel schreiben je Abrufe + angehobenes Register (${w.z.geschrieben - vorher} Zeilen)`)
}

console.log('Tageswechsel und Aufräumen:')
{
  const w = neueWelt()
  w.db.prepare("INSERT INTO feed_abrufe VALUES ('2026-09-01', -1, 7), ('2026-09-11', -1, 8), ('2026-09-12', -1, 6), ('2026-10-01', -1, 9)").run()
  await viele(w, 4, T0, 1)
  const naechster = Date.parse('2026-10-13T00:30:00Z')
  await zaehleFeedAbruf(w.env, 'neu', new Date(naechster), w.s)
  pruefe(zeile(w.db, tag0, -1) === 4, `alter Tag wird beim Wechsel gebucht (${zeile(w.db, tag0, -1)})`)
  pruefe(zeile(w.db, '2026-09-01', -1) === undefined && zeile(w.db, '2026-09-11', -1) === undefined && zeile(w.db, '2026-09-12', -1) === 6 && zeile(w.db, '2026-10-01', -1) === 9, 'älter als 30 Tage gelöscht (31 Tage weg, 30 bleiben), jünger bleibt')
  pruefe(w.s.abrufe === 1 && w.s.tag === '2026-10-13', 'neuer Tag fängt bei 1 an')
  await zaehleFeedAbruf(w.env, 'neu', new Date(naechster + BUCHEN_NACH_MS), w.s)
  pruefe(zeile(w.db, '2026-10-13', -1) === 2, 'neuer Tag eigene Zeile')
}

console.log('Nichtauskunft: Buchen scheitert (Tabelle fehlt, D1-Limit):')
{
  const w = neueWelt()
  w.z.scheitert = true
  let geworfen = false
  try {
    await viele(w, 5, T0, 1)
    await zaehleFeedAbruf(w.env, 'x', new Date(T0 + BUCHEN_NACH_MS), w.s)
    await zaehleFeedAbruf(w.env, 'y', new Date(T0 + BUCHEN_NACH_MS + 1), w.s)
  } catch {
    geworfen = true
  }
  pruefe(!geworfen, 'Fehler beim Buchen bricht den Aufrufer nie ab')
  pruefe(w.z.stapel === 0 && w.s.abrufe === 7, `Gesammeltes bleibt stehen (${w.s.abrufe}), kein Wiederholen je Abruf`)
  w.z.scheitert = false
  await zaehleFeedAbruf(w.env, 'z', new Date(T0 + 2 * BUCHEN_NACH_MS), w.s)
  pruefe(zeile(w.db, tag0, -1) === 8, `nach Erholung wird alles gebucht (${zeile(w.db, tag0, -1)})`)
  const kaputt = neueWelt()
  kaputt.z.scheitert = true
  await viele(kaputt, 2, T0, 1)
  await zaehleFeedAbruf(kaputt.env, 'n', new Date('2026-10-13T00:01:00Z'), kaputt.s)
  pruefe(kaputt.s.abrufe === 1 && kaputt.s.tag === '2026-10-13', 'Tageswechsel mit Fehler: alter Tag verworfen, neuer zählt weiter')
}

console.log('Mehrere Token, Schätzung:')
{
  const w = neueWelt()
  await viele(w, 5000, T0, 1000, (i) => `abo-${i % 1500}`)
  await zaehleFeedAbruf(w.env, 'abo-0', new Date(T0 + 5000 * 1000 + BUCHEN_NACH_MS), w.s)
  const r = await leseFeedAbrufe(w.env, utc(T0 + 5000 * 1000))
  pruefe(r.tokens > 1300 && r.tokens < 1700, `1500 verschiedene Token geschätzt als ${r.tokens}`)
}
function utc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

console.log('Gleichzeitige Abrufe während eines Stapels (Prüfer 1856):')
{
  const w = neueWelt()
  w.z.verzoegerung = 30
  await viele(w, 499, T0, 1)
  const spaeter = new Date(T0 + 60_000)
  await Promise.all(Array.from({ length: 50 }, (_, i) => zaehleFeedAbruf(w.env, `p${i}`, spaeter, w.s)))
  const gebucht = zeile(w.db, tag0, -1) ?? 0
  pruefe(w.z.stapel === 1, `50 gleichzeitige Abrufe lösen genau einen Stapel aus (${w.z.stapel})`)
  pruefe(gebucht + w.s.abrufe === 549, `nichts doppelt, nichts verloren: gebucht ${gebucht} + im Sammler ${w.s.abrufe} = 549`)
  const f = neueWelt()
  f.z.verzoegerung = 30
  await viele(f, 499, T0, 1)
  f.z.scheitert = true
  await Promise.all(Array.from({ length: 20 }, (_, i) => zaehleFeedAbruf(f.env, `q${i}`, spaeter, f.s)))
  pruefe(f.z.stapel === 0 && f.s.abrufe === 519, `Fehler bei gleichzeitigen Abrufen: alle 519 bleiben im Sammler (${f.s.abrufe})`)
  const t = neueWelt()
  t.z.verzoegerung = 30
  await viele(t, 3, T0, 1)
  const naechster = new Date(Date.parse('2026-10-13T00:10:00Z'))
  await Promise.all(Array.from({ length: 10 }, (_, i) => zaehleFeedAbruf(t.env, `r${i}`, naechster, t.s)))
  pruefe(zeile(t.db, tag0, -1) === 3 && t.s.abrufe === 10 && t.s.tag === '2026-10-13', `Tageswechsel mit Verzögerung: alter Tag 3, neuer Tag zählt alle 10 (${t.s.abrufe})`)
}

console.log('Tagesgrenze der Schreibzeilen gegen Zufalls-Token (Prüfer 1856, 52585e7):')
{
  const w = neueWelt()
  const start = Date.parse('2026-10-12T00:00:00Z')
  /* 100.000 Abrufe mit lauter verschiedenen Token, alle 0,5 s: 13,9 Stunden, ein Tag */
  for (let i = 0; i < 100_000; i++) await zaehleFeedAbruf(w.env, `zufall-${i}`, new Date(start + i * 500), w.s)
  const schreibTag = (w.db.prepare('SELECT zeilen FROM schreib_tag WHERE tag = ?').get(tag0) as { zeilen: number }).zeilen
  pruefe(w.z.geschrieben <= 1000, `100.000 Zufalls-Token schreiben höchstens 1000 Zeilen am Tag (${w.z.geschrieben})`)
  pruefe(w.z.geschrieben > 900, `... und erreichen die Grenze (${w.z.geschrieben} > 900)`)
  pruefe(w.s.aus, 'danach ist der Zähler für den Tag aus')
  pruefe(schreibTag === w.z.geschrieben, `Schreib-Deckel zählt dieselben Zeilen mit (schreib_tag ${schreibTag}, geschrieben ${w.z.geschrieben})`)
  const vorher = w.z.stapel
  await zaehleFeedAbruf(w.env, 'noch-einer', new Date(start + 14 * 3_600_000), w.s)
  pruefe(w.z.stapel === vorher, 'am Limit kein weiterer Stapel')
  const abrufeAmLimit = w.s.abrufe
  const warnAmLimit = warnungen
  await zaehleFeedAbruf(w.env, 'noch-einer', new Date(start + 15 * 3_600_000), w.s)
  pruefe(w.s.abrufe === abrufeAmLimit && warnungen === warnAmLimit, 'am Limit weder gezählt noch erneut gewarnt')
  await zaehleFeedAbruf(w.env, 'neuer-tag', new Date(Date.parse('2026-10-13T00:00:01Z')), w.s)
  pruefe(!w.s.aus && w.s.abrufe === 1 && w.s.zeilen === 0, 'am nächsten Tag zählt der Zähler wieder')
  await viele(w, 3, Date.parse('2026-10-13T00:00:01Z'), 1, () => 'zufall-0')
  await zaehleFeedAbruf(w.env, 'zufall-0', new Date(Date.parse('2026-10-13T00:00:01Z') + BUCHEN_NACH_MS), w.s)
  const neuerTag = await leseFeedAbrufe(w.env, '2026-10-13')
  pruefe(neuerTag.abrufe === 5 && neuerTag.tokens === 2, `neuer Tag schreibt das Register erneut, auch wenn es gestern schon geschrieben war (${neuerTag.abrufe}, ${neuerTag.tokens})`)
}

console.log('Grenze auf den Punkt: 1000 Zeilen erlaubt, 1001 nicht')
{
  const w = neueWelt()
  w.s.tag = tag0
  w.s.zuletztGebucht = T0 - BUCHEN_NACH_MS
  w.s.zeilen = 997
  await zaehleFeedAbruf(w.env, 'a', new Date(T0), w.s)
  pruefe(w.z.stapel === 1 && !w.s.aus && w.s.zeilen === 1000, `997 + 3 = 1000 wird gebucht (Stapel ${w.z.stapel}, Zeilen ${w.s.zeilen})`)
  const g = neueWelt()
  g.s.tag = tag0
  g.s.zuletztGebucht = T0 - BUCHEN_NACH_MS
  g.s.zeilen = 998
  await zaehleFeedAbruf(g.env, 'a', new Date(T0), g.s)
  pruefe(g.z.stapel === 0 && g.s.aus, '998 + 3 = 1001 wird nicht gebucht, der Zähler ist aus')
}

console.log('Schon geschriebene Register gehen nicht erneut in einen Stapel:')
{
  const w = neueWelt()
  await viele(w, 3, T0, 1, () => 'immer-derselbe')
  await zaehleFeedAbruf(w.env, 'immer-derselbe', new Date(T0 + BUCHEN_NACH_MS), w.s)
  const nachErstem = w.z.geschrieben
  pruefe(nachErstem === 3, `erster Stapel: Abrufe + 1 Register + schreib_tag = 3 Zeilen (${nachErstem})`)
  await zaehleFeedAbruf(w.env, 'immer-derselbe', new Date(T0 + 2 * BUCHEN_NACH_MS), w.s)
  pruefe(w.z.geschrieben - nachErstem === 2, `zweiter Stapel: nur Abrufe + schreib_tag (${w.z.geschrieben - nachErstem})`)
}

console.log('Rang und Schätzung (feste Werte, von Hand gerechnet):')
{
  pruefe(rangVon(0) === 33 && rangVon(1) === 32 && rangVon(0x80000000) === 1 && rangVon(0x00ff0000) === 9, 'rangVon: 0 -> 33, 1 -> 32, 2^31 -> 1, 0x00ff0000 -> 9')
  const nur = (anzahl: number, wert: number) => new Map(Array.from({ length: anzahl }, (_, i) => [i, wert] as [number, number]))
  pruefe(schaetzeTokens(new Map()) === 0, 'leer: 0 Token')
  pruefe(schaetzeTokens(nur(255, 1)) === 1420, `255 Register belegt, eines leer: Linearzählung 256*ln(256) = 1420 (${schaetzeTokens(nur(255, 1))})`)
  pruefe(schaetzeTokens(nur(256, 5)) === 5884, `alle 256 Register Rang 5: 0,71829*256*32 = 5884 (${schaetzeTokens(nur(256, 5))})`)
}

console.log('Nur Feed-Abrufe mit Adresse zählen:')
{
  const w = neueWelt()
  const zaehle = (url: string) => zaehleWennFeed(new Request(url), w.env, new Date(T0), w.s)
  await zaehle('https://worker.test/feed/favoriten.ics?k=abc')
  await zaehle('https://worker.test/feed/favoriten.ics?k=%20abc%20')
  pruefe(w.s.abrufe === 2 && w.s.register.size === 1, `Adresse mit Leerzeichen ist derselbe Token (${w.s.abrufe} Abrufe, ${w.s.register.size} Register)`)
  await zaehle('https://worker.test/feed/favoriten.ics')
  await zaehle('https://worker.test/feed/favoriten.ics?k=%20')
  await zaehle('https://worker.test/feed/anderes.ics?k=abc')
  await zaehle('https://worker.test/health?k=abc')
  pruefe(w.s.abrufe === 2, `ohne Adresse, leere Adresse, anderer Pfad: nicht gezählt (${w.s.abrufe})`)
}

console.log('Verdrahtung:der Worker zählt jeden Abruf von /feed/favoriten.ics (auch unbekannte Adresse):')
{
  const { default: worker } = await import('../worker/src/index.ts')
  const w = neueWelt()
  const abruf = (k: string) =>
    worker.fetch(new Request(`https://worker.test/feed/favoriten.ics?k=${k}`), { ...w.env, SITE_URL: 'https://attrappe.test/' } as never, { waitUntil: () => {} } as never)
  const wieder = festeUhr(new Date(T0).toISOString())
  const antwort = await abruf('unbekannt')
  pruefe(antwort.status === 404, `unbekannte Adresse bleibt 404 (${antwort.status})`)
  for (let i = 0; i < BUCHEN_AB - 1; i++) await abruf(`k${i}`)
  pruefe(w.z.stapel === 0, 'vor Ablauf von MIN_ABSTAND nichts gebucht')
  wieder()
  const wieder2 = festeUhr(new Date(T0 + MIN_ABSTAND_MS).toISOString())
  await abruf('k-letzter')
  wieder2()
  pruefe(w.z.stapel === 1 && zeile(w.db, tag0, -1) === BUCHEN_AB + 1, `Abrufe stehen in feed_abrufe (${zeile(w.db, tag0, -1)} von ${BUCHEN_AB + 1})`)
  const leer = await abruf('')
  pruefe(leer.status === 400, 'leere Adresse: 400, ungezählt')
}

console.log(fehler ?`\n${fehler} Zusicherung(en) verletzt.` : '\nFeed-Zähler: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
