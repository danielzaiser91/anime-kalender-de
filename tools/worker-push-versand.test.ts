/**
 * **Push-Versand unter dem Unteraufruf-Budget** (23.10.2026): der stündliche Aufruf braucht ohne Push 35 von 50 Unteraufrufen
 * (docs/wissen/betrieb.md). Vorher kostete jedes Abo mindestens einen weiteren, mit Push drei. Jetzt: alle Stände in einem Stapel,
 * höchstens 8 Pushes je Lauf, die übrigen Abos behalten ihren Stand und kommen im nächsten Lauf als Erste dran.
 *
 * Aufruf: `npx tsx tools/worker-push-versand.test.ts`
 */
import type { DatabaseSync } from 'node:sqlite'
import { pushVersand } from '../worker/src/push.ts'
import type { PushEreignis } from '../worker/src/push-text.ts'
import { fetchAttrappe, neueDatenbank, testEnv, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

/** Freie Stufe 50, der stündliche Aufruf braucht ohne Push 35 (betrieb.md, 15.10.2026). */
const FREI = 15
const FOLGE = new Date('2026-10-23T09:00:00Z')
const JETZT = new Date('2026-10-23T10:00:00Z')
const EREIGNIS: PushEreignis = { titleId: 1, name: 'Test', date: '2026-10-23', time: '09:00', episode: 3 }
/** Das Ereignis gilt ab 09:00 als erschienen. */
const istErschienen = (_e: PushEreignis, zeit: Date) => zeit.getTime() >= FOLGE.getTime()

const pushAbrufe: string[] = []
let stapelAufrufe = 0
let stapelAnweisungen = 0

async function umgebung(db: DatabaseSync) {
  fetchAttrappe('2026-10-23')
  const basis = globalThis.fetch
  globalThis.fetch = (async (e: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url
    if (!url.startsWith('https://fcm.googleapis.com/')) return basis(e, init)
    zaehler.fetch++
    pushAbrufe.push(url)
    return new Response('', { status: url.includes('/tot') ? 410 : 201 })
  }) as typeof fetch
  const schluessel = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const privat = JSON.stringify(await crypto.subtle.exportKey('jwk', schluessel.privateKey))
  const env = { ...testEnv(db, 7), VAPID_PRIVATE_JWK: privat, VAPID_PUBLIC: 'oeffentlich' }
  const batch = env.DB.batch.bind(env.DB)
  env.DB.batch = ((liste: unknown[]) => {
    stapelAufrufe++
    stapelAnweisungen += liste.length
    return batch(liste as never)
  }) as typeof env.DB.batch
  return env
}

function abos(db: DatabaseSync, anzahl: number, o: { favoriten?: string; zuletzt?: string | null; vorsilbe?: string } = {}) {
  db.exec('DELETE FROM push_abo')
  const neu = db.prepare('INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES (?1, ?2, ?3, ?4, ?5)')
  for (let i = 0; i < anzahl; i++) {
    const nummer = String(i).padStart(3, '0')
    /* Älteste zuerst: die Reihenfolge der Abfrage ist die Reihenfolge der Nummern. */
    const zuletzt = o.zuletzt === undefined ? `2026-10-23T08:0${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}Z` : o.zuletzt
    neu.run(`https://fcm.googleapis.com/${o.vorsilbe ?? ''}${nummer}`, o.favoriten ?? 'ak:1', '2026-10-01', zuletzt, '')
  }
}

const unteraufrufe = () => zaehler.fetch + (zaehler.d1 - stapelAnweisungen) + stapelAufrufe
const nullen = () => {
  zaehlerZurueck()
  pushAbrufe.length = 0
  stapelAufrufe = 0
  stapelAnweisungen = 0
}
const zeilen = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Record<string, unknown>[]
const lauf = (env: Awaited<ReturnType<typeof umgebung>>, jetzt = JETZT) => pushVersand(env, jetzt, [EREIGNIS], istErschienen)

async function vieleMitNeuigkeit() {
  console.log('100 Abos, alle mit Neuigkeit:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 100)
  nullen()
  const meldung = await lauf(env)
  pruefe(pushAbrufe.length === 8, `genau 8 Pushes abgerufen (${pushAbrufe.length})`)
  pruefe(unteraufrufe() <= FREI, `höchstens ${FREI} Unteraufrufe (${unteraufrufe()})`)
  pruefe(meldung.includes('92 aufgeschoben'), `Meldung nennt die 92 aufgeschobenen Abos (${meldung})`)
  pruefe(zeilen(db, `SELECT 1 FROM push_abo WHERE zuletzt = '${JETZT.toISOString()}' AND offen IS NOT NULL`).length === 8, '8 Abos mit neuem Stand und offenem Text')
  pruefe(zeilen(db, `SELECT 1 FROM push_abo WHERE zuletzt < '${FOLGE.toISOString()}' AND offen IS NULL`).length === 92, '92 Abos mit altem Stand, ohne Text')
  /* Die am längsten wartenden Abos (kleinste Nummern) sind dran. */
  pruefe(pushAbrufe.every((u) => Number(u.slice(-3)) < 8), 'die 8 ältesten Abos zuerst')
}

async function folgeLaeufe() {
  console.log('Folgeläufe bis alle dran waren:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 100)
  nullen()
  for (let i = 0; i < 13; i++) await lauf(env, new Date(JETZT.getTime() + i * 60_000))
  const je = new Map<string, number>()
  for (const u of pushAbrufe) je.set(u, (je.get(u) ?? 0) + 1)
  pruefe(pushAbrufe.length === 100 && je.size === 100, `nach 13 Läufen hat jedes der 100 Abos genau einen Push (${pushAbrufe.length} Abrufe, ${je.size} Abos)`)
  pruefe([...je.values()].every((n) => n === 1), 'kein Abo doppelt')
}

async function ohneNeuigkeit() {
  console.log('100 Abos ohne Neuigkeit:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 100, { favoriten: 'ak:2' })
  nullen()
  const meldung = await lauf(env)
  pruefe(pushAbrufe.length === 0 && meldung.includes('0 aufgeschoben'), `kein Push, nichts aufgeschoben (${meldung})`)
  pruefe(unteraufrufe() <= 5, `höchstens 5 Unteraufrufe bei 100 Abos (${unteraufrufe()})`)
  pruefe(zeilen(db, `SELECT 1 FROM push_abo WHERE zuletzt = '${JETZT.toISOString()}'`).length === 100, 'alle 100 Abos haben den neuen Stand')
}

async function sonderfaelle() {
  console.log('Erstlauf, erloschene Abos, Rest unberührt:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 3, { zuletzt: null })
  nullen()
  await lauf(env)
  pruefe(pushAbrufe.length === 0, 'Erstlauf eines Abos schickt nichts')
  pruefe(zeilen(db, `SELECT 1 FROM push_abo WHERE zuletzt = '${JETZT.toISOString()}'`).length === 3, 'Erstlauf merkt sich den Zeitpunkt')
  abos(db, 3, { vorsilbe: 'tot' })
  db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/lebt', 'ak:1', '2026-10-01', '2026-10-23T08:30:00Z', '')`)
  nullen()
  const meldung = await lauf(env)
  pruefe(zeilen(db, 'SELECT endpoint FROM push_abo').length === 1 && meldung.includes('3 erloschen'), `410 löscht die 3 erloschenen Abos in einem Stapel (${meldung})`)
  pruefe(stapelAufrufe === 2, `zwei Stapel: Stände und Löschung (${stapelAufrufe})`)
}

await vieleMitNeuigkeit()
await folgeLaeufe()
await ohneNeuigkeit()
await sonderfaelle()
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nPush-Versand: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
