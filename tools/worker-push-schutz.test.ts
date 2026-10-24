/**
 * **Schutz von `/push/abo` und `/push/test`** (B4, 24.10.2026): 30 Anfragen je IP und Stunde, nur echte Push-Dienste,
 * höchstens 350 Abos, Löschlauf für Abos ohne Erneuerung seit 90 Tagen, und `/restore` zählt vor der Aktion.
 * Läuft über `worker.fetch` gegen eine echte SQLite-Datenbank mit allen Migrationen (Auslöser inklusive).
 *
 * Aufruf: `npx tsx tools/worker-push-schutz.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import worker from '../worker/src/index.ts'
import { loescheAbgelaufenes } from '../worker/src/loeschfristen.ts'
import type { Env } from '../worker/src/env.ts'
import { festeUhr } from './feste-uhr.ts'
import { abonnenten, d1, fetchAttrappe, neueDatenbank, testEnv, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

festeUhr('2026-10-12T12:00:00Z')
fetchAttrappe('2026-10-12')

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

const FCM = (i: number | string) => `https://fcm.googleapis.com/fcm/send/${i}`
const zeilen = (db: DatabaseSync) => Number((db.prepare('SELECT COUNT(*) AS n FROM push_abo').get() as { n: number }).n)
const zaehlerWert = (db: DatabaseSync) => Number((db.prepare('SELECT anzahl FROM push_zaehler WHERE id = 1').get() as { anzahl: number }).anzahl)
const geaendert = (db: DatabaseSync) => Number((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n)

async function umgebung(): Promise<{ db: DatabaseSync; env: Env }> {
  const db = neueDatenbank()
  const paar = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', paar.privateKey))
  return { db, env: { ...testEnv(db, 7), VAPID_PRIVATE_JWK: jwk, VAPID_PUBLIC: 'attrappe' } as Env }
}

/** `ip` leer: Anfrage ohne `cf-connecting-ip`-Kopf. */
const rufe = (env: Env, pfad: string, body: unknown, ip: string) =>
  worker.fetch(
    new Request(`https://w.example.invalid${pfad}`, {
      method: 'POST',
      headers: ip ? { 'content-type': 'application/json', 'cf-connecting-ip': ip } : { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil() {} } as unknown as ExecutionContext,
  )
const abo = (env: Env, endpoint: string, ip = '1.1.1.1', zusatz: object = {}) => rufe(env, '/push/abo', { subscription: { endpoint }, favoriten: [1, 2], ak: 1, ...zusatz }, ip)

async function jeIp() {
  const { db, env } = await umgebung()
  for (let i = 1; i <= 30; i++) pruefe((await abo(env, FCM(i))).status === 200, `IP: Anfrage ${i} geht durch`)
  const vorher = geaendert(db)
  const einunddreissigste = await abo(env, FCM(31))
  pruefe(einunddreissigste.status === 429, 'IP: 31. Anfrage einer IP -> 429')
  pruefe(geaendert(db) === vorher, `IP: abgewiesene Anfrage schreibt 0 Zeilen (gezählt: ${geaendert(db) - vorher})`)
  pruefe(zeilen(db) === 30, 'IP: kein 31. Abo gespeichert')
  pruefe((await abo(env, FCM(32), '2.2.2.2')).status === 200, 'IP: andere IP bleibt unberührt')
  pruefe((await rufe(env, '/push/test', { subscription: { endpoint: FCM(1) } }, '1.1.1.1')).status === 200, 'IP: /push/test hat einen eigenen Zähler')
  for (let i = 2; i <= 30; i++) await rufe(env, '/push/test', { subscription: { endpoint: FCM(1) } }, '1.1.1.1')
  const test31 = await rufe(env, '/push/test', { subscription: { endpoint: FCM(1) } }, '1.1.1.1')
  pruefe(test31.status === 429, 'IP: 31. /push/test einer IP -> 429')
  pruefe((await rufe(env, '/push/test', { subscription: { endpoint: FCM(1) } }, '3.3.3.3')).status === 200, 'IP: /push/test anderer IP unberührt')
  const global = db.prepare("SELECT key FROM rate_limit WHERE key IN ('push-abo', 'push-test')").all()
  pruefe(global.length === 0, 'IP: kein globaler Zähler mehr')
}

async function hosts() {
  const { db, env } = await umgebung()
  const gut = [
    FCM(1),
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://jmt17.google.com.push.apple.com/x',
  ]
  for (const e of gut) pruefe((await abo(env, e, `9.9.9.${gut.indexOf(e)}`)).status === 200, `Host ok: ${new URL(e).hostname}`)
  const schlecht = [
    'https://fcm.googleapis.com.evil.test/x',
    'https://evilfcm.googleapis.com/x',
    'https://evil.test/fcm.googleapis.com',
    'https://evil.test/?u=updates.push.services.mozilla.com',
    'http://fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://user@fcm.googleapis.com/x',
    'https://notify.windows.com/x',
    'https://xnotify.windows.com/x',
    'https://example.com/x',
    'fcm.googleapis.com',
  ]
  const vorher = zeilen(db)
  for (const e of schlecht) {
    const r = await abo(env, e, `8.8.8.${schlecht.indexOf(e)}`)
    pruefe(r.status === 400, `Host abgelehnt (400): ${e}`)
  }
  pruefe(zeilen(db) === vorher, 'Host: keine Zeile für fremde Hosts')
  const lang = await abo(env, `https://fcm.googleapis.com/${'a'.repeat(1000)}`, '7.7.7.7')
  pruefe(lang.status === 400, 'Host: Endpunkt über 1000 Zeichen -> 400')
  const genau = await abo(env, `https://fcm.googleapis.com/${'a'.repeat(973)}`, '7.7.7.9')
  const eins = await abo(env, `https://fcm.googleapis.com/${'a'.repeat(974)}`, '7.7.7.10')
  pruefe(genau.status === 200 && eins.status === 400, 'Host: 1000 Zeichen ok, 1001 -> 400')
  const mozilla = await abo(env, 'https://autopush.push.services.mozilla.com/x', '7.7.7.8')
  pruefe(mozilla.status === 200, 'Host: Unterdomäne von push.services.mozilla.com ok')

  zaehlerZurueck()
  const test = await rufe(env, '/push/test', { subscription: { endpoint: 'https://fcm.googleapis.com.evil.test/x' } }, '6.6.6.6')
  pruefe(zaehler.fetch === 0, 'Host: /push/test ruft einen fremden Host nicht ab')
  pruefe(((await test.json()) as { ok: boolean }).ok === false, 'Host: /push/test meldet ok=false')
  await rufe(env, '/push/test', { subscription: { endpoint: FCM(1) } }, '6.6.6.7')
  pruefe(zaehler.fetch === 1, 'Host: /push/test ruft einen echten Push-Dienst ab (1 Abruf)')
}

async function obergrenze() {
  const { db, env } = await umgebung()
  db.exec(`WITH RECURSIVE z(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM z WHERE i < 349)
           INSERT INTO push_abo (endpoint, favoriten, erstellt) SELECT 'https://fcm.googleapis.com/f/' || i, '', '2026-10-01' FROM z`)
  pruefe(zeilen(db) === 349 && zaehlerWert(db) === 349, `Grenze: Zähler folgt den Auslösern (${zaehlerWert(db)})`)
  pruefe((await abo(env, FCM('letztes'), '4.4.4.1')).status === 200, 'Grenze: das 350. Abo wird angelegt')
  pruefe(zaehlerWert(db) === 350, 'Grenze: Zähler 350')
  zaehlerZurueck()
  const vorher = geaendert(db)
  const voll = await abo(env, FCM('zuviel'), '4.4.4.2')
  pruefe(voll.status === 507, 'Grenze: das 351. Abo -> 507')
  pruefe(((await voll.json()) as { code?: string }).code === 'push_voll', 'Grenze: Fehlercode push_voll')
  pruefe(zeilen(db) === 350, 'Grenze: keine Zeile für das 351. Abo')
  pruefe(geaendert(db) - vorher === 1, `Grenze: abgewiesene Anfrage schreibt nur den IP-Zähler (gezählt: ${geaendert(db) - vorher})`)
  pruefe(zaehler.sql.some((s) => /FROM push_abo\b/.test(s) && /COUNT\(/i.test(s)) === false, 'Grenze: kein COUNT über push_abo je Anfrage')
  db.prepare('UPDATE push_abo SET erneuert = ?2 WHERE endpoint = ?1').run(FCM('letztes'), '2026-01-01')
  const vorhanden = await abo(env, FCM('letztes'), '4.4.4.3', { favoriten: [7] })
  pruefe(vorhanden.status === 200, 'Grenze: bestehendes Abo darf bei voller Tabelle Favoriten nachführen')
  const fav = (db.prepare('SELECT favoriten FROM push_abo WHERE endpoint = ?1').get(FCM('letztes')) as { favoriten: string }).favoriten
  const erneuert = (db.prepare('SELECT erneuert FROM push_abo WHERE endpoint = ?1').get(FCM('letztes')) as { erneuert: string }).erneuert
  pruefe(erneuert.startsWith('2026-10-12'), `Grenze: Erneuerung setzt den Zeitpunkt (${erneuert})`)
  pruefe(/7/.test(fav) && !/2/.test(fav), `Grenze: Favoriten nachgeführt (${fav})`)
  pruefe((await abo(env, FCM('letztes'), '4.4.4.4', { abmelden: true })).status === 200 && zaehlerWert(db) === 349, 'Grenze: Abmelden senkt den Zähler')
  pruefe((await abo(env, FCM('zuviel'), '4.4.4.5')).status === 200, 'Grenze: nach dem Abmelden ist wieder Platz')
  db.prepare("DELETE FROM push_abo WHERE endpoint LIKE 'https://fcm.googleapis.com/f/1%'").run()
  pruefe(zaehlerWert(db) === zeilen(db), `Grenze: Zähler stimmt nach Massenlöschung (${zaehlerWert(db)} = ${zeilen(db)})`)
}

async function loeschlauf() {
  const { db, env } = await umgebung()
  const neu = db.prepare('INSERT INTO push_abo (endpoint, favoriten, erstellt, erneuert) VALUES (?1, \'\', ?2, ?3)')
  const jetzt = new Date('2026-10-12T03:00:00Z')
  const grenze = '2026-07-14T03:00:00.000Z'
  neu.run('alt-erneuert', '2026-01-01', '2026-07-14T02:59:59.000Z')
  neu.run('genau', '2026-01-01', grenze)
  neu.run('frisch', '2026-01-01', '2026-10-11T00:00:00.000Z')
  neu.run('alt-ohne', '2026-07-01T00:00:00.000Z', null)
  neu.run('neu-ohne', '2026-10-01T00:00:00.000Z', null)
  neu.run('alt-gebraucht', '2026-01-01', '2026-09-30T00:00:00.000Z')
  const fruehMorgens = await loescheAbgelaufenes(env as never, new Date('2026-10-12T04:00:00Z'))
  pruefe(fruehMorgens.pushTot === 0 && zeilen(db) === 6, 'Löschlauf: außerhalb der Tagesstunde bleibt push_abo unberührt')
  const n = await loescheAbgelaufenes(env as never, jetzt)
  const bleibt = (db.prepare('SELECT endpoint FROM push_abo ORDER BY endpoint').all() as { endpoint: string }[]).map((z) => z.endpoint)
  pruefe(n.pushTot === 2, `Löschlauf: 2 tote Abos gelöscht (${n.pushTot})`)
  pruefe(bleibt.join(',') === 'alt-gebraucht,frisch,genau,neu-ohne', `Löschlauf: Rest = ${bleibt.join(',')}`)
  pruefe(zaehlerWert(db) === 4, 'Löschlauf: Zähler folgt (4)')
  const stoerung = { DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 weg') } }) }) } }
  const fall = await loescheAbgelaufenes(stoerung as never, jetzt)
  pruefe(fall.pushTot === 0 && fall.rateLimit === 0, 'Löschlauf: Datenbankfehler -> Zählung 0')
  void d1
}

async function wiederherstellung() {
  const { db, env } = await umgebung()
  abonnenten(db, 1)
  const restore = (ip: string, email: string) => rufe(env, '/restore', { email }, ip)
  for (let i = 0; i < 10; i++) await restore('5.5.5.5', 'unbekannt@example.invalid')
  const z = db.prepare("SELECT count FROM rate_limit WHERE key = 'restore-ip:5.5.5.5'").get() as { count: number }
  pruefe(z.count === 10, `Restore: auch Versuche ohne Treffer zählen (Zähler ${z.count})`)
  zaehlerZurueck()
  const elfte = await restore('5.5.5.5', 'a0@example.invalid')
  pruefe(zaehler.einzelmails === 0, 'Restore: 11. Anfrage einer IP löst keine Mail aus')
  pruefe(((await elfte.json()) as { ok: boolean }).ok === true, 'Restore: Antwort bleibt gleich (kein Hinweis auf die Sperre)')
  await restore('5.5.5.6', 'a0@example.invalid')
  pruefe(zaehler.einzelmails === 1, 'Restore: andere IP bekommt ihre Mail')
}

/** Datenbank mit allen Migrationen bis vor 062; danach spielt der Test 062 ein, so wie es D1 mit vorhandenen Abos tut. */
function vorMigration062(): { db: DatabaseSync; einspielen: () => void } {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync('worker/schema.sql', 'utf8'))
  const alle = readdirSync('worker/migrations').sort()
  const teile = (datei: string) => readFileSync(`worker/migrations/${datei}`, 'utf8').split(/;\s*\n/)
  const spiele = (datei: string) => {
    for (const teil of teile(datei)) {
      try {
        db.exec(teil)
      } catch {
        /* Spalte oder Tabelle gibt es schon */
      }
    }
  }
  for (const datei of alle.filter((d) => !d.startsWith('062-'))) spiele(datei)
  return { db, einspielen: () => spiele('062-push-je-ip.sql') }
}

async function altbestand() {
  const { db, einspielen } = vorMigration062()
  const neu = db.prepare("INSERT INTO push_abo (endpoint, favoriten, erstellt) VALUES (?1, '', ?2)")
  neu.run('https://fcm.googleapis.com/alt', '2025-03-01T00:00:00.000Z')
  for (let i = 1; i < 349; i++) neu.run(FCM(`v${i}`), '2026-09-01T00:00:00.000Z')
  einspielen()
  pruefe(zaehlerWert(db) === 349, `Altbestand: Zähler startet mit der Zeilenzahl (${zaehlerWert(db)})`)
  const alt = db.prepare('SELECT erneuert FROM push_abo WHERE endpoint = ?1').get('https://fcm.googleapis.com/alt') as { erneuert: string | null }
  pruefe((alt.erneuert ?? '') > '2026-10-12', 'Altbestand: Altzeile bekommt `erneuert` = Einspielzeitpunkt')
  const n = await loescheAbgelaufenes({ DB: d1(db) } as never, new Date('2026-10-12T03:00:00Z'))
  pruefe(n.pushTot === 0 && zeilen(db) === 349, `Altbestand: Altzeile direkt nach der Migration wird im ersten Löschlauf nicht gelöscht (${n.pushTot})`)
  const env = { ...testEnv(db, 7) } as Env
  pruefe((await abo(env, FCM('350'), '5.1.1.1')).status === 200, 'Altbestand: das 350. Abo geht, Zähler zählt von 349')
  pruefe((await abo(env, FCM('351'), '5.1.1.2')).status === 507, 'Altbestand: das 351. Abo -> 507')
}

async function ohneIp() {
  const { env, db } = await umgebung()
  const ohne = (i: number) => rufe(env, '/push/abo', { subscription: { endpoint: FCM(i) }, favoriten: [1], ak: 1 }, '')
  for (let i = 1; i <= 30; i++) await ohne(i)
  const r = await ohne(31)
  pruefe(r.status === 429, 'Ohne IP-Kopf: gemeinsamer Topf `unbekannt`, 31. Anfrage -> 429')
  const z = db.prepare("SELECT count FROM rate_limit WHERE key = 'push-abo-ip:unbekannt'").get() as { count: number } | undefined
  pruefe(z?.count === 30, `Ohne IP-Kopf: Zähler push-abo-ip:unbekannt = 30 (${z?.count})`)
  pruefe((await abo(env, FCM(99), '6.6.6.6')).status === 200, 'Ohne IP-Kopf: Anfrage mit Kopf bleibt unberührt')
  const t = await rufe(env, '/push/test', { subscription: { endpoint: FCM(1) } }, '')
  pruefe(t.status === 200, '/push/test ohne IP-Kopf: eigener Topf, geht durch')
}

await jeIp()
await altbestand()
await ohneIp()
await hosts()
await obergrenze()
await loeschlauf()
await wiederherstellung()
console.log(fehler ? `${fehler} Fehler` : 'Push-Schutz: 30/h je IP, Host-Liste, 350-Grenze, Löschlauf 90 Tage, Restore zählt vorab – alle Fälle ok')
process.exit(fehler ? 1 : 0)
