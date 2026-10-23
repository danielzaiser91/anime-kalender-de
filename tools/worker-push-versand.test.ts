/**
 * **Push-Versand unter dem Unteraufruf-Budget** (23.10.2026): der stündliche Aufruf braucht ohne Push 35 von 50 Unteraufrufen
 * (docs/wissen/betrieb.md). Vorher kostete jedes Abo mindestens einen weiteren, mit Push drei. Jetzt: alle Stände in einer Anweisung (json_each),
 * höchstens 8 Pushes je Lauf, die übrigen Abos behalten ihren Stand und kommen im nächsten Lauf als Erste dran.
 *
 * Aufruf: `npx tsx tools/worker-push-versand.test.ts`
 */
import type { DatabaseSync } from 'node:sqlite'
import { pushVersand } from '../worker/src/push.ts'
import type { PushEreignis } from '../worker/src/push-text.ts'
import { fetchAttrappe, neueDatenbank, testEnv, unteraufrufe, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

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

async function umgebung(db: DatabaseSync) {
  fetchAttrappe('2026-10-23')
  const basis = globalThis.fetch
  globalThis.fetch = (async (e: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url
    if (!url.startsWith('https://fcm.googleapis.com/')) return basis(e, init)
    zaehler.fetch++
    pushAbrufe.push(url)
    if (url.includes('/netz')) throw new TypeError('fetch failed')
    return new Response('', { status: url.includes('/tot') ? 410 : url.includes('/weg') ? 404 : 201 })
  }) as typeof fetch
  const schluessel = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const privat = JSON.stringify(await crypto.subtle.exportKey('jwk', schluessel.privateKey))
  const env = { ...testEnv(db, 7), VAPID_PRIVATE_JWK: privat, VAPID_PUBLIC: 'oeffentlich' }
  return env
}

function abos(db: DatabaseSync, anzahl: number, o: { favoriten?: string; zuletzt?: string | null; vorsilbe?: string } = {}) {
  db.exec('DELETE FROM push_abo')
  const neu = db.prepare('INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES (?1, ?2, ?3, ?4, ?5)')
  for (let i = anzahl - 1; i >= 0; i--) {
    const nummer = String(i).padStart(3, '0')
    /* Die älteste Nummer 000 wird als Letzte eingefügt: nur ORDER BY bringt sie nach vorn. */
    const zuletzt = o.zuletzt === undefined ? `2026-10-23T08:0${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}Z` : o.zuletzt
    neu.run(`https://fcm.googleapis.com/${o.vorsilbe ?? ''}${nummer}`, o.favoriten ?? 'ak:1', '2026-10-01', zuletzt, '')
  }
}

const nullen = () => {
  zaehlerZurueck()
  pushAbrufe.length = 0
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
  pruefe(unteraufrufe() <= FREI, `höchstens ${FREI} Unteraufrufe bei 100 Abos (${unteraufrufe()})`)
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
  abos(db, 2, { vorsilbe: 'tot' })
  db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/weg', 'ak:1', '2026-10-01', '2026-10-23T08:20:00Z', '')`)
  db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/lebt', 'ak:1', '2026-10-01', '2026-10-23T08:30:00Z', '')`)
  nullen()
  const meldung = await lauf(env)
  pruefe(zeilen(db, 'SELECT endpoint FROM push_abo').length === 1 && meldung.includes('1 Pushes, 3 erloschen'), `404 und 410 löschen die 3 erloschenen Abos in einem Stapel, der angenommene Push zählt (${meldung})`)
  const art = (vorsilbe: string) => zaehler.sql.filter((q) => q.startsWith(vorsilbe)).length
  pruefe(art('UPDATE') === 1 && art('DELETE') === 1, `eine Anweisung für alle Stände, eine für alle Löschungen (${art('UPDATE')}, ${art('DELETE')})`)
}

async function gemischtUndWeitere() {
  console.log('Abos ohne Neuigkeit hinter 8 mit Neuigkeit, Meldung „jetzt auch bei“:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 8)
  for (let i = 0; i < 5; i++) {
    db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/ruhig${i}', 'ak:2', '2026-10-01', '2026-10-23T08:30:0${i}Z', '')`)
  }
  nullen()
  await lauf(env)
  const ruhig = `SELECT 1 FROM push_abo WHERE endpoint LIKE '%ruhig%' AND zuletzt = '${JETZT.toISOString()}'`
  pruefe(zeilen(db, ruhig).length === 5, 'Abos ohne Neuigkeit werden auch nach dem 8. Push fortgeschrieben')
  pruefe(zeilen(db, 'SELECT 1 FROM push_abo WHERE offen_ziel IS NOT NULL').length === 8, 'jedes der 8 Abos trägt Text und Ziel')
  db.exec(`UPDATE push_abo SET offen = 'alt', offen_ziel = 'altziel' WHERE endpoint LIKE '%ruhig0'`)
  await lauf(env, new Date(JETZT.getTime() + 60_000))
  const alt = zeilen(db, "SELECT offen, offen_ziel FROM push_abo WHERE endpoint LIKE '%ruhig0'")[0]!
  pruefe(alt.offen === 'alt' && alt.offen_ziel === 'altziel', 'ein noch nicht abgeholter Text bleibt stehen, wenn nichts Neues kommt')
  const weitere = [{ id: 77, name: 'Serie', anbieter: 'Netflix' }]
  abos(db, 1, { favoriten: 'ak:77' })
  nullen()
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  const erste = zeilen(db, 'SELECT offen, gemeldet FROM push_abo')[0]!
  pruefe(String(erste.offen).includes('Serie') && erste.gemeldet === '77:Netflix', 'neue Meldung „jetzt auch bei“ erreicht das Abo und wird vermerkt')
  db.exec('UPDATE push_abo SET offen = NULL')
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  pruefe(zeilen(db, 'SELECT offen FROM push_abo')[0]!.offen === null, 'dieselbe Meldung kommt kein zweites Mal')
  abos(db, 1, { favoriten: 'ak:77', zuletzt: null })
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  const erstlauf = zeilen(db, 'SELECT offen, gemeldet FROM push_abo')[0]!
  pruefe(erstlauf.offen === null && erstlauf.gemeldet === '77:Netflix', 'Erstlauf vermerkt gemeldete Anbieter, schickt aber nichts')
  abos(db, 1, { favoriten: 'ak:77' })
  const lang = Array.from({ length: 250 }, (_, i) => `${i}:X`).join(String.fromCharCode(10))
  db.prepare('UPDATE push_abo SET gemeldet = ?1').run(lang)
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  const vermerkt = String(zeilen(db, 'SELECT gemeldet FROM push_abo')[0]!.gemeldet).split(String.fromCharCode(10))
  pruefe(vermerkt.length === 200 && vermerkt.at(-1) === '77:Netflix' && vermerkt[0] === '51:X', 'gemerkt werden die letzten 200 Meldungen')
  abos(db, 1, { favoriten: 'ak:5' })
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  pruefe(zeilen(db, 'SELECT offen FROM push_abo')[0]!.offen === null, 'Meldung zu einem fremden Titel erreicht das Abo nicht')
}

async function netzfehler() {
  console.log('Push-Abruf wirft (Netzfehler):')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 0)
  for (const name of ['a1', 'netz', 'tot', 'b2']) {
    db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/${name}', 'ak:1', '2026-10-01', '2026-10-23T08:30:00Z', 'alt')`)
  }
  nullen()
  const meldung = await lauf(env)
  const stand = (name: string) => zeilen(db, `SELECT zuletzt, offen, gemeldet FROM push_abo WHERE endpoint LIKE '%/${name}'`)[0]
  pruefe(pushAbrufe.length === 4 && meldung.includes('2 Pushes, 1 erloschen'), `die übrigen Pushes laufen weiter (${meldung})`)
  pruefe(stand('tot') === undefined, 'das erloschene Abo wird trotz des Fehlers gelöscht')
  pruefe(stand('a1')?.zuletzt === JETZT.toISOString() && stand('b2')?.zuletzt === JETZT.toISOString(), 'die gesendeten Abos haben den neuen Stand')
  const netz = stand('netz')
  pruefe(netz?.zuletzt === '2026-10-23T08:30:00Z' && netz.offen === null && netz.gemeldet === 'alt', 'das gescheiterte Abo behält den alten Stand, ohne offenen Text')
  nullen()
  await lauf(env, new Date(JETZT.getTime() + 60_000))
  pruefe(pushAbrufe.some((u) => u.endsWith('/netz')), 'im nächsten Lauf ist das gescheiterte Abo wieder dran')
}

await vieleMitNeuigkeit()
await netzfehler()
await gemischtUndWeitere()
await folgeLaeufe()
await ohneNeuigkeit()
await sonderfaelle()
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nPush-Versand: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
