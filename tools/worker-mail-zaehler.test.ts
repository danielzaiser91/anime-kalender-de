/**
 * **Mail-Zähler** (23.10.2026): `schreib_tag.mails` steigt um genau die angenommenen Mails — Stapel,
 * Einzelmail — und nicht bei abgewiesenem Versand oder Anbieter `console`; `/health` zeigt den Stand.
 *
 * Aufruf: `npx tsx tools/worker-mail-zaehler.test.ts`
 */
import type { DatabaseSync } from 'node:sqlite'
import worker, { runDigest } from '../worker/src/index.ts'
import { sendeUndZaehle } from '../worker/src/mail-zaehler.ts'
import { abonnenten, fetchAttrappe, neueDatenbank, testEnv, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const zeige = console.log
const pruefe = (bedingung: boolean, text: string) => {
  zeige(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.log = () => {}

const JETZT = new Date('2026-10-15T05:00:00Z')
const echterFetch = globalThis.fetch
const mails = (db: DatabaseSync) => Number((db.prepare('SELECT COALESCE(SUM(mails), 0) AS n FROM schreib_tag').get() as { n: number }).n)
const mail = { to: 'a@example.invalid', subject: 's', html: '<p>h</p>', text: 't' }

async function digest(n: number, abweisen: boolean, anbieter = 'resend'): Promise<number> {
  const db = neueDatenbank()
  fetchAttrappe('2026-10-15')
  if (abweisen) {
    const attrappe = globalThis.fetch
    globalThis.fetch = (async (u: unknown, i?: unknown) =>
      String(u).includes('/emails/batch') ? new Response('nein', { status: 429 }) : attrappe(u as string, i as RequestInit)) as typeof fetch
  }
  abonnenten(db, n)
  zaehlerZurueck()
  const env = { ...testEnv(db, 7), MAIL_PROVIDER: anbieter }
  await runDigest(env, JETZT)
  return mails(db)
}

pruefe((await digest(7, false)) === 7, 'Digest an 7 Abonnenten: Zähler 7')
pruefe((await digest(3, false)) === 3, 'Digest an 3 Abonnenten: Zähler 3 (anderer Wert als 7)')
pruefe((await digest(120, false)) === 120, 'zwei Stapel (100 + 20): Zähler 120')
pruefe((await digest(7, true)) === 0, 'abgewiesener Stapel: Zähler 0')
pruefe((await digest(7, false, 'console')) === 0, 'Anbieter console: Zähler 0')

const db = neueDatenbank()
const env = testEnv(db, 7)
fetchAttrappe('2026-10-15')
await sendeUndZaehle(env, mail)
await sendeUndZaehle(env, mail)
pruefe(mails(db) === 2, 'zwei Einzelmails: Zähler 2')
globalThis.fetch = (async () => new Response('nein', { status: 500 })) as typeof fetch
await sendeUndZaehle(env, mail).then(
  () => pruefe(false, 'abgewiesene Einzelmail wirft'),
  () => pruefe(mails(db) === 2, 'abgewiesene Einzelmail wirft und bucht nicht'),
)
fetchAttrappe('2026-10-15')
const ohneSpalte = neueDatenbank()
ohneSpalte.exec('ALTER TABLE schreib_tag DROP COLUMN mails')
await sendeUndZaehle(testEnv(ohneSpalte, 7), mail)
pruefe(true, 'fehlende Spalte: Versand läuft trotzdem')

db.exec(`INSERT OR REPLACE INTO schreib_tag (tag, zeilen, gelesen, mails) VALUES (date('now'), 11, 22, 5)`)
const antwort = await worker.fetch(new Request('https://w.example.invalid/health'), env, { waitUntil() {} } as unknown as ExecutionContext)
const koerper = (await antwort.json()) as { heute?: { mails: number; geschrieben: number; gelesen: number } }
pruefe(koerper.heute?.mails === 5 && koerper.heute.geschrieben === 11 && koerper.heute.gelesen === 22, '/health zeigt mails 5, geschrieben 11, gelesen 22')
globalThis.fetch = echterFetch

zeige(fehler ? `${fehler} Prüfung(en) fehlgeschlagen.` : 'Alle Prüfungen grün (Mail-Zähler: 5 Digest-Fälle, 3 Einzelfälle, Health).')
process.exit(fehler ? 1 : 0)
