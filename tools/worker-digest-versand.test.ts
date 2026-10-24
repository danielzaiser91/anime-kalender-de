/**
 * **Digest und Cron unter 50 Unteraufrufen** (15.10.2026): Die Free-Stufe erlaubt 50 Unteraufrufe je Worker-Aufruf,
 * D1 zählt mit. Vorher kostete jeder Abonnent drei; ab 15 brach der Versand ab und schrieb kein `send_log`
 * (daniel-zum-abarbeiten/berichte/digest-subrequest-grenze.md). Geprüft: Versand per Resend-Stapel, gebündelte
 * Schreibabfragen, eigener Cron-Trigger für den Digest, Abmeldelink und List-Unsubscribe in jeder Mail.
 *
 * Aufruf: `npx tsx tools/worker-digest-versand.test.ts`
 */
import { readFileSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import worker, { runDigest } from '../worker/src/index.ts'
import type { SubscriberRow } from '../worker/src/digest-inhalt.ts'
import { DIGEST_CRON, versendeDigest } from '../worker/src/digest-versand.ts'
import { berlinParts } from '../worker/src/werte.ts'
import { SITES } from '../worker/src/sites.ts'
import { schreibeStaende, schreibeVerlauf } from '../worker/src/monitor-speicher.ts'
import type { CheckResult } from '../worker/src/monitor.ts'
import { abonnenten, d1, fetchAttrappe, neueDatenbank, testEnv, unteraufrufe, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  zeige(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
/** Die Worker-Logs ([digest], [monitor] …) übertönten sonst die Prüfzeilen. */
const zeige = console.log
console.error = () => {}
console.log = () => {}

const GRENZE = 50
/** Donnerstag 07:00 Berlin (Sommerzeit): Tagesdigest fällig, kein Wochendigest. */
const JETZT = new Date('2026-10-15T05:00:00Z')
const TAG = '2026-10-15'
/** Montag 07:00 Berlin (Sommerzeit): Sendestunde mit fälliger Wochenübersicht der Überwachung, der schärfste Fall für den stündlichen Aufruf. */
const MONTAG_SENDESTUNDE = new Date('2026-10-19T05:00:00Z')

const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)
const gesendet = () => zaehler.stapel.flat()
const versandLog = (db: DatabaseSync) => db.prepare(`SELECT recipients FROM send_log WHERE run_key = 'daily:${TAG}'`).get() as { recipients: number } | undefined

async function digest(db: DatabaseSync, anzahl: number): Promise<string | Error> {
  abonnenten(db, anzahl)
  db.exec('DELETE FROM send_log; DELETE FROM schreib_tag')
  zaehlerZurueck()
  return runDigest(testEnv(db, 7), JETZT).catch((e: Error) => e)
}

/** Jede Mail trägt Abmeldelink, Kopfzeilen nach RFC 8058 und ihren gespeicherten Sync-Schlüssel. */
function pruefeMails(db: DatabaseSync, n: number) {
  const mails = gesendet()
  const zeilen = db.prepare('SELECT email, unsub_token, sync_token, last_sent_at FROM subscribers').all() as Record<string, string>[]
  const passt = zeilen.every((z) => {
    const m = mails.find((x) => (x.to as string[])[0] === z.email)
    const kopf = (m?.headers ?? {}) as Record<string, string>
    return (
      kopf['List-Unsubscribe'] === `<https://w.example.invalid/unsubscribe?token=${z.unsub_token}>` &&
      kopf['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click' &&
      String(m?.html).includes(`/unsubscribe?token=${z.unsub_token}`) &&
      String(m?.html).includes(`/sync?token=${z.sync_token}`)
    )
  })
  pruefe(mails.length === n && passt, `N=${n}: jede Mail mit Abmeldelink, List-Unsubscribe und gespeichertem Sync-Schlüssel`)
  pruefe(zeilen.every((z) => z.last_sent_at === JETZT.toISOString()), `N=${n}: last_sent_at bei allen gesetzt`)
  const ablauf = new Date(JETZT.getTime() + 30 * 86_400_000).toISOString()
  pruefe(zahl(db, `SELECT COUNT(*) n FROM subscribers WHERE sync_expires = '${ablauf}'`) === n, `N=${n}: Sync-Schlüssel 30 Tage gültig`)
  pruefe(versandLog(db)?.recipients === n, `N=${n}: send_log mit ${n} Empfängern`)
}

async function grenzeJeAbonnentenzahl(db: DatabaseSync) {
  zeige('Digest-Aufruf:')
  for (const n of [1, 10, 50]) {
    const msg = await digest(db, n)
    pruefe(!(msg instanceof Error), `N=${n}: Lauf ohne Ausnahme`)
    pruefe(unteraufrufe() < GRENZE, `N=${n}: ${unteraufrufe()} Unteraufrufe < ${GRENZE}`)
    pruefe(zaehler.einzelmails === 0, `N=${n}: keine Einzelmail, alles im Stapel`)
    pruefeMails(db, n)
  }
  await digest(db, 150)
  pruefe(zaehler.stapel.map((s) => s.length).join() === '70', 'N=150: ein Stapel mit 70 (Digest-Kappe, nicht 150)')
  pruefe(versandLog(db)?.recipients === 70, 'N=150: send_log mit 70 Empfängern')

  abonnenten(db, 3)
  db.exec('DELETE FROM send_log; DELETE FROM schreib_tag')
  zaehlerZurueck()
  await runDigest({ ...testEnv(db, 7), MAIL_PROVIDER: 'console' }, JETZT)
  const gesetzt = zahl(db, 'SELECT COUNT(*) n FROM subscribers WHERE last_sent_at IS NOT NULL')
  pruefe(zaehler.stapel.length === 0 && gesetzt === 3 && versandLog(db)?.recipients === 3, 'Anbieter ohne Stapel (console): einzeln verschickt, alle drei gezählt')
}

async function fehlerfaelle(db: DatabaseSync) {
  zeige('Fehlerfälle:')
  zaehlerZurueck()
  abonnenten(db, 10)
  db.exec('DELETE FROM send_log; DELETE FROM schreib_tag')
  zaehler.ablehnen = 1
  const msg = await runDigest(testEnv(db, 7), JETZT).catch((e: Error) => e)
  pruefe(!(msg instanceof Error), 'Resend lehnt ab: Lauf wirft nicht')
  pruefe(versandLog(db) === undefined, 'Resend lehnt ab: kein send_log, der Folgetag sendet nach')
  pruefe(zahl(db, 'SELECT COUNT(*) n FROM subscribers WHERE last_sent_at IS NOT NULL') === 0, 'Resend lehnt ab: last_sent_at bleibt leer')
  pruefe(!zaehler.sql.some((s) => s.includes('SET last_sent_at')), 'Resend lehnt ab: keine leere last_sent_at-Abfrage (spart einen Unteraufruf)')

  await digest(db, 0)
  pruefe(!zaehler.sql.some((s) => s.startsWith('UPDATE')), 'keine Abonnenten: keine Schreibabfrage (Montag ohne Wochen-Abonnenten)')

  abonnenten(db, 150)
  zaehlerZurueck()
  zaehler.ablehnen = 1
  const posten = (db.prepare('SELECT * FROM subscribers').all() as unknown as SubscriberRow[]).map((sub) => ({
    sub,
    mail: { subject: 's', html: 'h', text: 't' },
    unsubUrl: 'u',
    syncToken: 't' + sub.id,
  }))
  const angenommen = await versendeDigest(testEnv(db, 7), posten, JETZT)
  pruefe(zaehler.stapel.map((s) => s.length).join() === '100,50', 'Versand 150: zwei Stapel zu 100 und 50 (Resend-Grenze 100)')
  pruefe(angenommen === 50 && zahl(db, 'SELECT COUNT(*) n FROM subscribers WHERE last_sent_at IS NOT NULL') === 50, 'erster Stapel abgelehnt: nur die 50 des zweiten gelten als versandt')

  abonnenten(db, 10)
  db.exec('DELETE FROM send_log; DELETE FROM schreib_tag')
  zaehlerZurueck()
  zaehler.stoerung = /SET sync_token/
  await runDigest(testEnv(db, 7), JETZT)
  pruefe(zaehler.stapel.length === 0, 'Sync-Schlüssel nicht gespeichert: keine Mail mit totem Abgleich-Link')
  pruefe(versandLog(db) === undefined, 'Sync-Schlüssel nicht gespeichert: kein send_log')

  db.exec('DELETE FROM send_log; DELETE FROM schreib_tag')
  zaehlerZurueck()
  zaehler.stoerung = /SET last_sent_at/
  const ohneMarke = await runDigest(testEnv(db, 7), JETZT).catch((e: Error) => e)
  pruefe(!(ohneMarke instanceof Error) && versandLog(db)?.recipients === 10, 'last_sent_at nicht gespeichert: Lauf wirft nicht, send_log zählt die 10 Mails')
}

const ergebnis = (url: string, ok: boolean, ms: number): CheckResult => ({ site: { url, name: url } as CheckResult['site'], ok, status: ok ? 200 : 503, ms, reason: ok ? undefined : 'weg' })

async function monitorSpeicher(db: DatabaseSync) {
  zeige('Monitor-Speicher:')
  const vorher = '2026-10-15T04:00:00.000Z'
  const jetzt = '2026-10-15T05:00:00.000Z'
  await schreibeStaende(d1(db), [ergebnis('a', true, 10), ergebnis('b', true, 20)], [0, 0], new Map(), vorher)
  zaehlerZurueck()
  await schreibeStaende(d1(db), [ergebnis('a', true, 11), ergebnis('b', false, 0), ergebnis('c', false, 0)], [0, 2, 1], new Map([['b', vorher]]), jetzt)
  pruefe(zaehler.d1 === 1, `schreibeStaende: eine Abfrage für drei Seiten (${zaehler.d1})`)
  const stand = Object.fromEntries((db.prepare('SELECT * FROM site_status').all() as Record<string, unknown>[]).map((z) => [z.url, z]))
  pruefe(stand.a?.ms === 11 && stand.a?.last_ok_at === jetzt && stand.a?.ok === 1, 'schreibeStaende: grüne Seite aktualisiert, last_ok_at = jetzt')
  pruefe(stand.b?.ok === 0 && stand.b?.last_ok_at === vorher && stand.b?.fail_streak === 2 && stand.b?.reason === 'weg', 'schreibeStaende: rote Seite behält letzte grüne Zeit, Serie 2')
  pruefe(stand.c?.last_ok_at === null && stand.c?.checked_at === jetzt, 'schreibeStaende: neue rote Seite eingefügt')

  zaehlerZurueck()
  await schreibeVerlauf(d1(db), [ergebnis('a', true, 11), ergebnis('b', false, 0)], jetzt)
  pruefe(zaehler.d1 === 1, `schreibeVerlauf: eine Abfrage außerhalb der Aufräumstunde (${zaehler.d1})`)
  const verlauf = db.prepare('SELECT url, ok, ms FROM site_history WHERE checked_at = ?1 ORDER BY url').all(jetzt) as Record<string, unknown>[]
  pruefe(JSON.stringify(verlauf) === JSON.stringify([{ url: 'a', ok: 1, ms: 11 }, { url: 'b', ok: 0, ms: 0 }]), 'schreibeVerlauf: Zeile je Seite mit ok und ms')
  zaehlerZurueck()
  await schreibeVerlauf(d1(db), [ergebnis('a', true, 11)], '2026-10-15T03:00:00.000Z')
  pruefe(zaehler.d1 === 2, 'schreibeVerlauf: um 03 UTC Messung und Aufräumen')
}

/** Führt einen Cron-Aufruf aus und wartet auf alles, was er an `waitUntil` gibt. */
async function cron(db: DatabaseSync, ausdruck: string, zeit: Date, sendeStunde = berlinParts(zeit).hour) {
  const offen: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => offen.push(p), passThroughOnException: () => {} } as unknown as ExecutionContext
  zaehlerZurueck()
  await worker.scheduled({ cron: ausdruck, scheduledTime: zeit.getTime(), noRetry: () => {} }, testEnv(db, sendeStunde), ctx)
  await Promise.allSettled(offen)
}

/** Wecker-Spitze (3 statt 2 Abläufe je Stunde, je 2 Aufrufe) und ein, zwei Push-Abos brauchen Luft unter der Grenze. */
const PUFFER_STUENDLICH = 5

/** Montags zur Sendestunde geht die Wochenübersicht der Überwachung an MONITOR_EMAIL, aber kein Digest an Abonnenten. */
async function montagsStatusmail() {
  zeige('Montag zur Sendestunde:')
  fetchAttrappe(berlinParts(MONTAG_SENDESTUNDE).iso)
  const db = neueDatenbank()
  abonnenten(db, 50)
  await cron(db, '0 * * * *', MONTAG_SENDESTUNDE)
  pruefe(zaehler.stapel.length === 0 && zaehler.einzelmails === 1, 'stündlicher Aufruf am Montag zur Sendestunde: nur die Wochenübersicht, kein Digest')
  pruefe(zahl(db, "SELECT COUNT(*) n FROM send_log WHERE run_key LIKE 'daily:%'") === 0, 'stündlicher Aufruf am Montag: kein Digest-Eintrag im send_log')

  const ausserhalb = neueDatenbank()
  abonnenten(ausserhalb, 50)
  const sendeStunde = berlinParts(MONTAG_SENDESTUNDE).hour
  await cron(ausserhalb, '0 * * * *', MONTAG_SENDESTUNDE, sendeStunde + 3)
  pruefe(zaehler.stapel.length === 0 && zaehler.einzelmails === 0, 'stündlicher Aufruf am Montag außerhalb der Sendestunde: keine Mail')
}

async function triggerGetrennt() {
  zeige('Cron-Trigger:')
  fetchAttrappe(TAG)
  const db = neueDatenbank()
  abonnenten(db, 50)
  await cron(db, '0 * * * *', JETZT)
  pruefe(zaehler.stapel.length === 0 && zaehler.einzelmails === 0, 'stündlicher Aufruf zur Sendestunde verschickt keinen Digest')
  pruefe(zahl(db, 'SELECT COUNT(*) n FROM site_status') === SITES.length, `stündlicher Aufruf: Monitor schreibt alle ${SITES.length} Seiten`)
  pruefe(unteraufrufe() + PUFFER_STUENDLICH < GRENZE, `stündlicher Aufruf: ${unteraufrufe()} + ${PUFFER_STUENDLICH} Puffer < ${GRENZE}`)

  const leer = neueDatenbank()
  abonnenten(leer, 50)
  await cron(leer, DIGEST_CRON, JETZT)
  pruefe(gesendet().length === 50, 'Digest-Trigger verschickt den Digest an alle 50')
  pruefe(zahl(leer, 'SELECT COUNT(*) n FROM site_status') === 0 && zaehler.objekt === 0, 'Digest-Trigger lässt Monitor und Schnellmesser aus')
  pruefe(unteraufrufe() < GRENZE, `Digest-Trigger: ${unteraufrufe()} Unteraufrufe < ${GRENZE}`)

  const falscheStunde = neueDatenbank()
  abonnenten(falscheStunde, 50)
  await cron(falscheStunde, DIGEST_CRON, JETZT, berlinParts(JETZT).hour + 1)
  pruefe(gesendet().length === 0, 'Digest-Trigger außerhalb der Sendestunde verschickt nichts')
}

/** wrangler.toml muss beide Ausdrücke wörtlich tragen, und die UTC-Stunden des Digests decken die Sendestunde in Sommer- und Winterzeit. */
function wranglerTrigger() {
  zeige('wrangler.toml:')
  const toml = readFileSync('worker/wrangler.toml', 'utf8')
  const crons = JSON.parse(/^crons = (\[.*\])$/m.exec(toml)?.[1] ?? '[]') as string[]
  pruefe(crons.includes('0 * * * *') && crons.includes(DIGEST_CRON), `crons enthält "0 * * * *" und "${DIGEST_CRON}"`)
  const stunde = Number(/^SEND_HOUR_BERLIN = "(\d+)"/m.exec(toml)?.[1])
  const utcStunden = DIGEST_CRON.split(' ')[1].split(',').map(Number)
  for (const tag of ['2026-01-15', '2026-07-15']) {
    const treffer = utcStunden.some((h) => berlinParts(new Date(`${tag}T${String(h).padStart(2, '0')}:00:00Z`)).hour === stunde)
    pruefe(treffer, `${tag}: eine Digest-Stunde fällt auf ${stunde}:00 Berlin`)
  }
}

const db = neueDatenbank()
fetchAttrappe(TAG)
await grenzeJeAbonnentenzahl(db)
await fehlerfaelle(db)
await monitorSpeicher(neueDatenbank())
await triggerGetrennt()
await montagsStatusmail()
wranglerTrigger()

if (fehler) {
  zeige(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
zeige('\nAlle Prüfungen grün.')
