/**
 * **Newsletter-Kapazität** (B13, 23.10.2026): Wochen-Abos verteilen sich auf 7 Versandtage, der Digest hält die
 * Kappen (70 am Tag, 100 Mails am Tag, 3.000 im Monat), `send_log` entsteht nur bei Erfolg, und die Anmeldung
 * schließt bei 70 belegten Plätzen mit 503 `newsletter_voll`. Läuft über `runDigest` und `worker.fetch` gegen
 * eine echte SQLite-Datenbank mit allen Migrationen.
 *
 * Aufruf: `npx tsx tools/worker-newsletter-kapazitaet.test.ts`
 */
import type { DatabaseSync } from 'node:sqlite'
import worker, { runDigest } from '../worker/src/index.ts'
import {
  DIGEST_TAG_MAX,
  MAIL_MONAT_MAX,
  MAIL_TAG_MAX,
  belegung,
  digestStand,
  wochenAboFaellig,
  wochentagVon,
} from '../worker/src/newsletter-kapazitaet.ts'
import { bucheMails } from '../worker/src/mail-zaehler.ts'
import { verbuchen } from '../worker/src/tagesdeckel.ts'
import { berlinParts } from '../worker/src/werte.ts'
import { fetchAttrappe, neueDatenbank, testEnv, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const zeige = console.log
const pruefe = (bedingung: boolean, text: string) => {
  zeige(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.log = () => {}

const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)
const MONTAG = '2026-06-01'
const tag = (n: number) => new Date(Date.parse(`${MONTAG}T05:00:00Z`) + n * 86_400_000)

function fuegeEin(db: DatabaseSync, id: string, frequency: 'daily' | 'weekly', status = 'active', zuletzt: string | null = null) {
  db.prepare(
    `INSERT INTO subscribers (id, email, frequency, platforms, favorites, status, confirm_token, unsub_token, pref_token, created_at, last_sent_at)
     VALUES (?1, ?2, ?3, '', '', ?4, 'c', 'u' || ?1, 'p' || ?1, '2026-01-01', ?5)`,
  ).run(id, `${id}@example.invalid`, frequency, status, zuletzt)
}

/** Kennung mit dem verlangten Eimer: probiert Zähler durch, bis der Hash passt. */
function idImEimer(eimer: number, nr: number): string {
  let versuch = 0
  for (let gefunden = 0; ; versuch++) {
    const id = `e${eimer}-${versuch}`
    if (wochentagVon(id) === eimer && gefunden++ === nr) return id
  }
}

function eimerBefuellen(db: DatabaseSync, anzahlJeEimer: number[]) {
  anzahlJeEimer.forEach((n, eimer) => {
    for (let i = 0; i < n; i++) fuegeEin(db, idImEimer(eimer, i), 'weekly')
  })
}

function hash() {
  zeige('Verteilung:')
  const erwartet: Record<string, number> = { a: 5, b: 6, id0: 4, 'e0-0': 1, 'e3-17': 4 }
  const ist = Object.fromEntries(Object.keys(erwartet).map((k) => [k, wochentagVon(k)]))
  pruefe(JSON.stringify(ist) === JSON.stringify(erwartet), `feste Kennungen landen in festen Eimern (${JSON.stringify(ist)})`)
  const eimer = new Array(7).fill(0)
  for (let i = 0; i < 7000; i++) eimer[wochentagVon(`kennung-${i}`)]++
  pruefe(Math.min(...eimer) > 850 && Math.max(...eimer) < 1150, `7000 Kennungen verteilen sich gleichmäßig (${eimer.join(',')})`)
}

function faellig() {
  zeige('Fälligkeit eines Wochen-Abos (Eimer-Tag Mittwoch = Index 2):')
  const id = idImEimer(2, 0)
  const sub = (zuletzt: string | null, erstellt = '2026-01-01') => ({ id, last_sent_at: zuletzt, created_at: erstellt })
  const MI = '2026-06-03'
  pruefe(wochenAboFaellig(sub(null), MI), 'nie gesendet, Eimer-Tag erreicht: fällig')
  pruefe(!wochenAboFaellig(sub(null, '2026-06-03'), '2026-06-02'), 'nie gesendet, Eimer-Tag der Woche noch nicht erreicht und neu: nicht fällig')
  pruefe(wochenAboFaellig(sub(null, '2026-06-03'), MI), 'am Eimer-Tag angemeldet, nie gesendet: fällig (Folgetag Nachholung)')
  pruefe(!wochenAboFaellig(sub(null, '2026-06-04'), '2026-06-04'), 'nach dem Eimer-Tag angemeldet: erst nächste Woche')
  pruefe(!wochenAboFaellig(sub('2026-06-03T05:00:00.000Z'), MI), 'heute schon gesendet: nicht fällig')
  pruefe(wochenAboFaellig(sub('2026-05-27T05:00:00.000Z'), MI), 'vor genau 7 Tagen gesendet: fällig')
  pruefe(!wochenAboFaellig(sub('2026-05-28T05:00:00.000Z'), MI), 'vor 6 Tagen gesendet (alter Montagsversand wäre Do): nicht fällig, kein Doppelversand')
  pruefe(!wochenAboFaellig(sub('2026-06-01T05:00:00.000Z'), MI), 'Montag gesendet (alter Tag), Mittwoch: nicht fällig, 7-Tage-Abstand fehlt')
  pruefe(!wochenAboFaellig(sub('2026-06-01T05:00:00.000Z'), '2026-06-08'), 'Montag gesendet (alter Tag), nächster Montag: Eimer-Tag liegt 5 Tage zurück, nicht fällig (kein Dauer-Montag)')
  pruefe(wochenAboFaellig(sub('2026-06-01T05:00:00.000Z'), '2026-06-10'), 'Montag gesendet, übernächster Eimer-Tag (Mi): fällig, einmal verschoben')
  pruefe(!wochenAboFaellig(sub('2026-05-27T05:00:00.000Z'), '2026-06-02'), 'Eimer-Tag noch nicht erreicht: nicht fällig')
  pruefe(wochenAboFaellig(sub('2026-05-27T05:00:00.000Z'), '2026-06-04'), 'Eimer-Tag gestern verpasst: heute weiter fällig (Nachholung)')
  pruefe(wochenAboFaellig(sub('2026-05-27T05:00:00.000Z'), '2026-06-05'), 'Eimer-Tag vor 2 Tagen verpasst: noch fällig')
  pruefe(!wochenAboFaellig(sub('2026-05-27T05:00:00.000Z'), '2026-06-06'), 'Eimer-Tag vor 3 Tagen verpasst: wartet auf den nächsten')
  pruefe(!wochenAboFaellig(sub('2026-06-05T05:00:00.000Z'), '2026-06-12'), 'Verspätet bedient (Fr statt Mi): nach 7 Tagen noch nicht wieder dran, wartet auf den Eimer-Tag')
  pruefe(wochenAboFaellig(sub('2026-06-05T05:00:00.000Z'), '2026-06-17'), 'Verspätet bedient: am nächsten Eimer-Tag wieder dran')
}

async function verteilung(n: number, zuletzt: string | null, titel: string) {
  zeige(titel)
  const db = neueDatenbank()
  for (let i = 0; i < n; i++) fuegeEin(db, `w${i}`, 'weekly', 'active', zuletzt)
  const tage: Record<string, string[]> = {}
  for (let t = 0; t < 14; t++) {
    const jetzt = tag(t)
    const iso = jetzt.toISOString().slice(0, 10)
    fetchAttrappe(iso)
    zaehlerZurueck()
    await runDigest(testEnv(db, berlinParts(jetzt).hour), jetzt)
    const mails = zaehler.stapel.flat()
    tage[iso] = mails.map((m) => String((m.to as string[])[0]))
  }
  const proTag = Object.values(tage).map((l) => l.length)
  pruefe(Math.max(...proTag) <= 70, `kein Tag über 70 Digest-Mails (${proTag.join(',')})`)
  pruefe(Math.max(...proTag.slice(0, 7)) < n, 'in der ersten Woche geht nicht alles an einem Tag raus')
  const tageJeAdresse = new Map<string, number[]>()
  const start = zuletzt ? [-7] : []
  Object.keys(tage).forEach((iso, t) => tage[iso].forEach((a) => tageJeAdresse.set(a, [...(tageJeAdresse.get(a) ?? start), t])))
  const doppelt = [...tageJeAdresse.values()].filter((l) => l.some((x, i) => i > 0 && x - l[i - 1] < 7)).length
  pruefe(doppelt === 0, `kein Abo bekommt zwei Mails in 7 Tagen (${doppelt} Verstöße)`)
  const mindestens = zuletzt ? n : n - 70
  pruefe(tageJeAdresse.size >= mindestens, `nach zwei Wochen haben mindestens ${mindestens} der ${n} Abos eine Mail bekommen (${tageJeAdresse.size})`)
  const log = zahl(db, "SELECT COUNT(*) n FROM send_log WHERE run_key LIKE 'weekly:%'")
  pruefe(log === 14, `je Tag ein weekly-Eintrag im send_log (${log})`)
}

async function kappen() {
  zeige('Kappen:')
  const jetzt = tag(0)
  const iso = MONTAG
  const lauf = async (vorbereiten: (db: DatabaseSync) => void, n = 100) => {
    const db = neueDatenbank()
    for (let i = 0; i < n; i++) fuegeEin(db, `t${i}`, 'daily')
    vorbereiten(db)
    fetchAttrappe(iso)
    zaehlerZurueck()
    const msg = await runDigest(testEnv(db, 7), jetzt)
    return { db, gesendet: zaehler.stapel.flat().length, msg }
  }
  const mailsBuchen = (db: DatabaseSync, tagStr: string, mails: number) =>
    db.prepare('INSERT INTO schreib_tag (tag, zeilen, mails) VALUES (?1, 0, ?2)').run(tagStr, mails)

  pruefe((await lauf(() => {})).gesendet === 70, 'leerer Tag, 100 Abos: 70 Digest-Mails')
  pruefe((await lauf((db) => mailsBuchen(db, iso, 31))).gesendet === 69, '31 Mails gebucht (Bestätigungen): 100 − 31 = 69 Digest-Mails')
  pruefe((await lauf((db) => mailsBuchen(db, iso, 30))).gesendet === 70, '30 Mails gebucht: 70 Digest-Mails, Bestätigungen behalten ihre 30')
  pruefe((await lauf((db) => mailsBuchen(db, iso, 100))).gesendet === 0, '100 Mails gebucht: keine Digest-Mail')
  pruefe((await lauf((db) => mailsBuchen(db, iso, 99))).gesendet === 1, '99 Mails gebucht: genau eine Digest-Mail')
  pruefe((await lauf((db) => mailsBuchen(db, '2026-06-01', 20))).gesendet === 70, '20 gebucht: weiter 70 (Digest-Kappe vor Tageskappe)')
  const monatNah = await lauf((db) => {
    for (let d = 2; d <= 30; d++) mailsBuchen(db, `2026-06-${String(d).padStart(2, '0')}`, d === 30 ? 171 : 100)
  })
  pruefe(monatNah.gesendet === 29, 'Monatsrest 29 (3.000 − 2.971): 29 Digest-Mails')
  const vormonat = await lauf((db) => mailsBuchen(db, '2026-05-31', 5000))
  pruefe(vormonat.gesendet === 70, 'Vormonat zählt nicht in den Monatsrest')
  const vorlauf = await lauf((db) => {
    db.prepare("INSERT INTO send_log (run_key, sent_at, recipients) VALUES ('daily:x', ?1, 70)").run('2026-06-01T04:00:00.000Z')
  })
  pruefe(vorlauf.gesendet === 0, 'Digest heute schon 70 (send_log): keine weitere Digest-Mail')
  pruefe(!zahl(vorlauf.db, "SELECT COUNT(*) n FROM send_log WHERE run_key = 'daily:2026-06-01'"), 'Kappe erreicht: kein send_log für den Lauf, Folgetag sendet nach')
  pruefe(/Platz 0/.test(vorlauf.msg), `Lauf-Log nennt die Lage (${vorlauf.msg})`)
  const gestern = await lauf((db) => {
    db.prepare("INSERT INTO send_log (run_key, sent_at, recipients) VALUES ('daily:y', ?1, 70)").run('2026-05-31T04:00:00.000Z')
  })
  pruefe(gestern.gesendet === 70, 'Digest gestern 70: heute wieder 70')
  const fremd = await lauf((db) => {
    db.prepare("INSERT INTO send_log (run_key, sent_at, recipients) VALUES ('monitor:x', ?1, 70)").run('2026-06-01T04:00:00.000Z')
  })
  pruefe(fremd.gesendet === 70, 'fremder send_log-Eintrag (kein Digest) zählt nicht')
  const wochen = await lauf((db) => {
    db.prepare("INSERT INTO send_log (run_key, sent_at, recipients) VALUES ('weekly:x', ?1, 40)").run('2026-06-01T04:00:00.000Z')
  })
  pruefe(wochen.gesendet === 30, 'Wochen-Digest von heute (40) zählt zur Kappe: 30 Rest')
  const reihenfolge = await lauf((db) => {
    db.exec("UPDATE subscribers SET last_sent_at = '2026-05-31T05:00:00.000Z' WHERE id IN ('t0','t1','t2','t3','t4','t5','t6','t7','t8','t9')")
    db.exec("UPDATE subscribers SET last_sent_at = '2026-05-30T05:00:00.000Z' WHERE id GLOB 't[1-9][0-9]' AND id < 't40'")
  })
  const zeilen = reihenfolge.db.prepare('SELECT last_sent_at FROM subscribers WHERE last_sent_at LIKE ?1').all('2026-06-01%').length
  const alte = reihenfolge.db.prepare("SELECT COUNT(*) n FROM subscribers WHERE last_sent_at LIKE '2026-06-01%' AND id IN ('t0','t1','t2','t3','t4','t5','t6','t7','t8','t9')").get() as { n: number }
  pruefe(zeilen === 70 && Number(alte.n) === 0, 'Kappe schneidet bei den zuletzt Bedienten: wer nie oder am längsten nicht dran war, kommt zuerst')

  const echt = neueDatenbank()
  const echtEnv = testEnv(echt, 7)
  await bucheMails(echtEnv, 2980, tag(0))
  await verbuchen(echtEnv, '2026-06-02', { geschrieben: 1, gelesen: 1 })
  await verbuchen(echtEnv, '2026-06-03', { geschrieben: 1, gelesen: 1 })
  const ueberTage = await digestStand(echtEnv, tag(2))
  pruefe(ueberTage.mailsMonat === 2980 && ueberTage.platz === 20, `Monatssumme überlebt die Buchungen der Folgetage (verbuchen, bucheMails): ${JSON.stringify(ueberTage)}`)
  await verbuchen(echtEnv, '2026-07-01', { geschrieben: 1, gelesen: 1 })
  pruefe(zahl(echt, "SELECT COUNT(*) n FROM schreib_tag WHERE tag < '2026-07-01'") === 0, 'ein neuer Monat räumt die Zeilen des alten')

  const kaputt = await lauf((db) => db.exec('DROP TABLE schreib_tag'))
  pruefe(kaputt.gesendet === 0, 'Zähler nicht lesbar: Digest heute gesperrt statt unbegrenzt')
  pruefe(DIGEST_TAG_MAX === 70 && MAIL_TAG_MAX === 100 && MAIL_MONAT_MAX === 3000, 'Konstanten 70 / 100 / 3000')
}

async function abgewiesen() {
  zeige('Abgewiesener Stapel:')
  const db = neueDatenbank()
  for (let i = 0; i < 10; i++) fuegeEin(db, `a${i}`, 'daily')
  fetchAttrappe(MONTAG)
  zaehlerZurueck()
  zaehler.ablehnen = 1
  await runDigest(testEnv(db, 7), tag(0))
  pruefe(zahl(db, "SELECT COUNT(*) n FROM send_log WHERE run_key LIKE 'daily:%'") === 0, 'Stapel abgewiesen: kein send_log')
  pruefe(zahl(db, 'SELECT COUNT(*) n FROM subscribers WHERE last_sent_at IS NOT NULL') === 0, 'Stapel abgewiesen: kein last_sent_at')
  fetchAttrappe('2026-06-02')
  zaehlerZurueck()
  await runDigest(testEnv(db, 7), tag(1))
  pruefe(zaehler.stapel.flat().length === 10, 'Folgetag sendet an alle 10')
  pruefe(zahl(db, "SELECT COUNT(*) n FROM send_log WHERE run_key = 'daily:2026-06-02'") === 1, 'Folgetag schreibt send_log')
  const leer = neueDatenbank()
  fetchAttrappe(MONTAG)
  await runDigest(testEnv(leer, 7), tag(0))
  pruefe(zahl(leer, 'SELECT COUNT(*) n FROM send_log') === 2, 'niemand fällig: send_log wie bisher (daily und weekly)')
  const stand = await digestStand(testEnv(db, 7), tag(1))
  pruefe(stand.digestHeute === 10 && stand.mailsHeute === 10 && stand.mailsMonat === 10 && stand.platz === 60, `Stand nach 10 Mails: ${JSON.stringify(stand)}`)
}

async function anmelden(db: DatabaseSync, email: string, ip: string) {
  const antwort = await worker.fetch(
    new Request('https://w.example.invalid/subscribe', {
      method: 'POST',
      headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' },
      body: JSON.stringify({ email, frequency: 'weekly' }),
    }),
    testEnv(db, 7),
    { waitUntil() {} } as unknown as ExecutionContext,
  )
  return { status: antwort.status, body: (await antwort.json().catch(() => ({}))) as { code?: string; error?: string } }
}

async function anmeldung() {
  zeige('Anmeldung bei voller Kapazität:')
  const probe = async (fuell: (db: DatabaseSync) => void, email = 'neu@example.invalid') => {
    const db = neueDatenbank()
    fuell(db)
    fetchAttrappe(MONTAG)
    zaehlerZurueck()
    const vorher = zahl(db, 'SELECT COUNT(*) n FROM subscribers')
    const a = await anmelden(db, email, '1.2.3.4')
    return { ...a, zeilen: zahl(db, 'SELECT COUNT(*) n FROM subscribers') - vorher, mails: zaehler.einzelmails + zaehler.stapel.length, db }
  }
  const taeglich = (n: number) => (db: DatabaseSync) => {
    for (let i = 0; i < n; i++) fuegeEin(db, `d${i}`, 'daily')
  }
  const voll = await probe(taeglich(70))
  pruefe(voll.status === 503 && voll.body.code === 'newsletter_voll', '70 belegt: 71. Anmeldung 503 newsletter_voll')
  pruefe(voll.zeilen === 0 && voll.mails === 0, 'abgewiesen: 0 neue Abo-Zeilen, 0 Mails')
  pruefe(zahl(voll.db, "SELECT COUNT(*) n FROM rate_limit WHERE key = 'subscribe-tag' AND count > 0") === 0, 'abgewiesen: die Tageskappe der Bestätigungen bleibt unberührt')
  const frei = await probe(taeglich(69))
  pruefe(frei.status === 200 && frei.zeilen === 1, '69 belegt: Anmeldung geht (Mail an Bestätigung)')
  pruefe((await probe((db) => { taeglich(35)(db); eimerBefuellen(db, [35, 0, 0, 0, 0, 0, 0]) })).status === 503, '35 täglich + 35 im größten Eimer = 70: 503')
  pruefe((await probe((db) => { taeglich(34)(db); eimerBefuellen(db, [35, 0, 0, 0, 0, 0, 0]) })).status === 200, '34 täglich + 35 im größten Eimer = 69: geht')
  pruefe((await probe((db) => eimerBefuellen(db, [10, 10, 10, 10, 10, 10, 10]))).status === 200, '70 Wochen-Abos gleichmäßig verteilt: geht')
  pruefe((await probe((db) => eimerBefuellen(db, [0, 0, 70, 0, 0, 0, 0]))).status === 503, '70 Wochen-Abos im selben Eimer: 503')
  pruefe((await probe((db) => { for (let i = 0; i < 70; i++) fuegeEin(db, `p${i}`, 'daily', 'pending') })).status === 503, '70 unbestätigte Plätze zählen mit: 503')
  const vorhanden = await probe((db) => { taeglich(70)(db); fuegeEin(db, 'alt', 'weekly') }, 'alt@example.invalid')
  pruefe(vorhanden.status === 200, 'vorhandenes aktives Abo ändert Einstellungen bei voller Kapazität: 200')
  const unbestaetigt = await probe((db) => { taeglich(70)(db); fuegeEin(db, 'offen', 'weekly', 'pending') }, 'offen@example.invalid')
  pruefe(unbestaetigt.status === 200, 'unbestätigte Adresse bestätigt erneut bei voller Kapazität: 200')
  const ungueltig = await probe(taeglich(70), 'keine-mail')
  pruefe(ungueltig.status === 400, 'ungültige Adresse bei voller Kapazität: weiter 400 vom Handler')
  pruefe(belegung([{ id: 'x', frequency: 'daily' }]) === 1 && belegung([]) === 0, 'belegung: ein Abo = 1, leer = 0')
  const db = neueDatenbank()
  const health = await worker.fetch(new Request('https://w.example.invalid/health'), testEnv(db, 7), { waitUntil() {} } as unknown as ExecutionContext)
  const stand = ((await health.json()) as { newsletter?: { platz: number; mailsHeute: number } }).newsletter
  pruefe(stand?.platz === 70 && stand.mailsHeute === 0, '/health zeigt den Digest-Stand (Platz, Mails heute)')
}

hash()
faellig()
await verteilung(420, null, 'Wochen-Abos über zwei Wochen (Neustart ohne frühere Mail):')
await verteilung(100, '2026-05-25T05:00:00.000Z', 'Umzug vom alten Montagsversand (100 Abos, alle am 25.05. bedient):')
await kappen()
await abgewiesen()
await anmeldung()

if (fehler) {
  zeige(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
zeige('\nAlle Prüfungen grün.')
