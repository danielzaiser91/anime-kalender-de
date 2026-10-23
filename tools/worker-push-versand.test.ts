/**
 * **Push-Versand unter dem Unteraufruf-Budget und ohne Dauerschreiben** (23./24.10.2026): der stündliche Aufruf braucht ohne Push
 * 35 von 50 Unteraufrufen (docs/wissen/betrieb.md). Alle Stände in einer Anweisung (json_each), höchstens 8 Pushes je Lauf, die übrigen
 * Abos behalten ihren Stand. Dazu die globale Marke (`push_marke`): ohne neues Ereignis keine Lesezeile aus `push_abo`, keine
 * Schreibzeile; mit Ereignis nur die Abos mit passendem Titel geschrieben.
 *
 * Zeilenzählung (Cloudflare-Doku „D1 pricing“: gelesene Zeilen = gescannte Zeilen je Anweisung, Schreibzeilen = geänderte Zeilen einschließlich
 * Indexzeilen): hier zählt jede Anweisung auf `push_abo` einzeln, ein SELECT liest alle Zeilen der Tabelle (voller Durchlauf).
 *
 * Aufruf: `npx tsx tools/worker-push-versand.test.ts`
 */
import type { DatabaseSync } from 'node:sqlite'
import { pushVersand, schreibeMarke } from '../worker/src/push.ts'
import type { PushEreignis } from '../worker/src/push-text.ts'
import { d1, fetchAttrappe, neueDatenbank, testEnv, unteraufrufe, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

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
const VORHER = '2026-10-23T08:30:00.000Z'
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

/** Setzt die globale Marke (Tabelle push_marke) auf einen Stand vor dem Ereignis. */
function marke(db: DatabaseSync, zuletzt = VORHER, gemeldet = '') {
  db.prepare('INSERT OR REPLACE INTO push_marke (id, zuletzt, gemeldet) VALUES (1, ?1, ?2)').run(zuletzt, gemeldet)
}
const markeStand = (db: DatabaseSync) => db.prepare('SELECT zuletzt, gemeldet FROM push_marke').get() as { zuletzt: string; gemeldet: string }

const nullen = () => {
  zaehlerZurueck()
  pushAbrufe.length = 0
}
const zeilen = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Record<string, unknown>[]
const lauf = (env: Awaited<ReturnType<typeof umgebung>>, jetzt = JETZT) => pushVersand(env, jetzt, [EREIGNIS], istErschienen)
/** Anweisungen dieses Laufs, die `push_abo` lesen bzw. ändern. */
const aboLesen = () => zaehler.sql.filter((q) => /^\s*SELECT[\s\S]*FROM push_abo/i.test(q)).length
const aboSchreiben = () => zaehler.sql.filter((q) => /^\s*(UPDATE|DELETE|INSERT)[\s\S]*push_abo/i.test(q)).length
const stand = (db: DatabaseSync) => JSON.stringify(zeilen(db, 'SELECT * FROM push_abo ORDER BY endpoint'))

async function vieleMitNeuigkeit() {
  console.log('100 Abos, alle mit Neuigkeit:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 100)
  marke(db)
  nullen()
  const meldung = await lauf(env)
  pruefe(pushAbrufe.length === 8, `genau 8 Pushes abgerufen (${pushAbrufe.length})`)
  pruefe(unteraufrufe() <= FREI, `höchstens ${FREI} Unteraufrufe (${unteraufrufe()})`)
  pruefe(meldung.includes('92 aufgeschoben'), `Meldung nennt die 92 aufgeschobenen Abos (${meldung})`)
  pruefe(zeilen(db, `SELECT 1 FROM push_abo WHERE zuletzt = '${JETZT.toISOString()}' AND offen IS NOT NULL`).length === 8, '8 Abos mit neuem Stand und offenem Text')
  pruefe(zeilen(db, `SELECT 1 FROM push_abo WHERE zuletzt < '${FOLGE.toISOString()}' AND offen IS NULL`).length === 92, '92 Abos mit altem Stand, ohne Text')
  pruefe(markeStand(db).zuletzt === VORHER, 'aufgeschoben: die Marke rückt nicht vor')
  /* Die am längsten wartenden Abos (kleinste Nummern) sind dran. */
  pruefe(pushAbrufe.every((u) => Number(u.slice(-3)) < 8), 'die 8 ältesten Abos zuerst')
}

async function folgeLaeufe() {
  console.log('Folgeläufe bis alle dran waren:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 100)
  marke(db)
  nullen()
  for (let i = 0; i < 12; i++) await lauf(env, new Date(JETZT.getTime() + i * 60_000))
  pruefe(markeStand(db).zuletzt === VORHER, 'nach 12 Läufen (96 Abos) steht die Marke noch')
  const letzter = new Date(JETZT.getTime() + 12 * 60_000)
  await lauf(env, letzter)
  pruefe(markeStand(db).zuletzt === letzter.toISOString(), 'der 13. Lauf bedient den Rest, jetzt rückt die Marke vor')
  const je = new Map<string, number>()
  for (const u of pushAbrufe) je.set(u, (je.get(u) ?? 0) + 1)
  pruefe(pushAbrufe.length === 100 && je.size === 100, `nach 13 Läufen hat jedes der 100 Abos genau einen Push (${pushAbrufe.length} Abrufe, ${je.size} Abos)`)
  pruefe([...je.values()].every((n) => n === 1), 'kein Abo doppelt')
}

async function ohneNeuigkeit() {
  console.log('100 Abos, das Ereignis betrifft keines:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 100, { favoriten: 'ak:2' })
  marke(db)
  const vorher = stand(db)
  nullen()
  const meldung = await lauf(env)
  pruefe(pushAbrufe.length === 0 && meldung.includes('0 aufgeschoben'), `kein Push, nichts aufgeschoben (${meldung})`)
  pruefe(unteraufrufe() <= FREI, `höchstens ${FREI} Unteraufrufe bei 100 Abos (${unteraufrufe()})`)
  pruefe(stand(db) === vorher && aboSchreiben() === 0, 'kein Abo wurde geschrieben')
  pruefe(markeStand(db).zuletzt === JETZT.toISOString(), 'die Marke rückt vor, der nächste Lauf liest die Abos nicht mehr')
  nullen()
  await lauf(env, new Date(JETZT.getTime() + 60_000))
  pruefe(aboLesen() === 0 && aboSchreiben() === 0, 'Folgelauf ohne neues Ereignis: keine Anweisung auf push_abo')
}

async function sonderfaelle() {
  console.log('Erstlauf, erloschene Abos, Rest unberührt:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 3, { zuletzt: null })
  nullen()
  await lauf(env)
  pruefe(pushAbrufe.length === 0 && aboLesen() === 0 && aboSchreiben() === 0, 'Erstlauf schickt nichts und fasst push_abo nicht an')
  pruefe(markeStand(db).zuletzt === JETZT.toISOString(), 'Erstlauf setzt nur die Marke')
  abos(db, 2, { vorsilbe: 'tot' })
  db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/weg', 'ak:1', '2026-10-01', '2026-10-23T08:20:00Z', '')`)
  db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/lebt', 'ak:1', '2026-10-01', '2026-10-23T08:30:00Z', '')`)
  marke(db)
  nullen()
  const meldung = await lauf(env)
  pruefe(zeilen(db, 'SELECT endpoint FROM push_abo').length === 1 && meldung.includes('1 Pushes, 3 erloschen'), `404 und 410 löschen die 3 erloschenen Abos in einem Stapel, der angenommene Push zählt (${meldung})`)
  const art = (vorsilbe: string) => zaehler.sql.filter((q) => q.startsWith(vorsilbe)).length
  pruefe(art('UPDATE') === 1 && art('DELETE') === 1, `eine Anweisung für alle Stände, eine für alle Löschungen (${art('UPDATE')}, ${art('DELETE')})`)
}

async function neuesAbo() {
  console.log('Abo, das nach dem Ereignis angemeldet wurde:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 0)
  const neu = db.prepare('INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES (?1, ?2, ?3, NULL, ?4)')
  neu.run('https://fcm.googleapis.com/spaet', 'ak:1', '2026-10-23T09:30:00Z', '')
  neu.run('https://fcm.googleapis.com/frueh', 'ak:1', '2026-10-23T08:45:00Z', '')
  marke(db)
  nullen()
  await lauf(env)
  pruefe(pushAbrufe.length === 1 && pushAbrufe[0]!.endsWith('/frueh'), `nur das Abo von vor dem Ereignis bekommt den Push (${pushAbrufe.join(',')})`)
}

async function gemischtUndWeitere() {
  console.log('Abos ohne Neuigkeit hinter 8 mit Neuigkeit, Meldung „jetzt auch bei“:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 8)
  for (let i = 0; i < 5; i++) {
    db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/ruhig${i}', 'ak:2', '2026-10-01', '2026-10-23T08:30:0${i}Z', '')`)
  }
  marke(db)
  nullen()
  await lauf(env)
  const ruhig = `SELECT 1 FROM push_abo WHERE endpoint LIKE '%ruhig%' AND zuletzt = '2026-10-23T08:30:0' || substr(endpoint, -1) || 'Z'`
  pruefe(zeilen(db, ruhig).length === 5, 'Abos ohne Neuigkeit bleiben unberührt (alter Stand)')
  pruefe(zeilen(db, 'SELECT 1 FROM push_abo WHERE offen_ziel IS NOT NULL').length === 8, 'jedes der 8 Abos trägt Text und Ziel')
  db.exec(`UPDATE push_abo SET offen = 'alt', offen_ziel = 'altziel' WHERE endpoint LIKE '%ruhig0'`)
  await lauf(env, new Date(JETZT.getTime() + 60_000))
  const alt = zeilen(db, "SELECT offen, offen_ziel FROM push_abo WHERE endpoint LIKE '%ruhig0'")[0]!
  pruefe(alt.offen === 'alt' && alt.offen_ziel === 'altziel', 'ein noch nicht abgeholter Text bleibt stehen, wenn nichts Neues kommt')
  const weitere = [{ id: 77, name: 'Serie', anbieter: 'Netflix' }]
  abos(db, 1, { favoriten: 'ak:77' })
  marke(db, VORHER, '')
  nullen()
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  const erste = zeilen(db, 'SELECT offen, gemeldet FROM push_abo')[0]!
  pruefe(String(erste.offen).includes('Serie') && erste.gemeldet === '77:Netflix', 'neue Meldung „jetzt auch bei“ erreicht das Abo und wird vermerkt')
  pruefe(markeStand(db).gemeldet === '77:Netflix', 'die globale Marke merkt sich die Meldung')
  db.exec('UPDATE push_abo SET offen = NULL')
  nullen()
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  pruefe(zeilen(db, 'SELECT offen FROM push_abo')[0]!.offen === null && aboLesen() === 0, 'dieselbe Meldung kommt kein zweites Mal und kostet keine Abo-Lesezeile')
  db.exec('DELETE FROM push_marke')
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  pruefe(zeilen(db, 'SELECT offen FROM push_abo')[0]!.offen === null && markeStand(db).gemeldet === '77:Netflix', 'Erstlauf vermerkt gemeldete Anbieter in der Marke, schickt aber nichts')
  abos(db, 1, { favoriten: 'ak:77' })
  const lang = Array.from({ length: 250 }, (_, i) => `${i}:X`).join(String.fromCharCode(10))
  db.prepare('UPDATE push_abo SET gemeldet = ?1').run(lang)
  marke(db, VORHER, '')
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  const vermerkt = String(zeilen(db, 'SELECT gemeldet FROM push_abo')[0]!.gemeldet).split(String.fromCharCode(10))
  pruefe(vermerkt.length === 200 && vermerkt.at(-1) === '77:Netflix' && vermerkt[0] === '51:X', 'gemerkt werden die letzten 200 Meldungen')
  abos(db, 1, { favoriten: 'ak:5' })
  marke(db, VORHER, '')
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  pruefe(zeilen(db, 'SELECT offen FROM push_abo')[0]!.offen === null, 'Meldung zu einem fremden Titel erreicht das Abo nicht')
  abos(db, 1, { favoriten: 'ak:77' })
  db.prepare("UPDATE push_abo SET gemeldet = '77:Netflix'").run()
  marke(db, VORHER, '')
  await pushVersand(env, JETZT, [], istErschienen, weitere)
  pruefe(zeilen(db, 'SELECT offen FROM push_abo')[0]!.offen === null, 'ein Abo, das die Meldung schon trägt (zuvor bedient, Marke blieb stehen), bekommt sie nicht noch einmal')
}

async function netzfehler() {
  console.log('Push-Abruf wirft (Netzfehler):')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 0)
  for (const name of ['a1', 'netz', 'netz-alt', 'tot', 'b2']) {
    db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/${name}', 'ak:1', '2026-10-01', '2026-10-23T08:30:00Z', 'alt')`)
  }
  db.exec("UPDATE push_abo SET favoriten = 'ak:1,77' WHERE endpoint LIKE '%/netz'")
  db.exec("UPDATE push_abo SET offen = 'frueher', offen_ziel = 'frueherziel' WHERE endpoint LIKE '%/netz-alt'")
  marke(db)
  nullen()
  const meldung = await pushVersand(env, JETZT, [EREIGNIS], istErschienen, [{ id: 77, name: 'Serie', anbieter: 'Netflix' }])
  const abo = (name: string) => zeilen(db, `SELECT zuletzt, offen, gemeldet FROM push_abo WHERE endpoint LIKE '%/${name}'`)[0]
  pruefe(pushAbrufe.length === 5 && meldung.includes('2 Pushes, 1 erloschen'), `die übrigen Pushes laufen weiter (${meldung})`)
  pruefe(abo('tot') === undefined, 'das erloschene Abo wird trotz des Fehlers gelöscht')
  pruefe(abo('a1')?.zuletzt === JETZT.toISOString() && abo('b2')?.zuletzt === JETZT.toISOString(), 'die gesendeten Abos haben den neuen Stand')
  const netz = abo('netz')
  pruefe(netz?.zuletzt === '2026-10-23T08:30:00Z' && netz.offen === null && netz.gemeldet === 'alt', 'das gescheiterte Abo behält den alten Stand, ohne offenen Text')
  const frueher = zeilen(db, "SELECT offen, offen_ziel FROM push_abo WHERE endpoint LIKE '%/netz-alt'")[0]
  pruefe(frueher?.offen === 'frueher' && frueher.offen_ziel === 'frueherziel', 'ein früherer, noch nicht abgeholter Text überlebt den Netzfehler (Text und Ziel)')
  pruefe(markeStand(db).zuletzt === VORHER && markeStand(db).gemeldet === '', 'Netzfehler: die Marke (Zeit und Meldungen) rückt nicht vor')
  nullen()
  await lauf(env, new Date(JETZT.getTime() + 60_000))
  pruefe(pushAbrufe.length === 2 && pushAbrufe.every((u) => u.includes('/netz')), `im nächsten Lauf sind nur die gescheiterten Abos wieder dran (${pushAbrufe.length})`)
  /* Dauerhaft werfendes Abo: stündlich neu versucht, 24 Stunden nach dem ersten Fehlschlag gibt die Marke nach. */
  const erster = markeFehler(db)
  pruefe(erster === JETZT.toISOString(), `der erste Fehlschlag steht in der Marke (${erster})`)
  for (let h = 2; h < 22; h++) await lauf(env, new Date(JETZT.getTime() + h * 3600_000))
  const knapp = new Date(JETZT.getTime() + 24 * 3600_000 - 1000)
  await lauf(env, knapp)
  pruefe(markeStand(db).zuletzt === VORHER && markeFehler(db) === erster, 'eine Sekunde vor 24 Stunden hält der Netzfehler die Marke noch, der Fehlerbeginn bleibt')
  const frist = new Date(JETZT.getTime() + 24 * 3600_000)
  await lauf(env, frist)
  pruefe(markeStand(db).zuletzt === frist.toISOString() && markeFehler(db) === null, 'nach 24 Stunden rückt die Marke trotz des Netzfehlers vor, der Fehlerbeginn ist gelöscht')
  nullen()
  await lauf(env, new Date(frist.getTime() + 3600_000))
  pruefe(aboLesen() === 0 && pushAbrufe.length === 0, 'danach liest der Lauf push_abo nicht mehr und versucht das Abo nicht mehr')
}

const markeFehler = (db: DatabaseSync) => (db.prepare('SELECT fehler_seit AS f FROM push_marke').get() as { f: string | null }).f

async function alteMarkeEinFehler() {
  console.log('Alte Marke (Wochenende), ein einziger Fehlschlag:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 0)
  db.exec(`INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES ('https://fcm.googleapis.com/netz', 'ak:1', '2026-10-01', '2026-10-20T08:30:00Z', '')`)
  marke(db, '2026-10-20T08:30:00.000Z')
  nullen()
  await lauf(env)
  pruefe(markeStand(db).zuletzt === '2026-10-20T08:30:00.000Z', 'die Frist zählt ab dem Fehlschlag, nicht ab dem Alter der Marke: sie steht noch')
  nullen()
  await lauf(env, new Date(JETZT.getTime() + 3600_000))
  pruefe(pushAbrufe.length === 1, 'das Abo wird in der nächsten Stunde noch einmal versucht')
}

async function tausendAbos() {
  console.log('1.000 Abos:')
  const db = neueDatenbank()
  const env = await umgebung(db)
  abos(db, 1000, { favoriten: 'ak:2', zuletzt: VORHER })
  marke(db, JETZT.toISOString())
  const vorher = stand(db)
  nullen()
  await lauf(env)
  pruefe(aboLesen() === 0 && aboSchreiben() === 0 && stand(db) === vorher, '0 neue Ereignisse: 0 Lesezeilen und 0 Schreibzeilen auf push_abo')
  pruefe(zaehler.d1 === 1, `ein einziger D1-Aufruf, die Marke (${zaehler.d1})`)
  /* CPU: viele alte Ereignisse, keines neu (Bestand 23.10.2026: 3.946 Termine). */
  const viele = Array.from({ length: 4000 }, (_, i) => ({ ...EREIGNIS, titleId: i }))
  const zeiten: number[] = []
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now()
    await pushVersand(env, JETZT, viele, istErschienen)
    zeiten.push(performance.now() - t0)
  }
  zeiten.sort((a, b) => a - b)
  const mitte = zeiten[3]!
  console.log(`  (Mitte aus 7 Läufen: ${mitte.toFixed(2)} ms, 4.000 Ereignisse, 1.000 Abos)`)
  pruefe(mitte < 2, 'Lauf ohne neues Ereignis unter 2 ms CPU')
  /* Ein neues Ereignis, 5 betroffene Abos. */
  abos(db, 1000, { favoriten: 'ak:2', zuletzt: VORHER })
  db.exec("UPDATE push_abo SET favoriten = 'ak:1' WHERE endpoint IN (SELECT endpoint FROM push_abo ORDER BY endpoint LIMIT 5 OFFSET 300)")
  marke(db)
  const alt = zeilen(db, 'SELECT * FROM push_abo ORDER BY endpoint')
  nullen()
  await lauf(env)
  const neu = zeilen(db, 'SELECT * FROM push_abo ORDER BY endpoint')
  const geaendert = neu.filter((z, i) => JSON.stringify(z) !== JSON.stringify(alt[i])).length
  pruefe(geaendert === 5 && pushAbrufe.length === 5, `1 neues Ereignis: Schreibzeilen = betroffene Abos (${geaendert} von 5, ${pushAbrufe.length} Pushes)`)
  pruefe(aboLesen() === 1 && aboSchreiben() === 1, 'ein Lesen (alle Abos, voller Durchlauf) und ein Stapel-UPDATE')
}

async function bedingterUpsert() {
  console.log('Marke: bedingter Upsert:')
  const db = neueDatenbank()
  const geaendert = () => Number((db.prepare('SELECT changes() AS n').get() as { n: number }).n)
  await schreibeMarke(d1(db), JETZT, ['a:b'])
  pruefe(geaendert() === 1, 'erstes Schreiben legt die Zeile an')
  await schreibeMarke(d1(db), JETZT, ['a:b'])
  pruefe(geaendert() === 0, 'gleicher Inhalt: keine Schreibzeile')
  await schreibeMarke(d1(db), JETZT, ['a:b', 'c:d'])
  pruefe(geaendert() === 1, 'andere Meldungen: eine Schreibzeile')
  await schreibeMarke(d1(db), new Date(JETZT.getTime() + 1000), ['a:b', 'c:d'])
  pruefe(geaendert() === 1, 'andere Zeit: eine Schreibzeile')
}

await vieleMitNeuigkeit()
await netzfehler()
await alteMarkeEinFehler()
await gemischtUndWeitere()
await folgeLaeufe()
await ohneNeuigkeit()
await sonderfaelle()
await neuesAbo()
await tausendAbos()
await bedingterUpsert()
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nPush-Versand: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
