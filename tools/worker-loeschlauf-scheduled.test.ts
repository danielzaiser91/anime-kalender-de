/**
 * **Der stündliche Takt löscht abgelaufene Daten** (Datenschutzerklärung: 60 Minuten Ratenbegrenzung, 7 Tage unbestätigte
 * Anmeldung): Geprüft über den echten `scheduled`-Einstieg des Workers mit echter SQLite-Datenbank statt per Textmuster auf
 * `index.ts`. Alte Zeilen verschwinden, frische bleiben; der Digest-Trigger fasst sie nicht an.
 *
 * Aufruf: `npx tsx tools/worker-loeschlauf-scheduled.test.ts`
 */
import worker from '../worker/src/index.ts'
import type { Env } from '../worker/src/env.ts'
import { fetchAttrappe, neueDatenbank, testEnv } from './worker-unteraufrufe-attrappe.ts'
import { festeUhr } from './feste-uhr.ts'

let fehler = 0
const stumm = console.log
const pruefe = (bedingung: boolean, text: string) => {
  stumm(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.log = () => {}
console.error = () => {}
festeUhr('2026-10-20T10:30:00Z')
fetchAttrappe('2026-10-20')

const JETZT = new Date('2026-10-09T12:00:00.000Z')
const DIGEST_CRON = '0 5,6 * * *'

function befuellen() {
  const db = neueDatenbank()
  const rate = db.prepare('INSERT INTO rate_limit (key, count, window_start) VALUES (?1, 1, ?2)')
  rate.run('alt', '2026-10-09T10:59:00.000Z')
  rate.run('frisch', '2026-10-09T11:01:00.000Z')
  const anm = db.prepare(
    `INSERT INTO subscribers (id, email, frequency, platforms, favorites, status, confirm_token, unsub_token, pref_token, created_at)
     VALUES (?1, ?2, 'daily', '', '', ?3, 'c' || ?1, 'u' || ?1, 'p' || ?1, ?4)`,
  )
  anm.run('1', 'alt@example.invalid', 'pending', '2026-10-02T11:59:00.000Z')
  anm.run('2', 'neu@example.invalid', 'pending', '2026-10-02T12:01:00.000Z')
  anm.run('3', 'aktiv@example.invalid', 'active', '2026-09-01T00:00:00.000Z')
  return db
}

async function takt(cron: string) {
  const db = befuellen()
  const offen: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => offen.push(p), passThroughOnException: () => {} } as unknown as ExecutionContext
  await worker.scheduled({ cron, scheduledTime: JETZT.getTime(), noRetry: () => {} }, testEnv(db, 25) as Env, ctx)
  await Promise.allSettled(offen)
  const rate = (db.prepare('SELECT key FROM rate_limit ORDER BY key').all() as { key: string }[]).map((r) => r.key)
  const anm = (db.prepare('SELECT id FROM subscribers ORDER BY id').all() as { id: string }[]).map((r) => r.id)
  return { rate, anm }
}

const stuendlich = await takt('0 * * * *')
pruefe(JSON.stringify(stuendlich.rate) === '["frisch"]', 'stündlich: Ratenbegrenzung älter als 60 Minuten weg, frische bleibt')
pruefe(JSON.stringify(stuendlich.anm) === '["2","3"]', 'stündlich: unbestätigte Anmeldung älter als 7 Tage weg, neue und aktive bleiben')
const digest = await takt(DIGEST_CRON)
pruefe(JSON.stringify(digest.rate) === '["alt","frisch"]', 'Digest-Trigger: Ratenbegrenzung unberührt')
pruefe(JSON.stringify(digest.anm) === '["1","2","3"]', 'Digest-Trigger: Anmeldungen unberührt')

if (fehler) {
  stumm(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
stumm('\nAlle Prüfungen grün.')
