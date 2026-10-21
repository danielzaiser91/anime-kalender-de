/**
 * **Tagesdeckel und Hash-Überspringen der Meldungs-Route** (11.10.2026).
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers, die Antworten
 * verhalten sich wie die von D1: `meta.rows_written` ist hier die Zahl geänderter Tabellenzeilen
 * (ohne Indexzeilen — die genaue Messung mit Indexen steht im PR, lokal mit `getPlatformProxy`).
 * Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-tagesdeckel.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { handleLauf } from '../worker/src/lauf.ts'
import { schreibeVerlauf } from '../worker/src/monitor-speicher.ts'
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { DECKEL_ZEILEN, utcTag } from '../worker/src/tagesdeckel.ts'
import { sekundenBisMitternachtUtc } from '../worker/src/d1-limit.ts'
import { PRUEFUNG_ID_AB } from '../worker/src/rohfolgen-seiten.ts'
import { festeUhr } from './feste-uhr.ts'

/** Feste Uhr für Test und Worker: kein Lauf hängt am UTC-Tageswechsel (K6). */
const FEST = new Date('2026-10-12T12:00:00Z')
festeUhr(FEST.toISOString())

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status/

function neueDatenbank() {
  const db = new DatabaseSync(':memory:')
  const ordner = 'worker/migrations'
  for (const f of readdirSync(ordner).sort()) {
    const sql = readFileSync(`${ordner}/${f}`, 'utf8')
    if (!NUR.test(sql) || f.startsWith('023')) continue
    db.exec(sql)
  }
  return db
}

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }

/* Jede ausgeführte Anweisung mit ihren Werten, damit der Test ihren Plan (EXPLAIN QUERY PLAN) prüfen kann. */
const abfragen: { sql: string; werte: unknown[] }[] = []

function d1(db: DatabaseSync, zaehler: { geschrieben: number }) {
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    run: async () => {
      abfragen.push({ sql, werte })
      const r = db.prepare(sql).run(...(werte as never[]))
      zaehler.geschrieben += Number(r.changes)
      return { meta: { changes: Number(r.changes), rows_written: Number(r.changes) } }
    },
    all: async () => {
      abfragen.push({ sql, werte })
      return { results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0 } }
    },
    first: async () => {
      abfragen.push({ sql, werte })
      return db.prepare(sql).get(...(werte as never[])) ?? null
    },
  })
  return {
    prepare: (sql: string) => anweisung(sql),
    batch: async (liste: Anweisung[]) => {
      const antworten = []
      for (const a of liste) antworten.push(await a.run())
      return antworten
    },
  }
}

function umgebung(db: DatabaseSync, zaehler = { geschrieben: 0 }) {
  return { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db, zaehler) } as never
}

/* Der Listenbau (data/pruefstand.json), den der Worker per fetch liest; `stand` setzt jeder Fall selbst. */
const stand = { erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] as unknown[] }
globalThis.fetch = (async () => new Response(JSON.stringify(stand))) as typeof fetch

const post = (body: unknown) =>
  new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify(body),
  })

const folge = (nr: number, ton = 'ja') => ({
  plattform: 'disneyplus',
  url: 'https://www.disneyplus.com/de-de/browse/entity-x',
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Testtitel',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `pb-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton }],
})

const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)

console.log('Tagesdeckel')
{
  const jetzt = new Date('2026-10-11T23:30:00Z')
  pruefe(utcTag(jetzt) === '2026-10-11', 'der Tag zählt in UTC (Kontingent-Reset 00:00 UTC)')
  pruefe(sekundenBisMitternachtUtc(jetzt) === 30 * 60, 'Retry-After: 30 Minuten vor Mitternacht UTC')
}
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const r = await handlePruefung(post(folge(1)), env)
  pruefe(r.status === 200, 'unter dem Deckel: Meldung wird gespeichert')
  const heute = (db.prepare('SELECT zeilen FROM schreib_tag').get() as { zeilen: number } | undefined)?.zeilen
  pruefe(heute !== undefined && heute > 0, `die geschriebenen Zeilen werden gezählt (${heute})`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'Disney+: eine Zeile in pruefung (mit der Rohfolge), keine in prime_folge')
}
{
  const db = neueDatenbank()
  db.prepare('INSERT INTO schreib_tag (tag, zeilen) VALUES (?, ?)').run(utcTag(FEST), DECKEL_ZEILEN)
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const r = await handlePruefung(post(folge(1)), env)
  const kopf = Number(r.headers.get('Retry-After'))
  const inhalt = (await r.json()) as { tageslimit?: boolean }
  pruefe(r.status === 429, 'am Deckel: 429')
  pruefe(kopf > 0 && kopf <= 86400, `Retry-After bis Mitternacht UTC (${kopf} s)`)
  pruefe(inhalt.tageslimit === true, 'die Antwort sagt tageslimit: true (die Erweiterung erkennt daran die Pause)')
  pruefe(z.geschrieben === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 0, 'am Deckel wird nichts geschrieben')
  const stapel = await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)
  pruefe(stapel.status === 429, 'auch ein Stapel bekommt 429')
  const abhaken = await handlePruefung(post({ uebernommen: [1] }), env)
  pruefe(abhaken.status === 200, 'Aufträge der Pipeline (abhaken) bleiben am Deckel frei')
}
{
  const db = neueDatenbank()
  db.exec('DROP TABLE schreib_tag')
  const r = await handlePruefung(post(folge(1)), umgebung(db))
  pruefe(r.status === 200, 'ein Fehler beim Zählen sperrt nicht (Zähltabelle fehlt)')
}
{
  const quellen = readdirSync('worker/src')
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => readFileSync(`worker/src/${f}`, 'utf8').includes("from './tagesdeckel.ts'"))
  pruefe(quellen.join() === 'lesedeckel.ts,pruefung-speichern.ts', `nur Meldungs-Route und Lese-Deckel nutzen den Deckel (${quellen.join(', ')}) — Anmeldung, Push, Cron bleiben frei (istFrei)`)
}

console.log('Unveränderte Meldung')
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  await handlePruefung(post(folge(1)), env)
  const erst = z.geschrieben
  const r = await handlePruefung(post(folge(1)), env)
  const inhalt = (await r.json()) as { unveraendert?: boolean }
  pruefe(erst > 0 && z.geschrieben === erst, `Wiederholung schreibt keine Zeile mehr (${erst} Zeilen beim Erstmal)`)
  pruefe(inhalt.unveraendert === true, 'die Antwort sagt unveraendert, der Befund bleibt ok')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'keine Dublette')
  await handlePruefung(post(folge(1, 'nein')), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE ton_de = 'nein'") === 1, 'geänderte Meldung ersetzt die alte')
  const stapel = await handlePruefung(post({ stapel: [folge(1, 'nein'), folge(2)] }), env)
  const ergebnisse = ((await stapel.json()) as { ergebnisse: { ok: boolean }[] }).ergebnisse
  pruefe(ergebnisse.every((e) => e.ok) && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 2, 'Stapel: Unverändertes übersprungen, Neues gespeichert')
  db.exec("UPDATE pruefung SET uebernommen = 1")
  await handlePruefung(post(folge(2, 'nein')), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE uebernommen = 0') === 1, 'nach dem Abhaken und geändertem Inhalt entsteht eine neue offene Zeile')
}

console.log('Unveränderte Meldung und Listenbau (Bleach-Fall, pruefung-stand.ts)')
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const ZIEL = 'https://www.disneyplus.com/de-de/browse/entity-x'
  await handlePruefung(post(folge(1)), env)
  /* Die Meldung ist älter als der Listenbau; das Ziel ist eine Wiedervorlage und verlangt eine neuere. */
  db.exec("UPDATE pruefung SET gemeldet_am = '2020-01-01T00:00:00Z'")
  stand.anbieter = [{ name: 'Disney+', plattform: 'disneyplus', offen: 1, gesamt: 1, gemeldet: 0, ziele: [{ url: ZIEL, titel: 'Testtitel', seit: '2019-12-01' }] }]
  const rechne = async () => {
    const antwort = await berechnePruefstand({ env, antwort: (body) => Response.json(body) })
    return ((await antwort.json()) as { anbieter: { ziele: { url: string }[] }[] }).anbieter[0]!.ziele.length
  }
  pruefe((await rechne()) === 1, 'vorher: das Ziel ist offen (die alte Meldung zählt nicht)')
  const vorher = z.geschrieben
  const r = await handlePruefung(post(folge(1)), env)
  pruefe(((await r.json()) as { unveraendert?: boolean }).unveraendert === true, 'dieselbe Meldung wird als unverändert erkannt')
  pruefe(z.geschrieben - vorher === 2, `... und erneuert nur gemeldet_am (Zeile + Tageszähler, gemessen ${z.geschrieben - vorher})`)
  pruefe((await rechne()) === 0, 'danach zählt das Ziel als erledigt (kein ewiges Neumelden)')
  const nachErneuerung = z.geschrieben
  await handlePruefung(post(folge(1)), env)
  pruefe(z.geschrieben === nachErneuerung, 'die zweite gleiche Meldung schreibt 0 Zeilen')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'weiter keine Dublette')
}

console.log('Übernommene Rohfolgen werden nicht neu geschrieben (12.10.2026)')
{
  const SEITE = 'https://www.amazon.de/dp/B0TESTSEITE'
  const prime = (sprachen: string[][], notiz = 'Durchgang') => ({
    plattform: 'primevideo',
    url: SEITE,
    seiten_kennung: 'B0TESTSEITE',
    vorhanden: 'ja',
    ton_de: 'ja',
    art: 'gemessen',
    titel: 'Testserie',
    notiz,
    rohfolgen: sprachen.map((s, i) => ({ asin: `B0F${i}`, gti: `gti-${i}`, nummer: i + 1, titel: `Folge ${i + 1}`, sprachen: s, vorhanden: 'ja', ton_de: 'ja' })),
  })
  const DE = ['de', 'ja']
  const db = neueDatenbank()
  const env = umgebung(db)
  const n = (bedingung = '1') => zahl(db, `SELECT COUNT(*) AS n FROM prime_folge WHERE ${bedingung}`)
  const abhaken = () => db.exec('UPDATE prime_folge SET uebernommen = 1; UPDATE pruefung SET uebernommen = 1, roh_uebernommen = 1 WHERE rohfolge IS NOT NULL; UPDATE pruefung SET uebernommen = 1')

  await handlePruefung(post(prime([DE, DE, DE])), env)
  pruefe(n() === 3 && n('uebernommen = 0') === 3, 'Ausgang: drei offene Rohfolgen')
  abhaken()
  /* Andere Notiz: der Hash der Meldung greift nicht, die Rohfolgen bleiben dieselben. */
  await handlePruefung(post(prime([DE, DE, DE], 'anderer Durchgang')), env)
  pruefe(n() === 3 && n('uebernommen = 0') === 0, 'übernommen + gleicher Hash: keine neue Zeile (0 Schreibzeilen in prime_folge)')

  await handlePruefung(post(prime([DE, ['ja'], DE], 'zweiter Durchgang')), env)
  pruefe(n() === 4 && n('uebernommen = 0') === 1 && n("uebernommen = 0 AND nummer = 2") === 1, 'übernommen + anderer Hash: genau die geänderte Folge kommt als neue offene Zeile')

  abhaken()
  await handlePruefung(post(prime([DE, DE, DE], 'dritter Durchgang')), env)
  pruefe(n('uebernommen = 0') === 1 && n('uebernommen = 0 AND nummer = 2') === 1, 'Rückkehr zum alten Stand (A, B, A): A kommt wieder als jüngste Zeile an')

  db.exec('UPDATE prime_folge SET uebernommen = 1, hash = NULL')
  await handlePruefung(post(prime([DE, DE, DE], 'vierter Durchgang')), env)
  pruefe(n('uebernommen = 0') === 3, 'Altbestand ohne Hash: einmal neu geschrieben')
  abhaken()
  await handlePruefung(post(prime([DE, DE, DE], 'fünfter Durchgang')), env)
  pruefe(n('uebernommen = 0') === 0, '... danach 0 neue Zeilen')

  const netflix = (ton: string, notiz: string) => ({ ...folge(1, ton), plattform: 'netflix', url: 'https://www.netflix.com/title/80000001', notiz })
  await handlePruefung(post(netflix('ja', 'a')), env)
  abhaken()
  const netflixZeilen = (bedingung = '1') => zahl(db, `SELECT COUNT(*) AS n FROM pruefung WHERE plattform = 'netflix' AND ${bedingung}`)
  const vorher = netflixZeilen()
  await handlePruefung(post(netflix('ja', 'a')), env)
  pruefe(netflixZeilen() === vorher, 'Netflix/Disney+ (Rohfolge in der Meldungszeile): übernommen + gleicher Hash schreibt nichts')
  /* Nur die Notiz wechselt: die Meldung ist neu, die Rohfolge nicht — der Zuordner holt sie nicht noch einmal (vorher hielt das der Hash in prime_folge). */
  await handlePruefung(post(netflix('ja', 'b')), env)
  pruefe(netflixZeilen('rohfolge IS NOT NULL') === 1 && netflixZeilen('roh_uebernommen = 0') === 0, 'Netflix/Disney+ übernommen + andere Notiz, gleiche Rohfolge: keine zweite Rohfolge, nichts offen für den Zuordner')
  abhaken()
  await handlePruefung(post(netflix('nein', 'c')), env)
  pruefe(netflixZeilen() === vorher + 2 && netflixZeilen('roh_uebernommen = 0') === 1, '... geänderter Ton kommt als neue Zeile mit offener Rohfolge')
  abhaken()
  await handlePruefung(post(netflix('ja', 'a')), env)
  pruefe(netflixZeilen('roh_uebernommen = 0') === 1, 'zurück zum alten Stand (A, B, A): A kommt als offene Rohfolge wieder an')
  pruefe(n("plattform = 'netflix'") === 0, '... und prime_folge bleibt für Netflix leer')

}

/* Die Ladeabfrage einer Meldung (`ladeOffeneHashes`) und ihre Indexsuche über den Schlüssel der Folge. */
const LADEN = /CROSS JOIN pruefung p/
const FOLGEN_SUCHE = 'SEARCH p USING INDEX pruefung_folge (url=? AND folge_nr=? AND staffel=? AND seiten_kennung=?)'
const planVon = (db: DatabaseSync, a: { sql: string; werte: unknown[] }) =>
  (db.prepare(`EXPLAIN QUERY PLAN ${a.sql}`).all(...(a.werte as never[])) as { detail: string }[]).map((z) => z.detail).join(' ; ')

console.log('Wiederholte Meldung nach dem Abhaken schreibt keine neue pruefung-Zeile (12.10.2026)')
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const anzahl = (bedingung = '1') => zahl(db, `SELECT COUNT(*) AS n FROM pruefung WHERE ${bedingung}`)
  const abhaken = () => db.exec('UPDATE pruefung SET uebernommen = 1')
  const gestern = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 19) + 'Z'
  const gesendet = async (body: unknown) => {
    const vorher = z.geschrieben
    await handlePruefung(post(body), env)
    return z.geschrieben - vorher
  }
  await handlePruefung(post(folge(1)), env)
  abhaken()
  pruefe((await gesendet(folge(1))) === 0, 'übernommen + gleicher Inhalt, am selben Tag: 0 geschriebene Zeilen')
  pruefe(anzahl() === 1 && anzahl('uebernommen = 1') === 1, '... keine neue Zeile, die Zeile bleibt übernommen')

  db.exec(`UPDATE pruefung SET gemeldet_am = '${gestern()}'`)
  pruefe((await gesendet(folge(1))) === 2, 'Zeile von gestern: nur ein UPDATE (Zeile + Tageszähler)')
  pruefe(anzahl() === 1 && anzahl('uebernommen = 0') === 1, '... dieselbe Zeile, wieder offen, damit der Bau das neue checkedAt sieht')
  const offen = await handlePruefung(new Request('https://worker.test/pruefung?token=t'), env)
  const geliefert = ((await offen.json()) as { pruefungen: { gemeldet_am: string }[] }).pruefungen
  pruefe(geliefert.length === 1 && geliefert[0]!.gemeldet_am > gestern(), 'der Bau holt sie mit dem heutigen gemeldet_am ab')
  pruefe((await gesendet(folge(1))) === 0, 'offen + gleicher Inhalt, am selben Tag: weiter 0 Zeilen')

  abhaken()
  stand.erzeugtAm = new Date(Date.now() + 3_600_000).toISOString()
  pruefe((await gesendet(folge(1))) === 2, 'Zeile älter als der Listenbau: gemeldet_am wird erneuert (Wiedervorlage)')
  pruefe(anzahl('uebernommen = 1') === 1, '... ohne die Zeile wieder zu öffnen (derselbe Berlin-Tag)')
  stand.erzeugtAm = '2020-01-02T00:00:00.000Z'

  pruefe((await gesendet(folge(1, 'nein'))) === 2 && anzahl() === 2 && anzahl('uebernommen = 0') === 1, 'anderer Inhalt: neue offene Zeile')
  abhaken()
  await handlePruefung(post(folge(1)), env)
  pruefe(anzahl() === 3 && anzahl('uebernommen = 0') === 1, 'zurück zum alten Stand (A, B, A): A kommt als jüngste Zeile wieder')

  abhaken()
  db.exec('UPDATE pruefung SET hash = NULL')
  pruefe((await gesendet(folge(1))) > 0 && anzahl() === 4 && anzahl('uebernommen = 0') === 1, 'Altbestand ohne Hash: einmal neu geschrieben')
  abhaken()
  pruefe((await gesendet(folge(1))) === 0, '... danach 0 Zeilen')

  abfragen.length = 0
  await handlePruefung(post(folge(1)), env)
  const laden = abfragen.find((a) => LADEN.test(a.sql))
  const plan = laden ? planVon(db, laden) : ''
  pruefe(plan.includes(FOLGEN_SUCHE) && !/SCAN p\b/.test(plan), `die Ladeabfrage mit übernommenen Zeilen bleibt eine Indexsuche (${plan})`)
  db.exec(`UPDATE pruefung SET gemeldet_am = '${gestern()}'`)
  abfragen.length = 0
  await handlePruefung(post(folge(1)), env)
  const aktualisieren = abfragen.find((a) => /^UPDATE pruefung SET gemeldet_am/.test(a.sql))
  pruefe(!!aktualisieren && planVon(db, aktualisieren).includes('INTEGER PRIMARY KEY'), 'das UPDATE geht über den Primärschlüssel')
}

console.log('Planer wählt pruefung_folge ohne Hinweis, auch bei Bestand und Statistik (12.10.2026)')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 })
  abfragen.length = 0
  await handlePruefung(post(folge(1)), env)
  const laden = abfragen.find((a) => LADEN.test(a.sql))!
  pruefe(!/INDEXED BY/i.test(laden.sql), 'die Ladeabfrage trägt keinen Index-Hinweis (vor Migration 053 läuft sie langsamer, scheitert aber nicht)')
  // Bestand wie am 12.10.2026: 17.800 Zeilen, 89 Adressen zu je 200 Folgen.
  db.exec('BEGIN')
  const einfuegen = db.prepare(
    `INSERT INTO pruefung (plattform, url, befund, gemeldet_am, uebernommen, folge_nr, staffel) VALUES ('disneyplus', ?1, 'dub', '2026-10-12T10:00:00Z', ?2, ?3, 1)`,
  )
  for (let a = 0; a < 89; a++) for (let n = 1; n <= 200; n++) einfuegen.run(`https://www.disneyplus.com/de-de/browse/entity-${a}`, n % 3 ? 0 : 1, n)
  db.exec('COMMIT')
  const wahl = (stand: string) => {
    const plan = planVon(db, laden)
    pruefe(plan.includes(FOLGEN_SUCHE) && !/SCAN p\b/.test(plan) && !plan.includes('pruefung_url_zeit'), `${stand}: ${plan}`)
  }
  wahl('Bestand ohne Statistik')
  db.exec('ANALYZE')
  wahl('Bestand mit Statistik (ANALYZE)')
}

console.log('Wiederholte Meldung: Tagesgrenze UTC/Berlin (D) und Zeile vor dem Listenbau (W), 12.10.2026')
{
  const Echt = Date
  /* `jetzt` des Workers (`new Date()`) auf einen festen Zeitpunkt setzen; sonst nichts am Date ändern. */
  const zuZeit = async <T>(iso: string, lauf: () => Promise<T>): Promise<T> => {
    const fest = new Echt(iso).getTime()
    class FesteZeit extends Echt {
      constructor(...a: [] | [number | string]) {
        super(a.length ? (a[0] as number) : fest)
      }
      static override now() {
        return fest
      }
    }
    globalThis.Date = FesteZeit as DateConstructor
    try {
      return await lauf()
    } finally {
      globalThis.Date = Echt
    }
  }
  const KEIN_BAU = '2020-01-02T00:00:00.000Z'
  /* Übernommene Zeile mit `zeileAm`, Listenbau `bauAm`, dieselbe Meldung zu `jetzt` (zweimal). */
  const fall = async (zeileAm: string, jetzt: string, bauAm: string) => {
    const db = neueDatenbank()
    const z = { geschrieben: 0 }
    const env = umgebung(db, z)
    await handlePruefung(post(folge(1)), env)
    db.exec(`UPDATE pruefung SET uebernommen = 1, gemeldet_am = '${zeileAm}'`)
    stand.erzeugtAm = bauAm
    const gesendet = () =>
      zuZeit(jetzt, async () => {
        const vorher = z.geschrieben
        await handlePruefung(post(folge(1)), env)
        return z.geschrieben - vorher
      })
    const erste = await gesendet()
    const zeile = db.prepare('SELECT uebernommen, gemeldet_am FROM pruefung').get() as { uebernommen: number; gemeldet_am: string }
    const zweite = await gesendet()
    stand.erzeugtAm = KEIN_BAU
    return { erste, zweite, offen: zeile.uebernommen === 0, am: zeile.gemeldet_am }
  }

  /* Oktober 2026: MESZ = UTC+2, 22:30 UTC ist 00:30 des Folgetags in Berlin. */
  const utcAnders = await fall('2026-10-11T22:30:00Z', '2026-10-12T05:00:00Z', KEIN_BAU)
  pruefe(utcAnders.erste === 2 && utcAnders.offen && utcAnders.am === '2026-10-12T05:00:00Z', 'gleicher Berlin-Tag (12.10.), anderer UTC-Tag (Meldung 00:30 MESZ): erneuert und wieder geöffnet')
  pruefe(utcAnders.zweite === 0, '... die nächste gleiche Meldung schreibt 0 Zeilen')
  const berlinAnders = await fall('2026-10-12T00:30:00Z', '2026-10-12T22:30:00Z', KEIN_BAU)
  pruefe(berlinAnders.erste === 2 && berlinAnders.offen && berlinAnders.am === '2026-10-12T22:30:00Z', 'gleicher UTC-Tag (12.10.), anderer Berlin-Tag (jetzt 00:30 MESZ): erneuert und wieder geöffnet')
  pruefe(berlinAnders.zweite === 0, '... die nächste gleiche Meldung schreibt 0 Zeilen')
  const gleicherTag = await fall('2026-10-12T05:00:00Z', '2026-10-12T15:00:00Z', KEIN_BAU)
  pruefe(gleicherTag.erste === 0 && !gleicherTag.offen && gleicherTag.am === '2026-10-12T05:00:00Z', 'derselbe Tag in Berlin und UTC, kein neuer Listenbau: 0 Zeilen, Zeile unverändert')

  const nurW = await fall('2026-10-12T05:00:00Z', '2026-10-12T10:00:00Z', '2026-10-12T06:00:00.000Z')
  pruefe(nurW.erste === 2 && !nurW.offen && nurW.am === '2026-10-12T10:00:00Z', 'W allein (heutige Zeile vor dem Listenbau): gemeldet_am erneuert, Zeile bleibt übernommen')
  const wUndD = await fall('2026-10-11T10:00:00Z', '2026-10-12T10:00:00Z', '2026-10-12T06:00:00.000Z')
  pruefe(wUndD.erste === 2 && wUndD.offen && wUndD.am === '2026-10-12T10:00:00Z', 'W und D (Zeile von gestern, vor dem Listenbau): ein UPDATE, D gewinnt, die Zeile wird wieder geöffnet')
  pruefe(wUndD.zweite === 0, '... danach liegt gemeldet_am hinter dem Listenbau: 0 Zeilen')
}

console.log('Lesezeilen: Pläne der Abfragen einer Meldung (EXPLAIN QUERY PLAN, 11.10.2026)')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  abfragen.length = 0
  const adresse = (n: number) => ({ ...folge(1), url: `https://www.disneyplus.com/de-de/browse/entity-${n}` })
  await handlePruefung(post({ stapel: [adresse(1), adresse(2), adresse(3)] }), env)
  const hashAbfragen = abfragen.filter((a) => LADEN.test(a.sql))
  const plan = hashAbfragen[0] ? planVon(db, hashAbfragen[0]) : ''
  pruefe(hashAbfragen.length === 1 && (JSON.parse(String(hashAbfragen[0]!.werte[0])) as unknown[]).length === 3, 'der Stapel mit drei Folgen lädt ihre Zeilen mit einer Abfrage')
  pruefe(plan.includes(FOLGEN_SUCHE) && !plan.includes('idx_pruefung_offen'), `die Hash-Abfrage sucht im Folgen-Index, nicht in den offenen Zeilen (${plan})`)
}

console.log('Lesezeilen: eine Meldung liest nur die Zeilen ihrer Folge (12.10.2026, Migration 053)')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  for (let nr = 1; nr <= 200; nr++) await handlePruefung(post(folge(nr)), env)
  db.exec("UPDATE pruefung SET uebernommen = 1 WHERE folge_nr <= 100")
  abfragen.length = 0
  await handlePruefung(post(folge(150)), env)
  const eine = abfragen.find((a) => LADEN.test(a.sql))
  const gelesen = (a?: { sql: string; werte: unknown[] }) => (a ? db.prepare(a.sql).all(...(a.werte as never[])).length : -1)
  pruefe(gelesen(eine) === 1, `Seite mit 200 Folgen: die Ladeabfrage liefert nur die Zeile der gemeldeten Folge (${gelesen(eine)})`)
  abfragen.length = 0
  await handlePruefung(post({ stapel: Array.from({ length: 10 }, (_, k) => folge(51 + k * 15)) }), env)
  const stapel = abfragen.filter((a) => LADEN.test(a.sql))
  pruefe(stapel.length === 1 && gelesen(stapel[0]) === 10, `Stapel zu 10 Folgen: eine Ladeabfrage, zehn Zeilen (${stapel.length} Abfragen, ${gelesen(stapel[0])} Zeilen)`)
  /* Ohne Staffel, Folge und Seitenkennung (NULL) und mit Seitenkennung: der Schlüssel trifft nur die eigene Zeile. */
  const ohne = { ...folge(1), folge_nr: undefined, staffel: undefined }
  await handlePruefung(post(ohne), env)
  await handlePruefung(post({ ...ohne, seiten_kennung: 'K1' }), env)
  abfragen.length = 0
  await handlePruefung(post(ohne), env)
  pruefe(gelesen(abfragen.find((a) => LADEN.test(a.sql))) === 1, 'Meldung ohne Folgennummer, Staffel und Kennung (NULL): genau eine Zeile')
  pruefe(!abfragen.some((a) => /^(INSERT|DELETE)/.test(a.sql)), '... und unverändert: nichts geschrieben')
  abfragen.length = 0
  await handlePruefung(post({ ...ohne, seiten_kennung: 'K1' }), env)
  pruefe(gelesen(abfragen.find((a) => LADEN.test(a.sql))) === 1, 'Meldung mit Seitenkennung: genau die Zeile dieser Kennung')
}

console.log('Lesezeilen: Ersetzen über die Zeilen-ID')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  abfragen.length = 0
  await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)
  pruefe(!abfragen.some((a) => /^DELETE FROM pruefung/.test(a.sql)), 'neue Folgen: kein DELETE (es gibt nichts zu ersetzen)')
  db.exec('INSERT INTO pruefung (plattform, url, befund, folge_nr, staffel, gemeldet_am) SELECT plattform, url, befund, folge_nr, staffel, gemeldet_am FROM pruefung WHERE folge_nr = 1')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 1') === 2, 'Vorbereitung: Folge 1 steht doppelt (Dublette)')
  abfragen.length = 0
  await handlePruefung(post(folge(1, 'nein')), env)
  const loeschen = abfragen.filter((a) => /^DELETE FROM pruefung/.test(a.sql))
  pruefe(loeschen.length === 1 && /WHERE id IN \(\?,\?\)$/.test(loeschen[0]!.sql), `Änderung: ein DELETE über die IDs beider Dubletten (${loeschen[0]?.sql})`)
  pruefe(!!loeschen[0] && planVon(db, loeschen[0]).includes('INTEGER PRIMARY KEY'), 'der Plan geht über den Primärschlüssel, liest keine Adresszeilen')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 1') === 1 && zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 1 AND ton_de = 'nein'") === 1, 'Folge 1: nur noch die neue Zeile')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 2') === 1, 'Folge 2 derselben Adresse bleibt unberührt')
  pruefe(!abfragen.some((a) => /DELETE FROM pruefung WHERE url/.test(a.sql)), 'kein DELETE mehr über die Adresse')
}

console.log('Lesezeilen: keine Gesamtzahl der Rohfolgen mehr (12.10.2026)')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  await handlePruefung(post({ stapel: [folge(1), folge(2), folge(3)] }), env)
  db.exec("UPDATE pruefung SET rohfolge = json_set(rohfolge, '$.vorhanden', 'nein') WHERE folge_nr = 3")
  const hole = async (nach: number) => {
    abfragen.length = 0
    const r = await handlePruefung(new Request(`https://worker.test/pruefung?rohfolgen=1&token=t&nach=${nach}`), env)
    const inhalt = (await r.json()) as { folgen: unknown[]; gesamt?: number; weiter: number | null }
    return { inhalt, gezaehlt: abfragen.some((a) => /COUNT\(\*\)/.test(a.sql)) }
  }
  const erste = await hole(0)
  pruefe(erste.inhalt.folgen.length === 2 && erste.inhalt.weiter === null, 'erste Seite unter dem Limit: gesperrte Folge zählt nicht')
  pruefe(!erste.gezaehlt && erste.inhalt.gesamt === undefined, '... und ohne COUNT(*), ohne Gesamtzahl')
  const spaeter = await hole(PRUEFUNG_ID_AB + 1)
  pruefe(spaeter.inhalt.folgen.length === 1 && !spaeter.gezaehlt, 'Fortsetzungsseite (nach > 0): auch ohne COUNT(*) (der Bau setzt über `weiter` fort)')
}

console.log('Lesezeilen: /lauf wird 120 Sekunden gehalten')
{
  const gehalten = new Map<string, Response>()
  const global = globalThis as { caches?: unknown }
  global.caches = {
    default: {
      match: async (k: Request) => gehalten.get(k.url)?.clone(),
      put: async (k: Request, r: Response) => void gehalten.set(k.url, r),
    },
  }
  const wartend: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void wartend.push(p.catch(() => {})) } as never
  const env = umgebung(neueDatenbank())
  const hole = async (adresse: string) => {
    abfragen.length = 0
    const r = await handleLauf(new Request(`https://worker.test/lauf${adresse}`), env, ctx)
    await Promise.all(wartend)
    return { status: r.status, lesen: abfragen.filter((a) => /FROM lauf_status/.test(a.sql)).length }
  }
  const erste = await hole('')
  const zweite = await hole('')
  pruefe(erste.status === 200 && erste.lesen > 0, `erster Aufruf liest die Läufe (${erste.lesen} Abfragen)`)
  pruefe(zweite.status === 200 && zweite.lesen === 0, 'zweiter Aufruf kommt aus dem Cache, 0 Abfragen auf lauf_status')
  pruefe([...gehalten.values()][0]?.headers.get('Cache-Control') === 'public, max-age=120', 'die gehaltene Antwort trägt 120 Sekunden')
  const verlauf = await hole('?verlauf=daten')
  pruefe(verlauf.lesen > 0 && (await hole('?verlauf=daten')).lesen > 0, 'der Verlauf einer Lauf-Art (Detailseite) bleibt ungehalten')
}

console.log('Lesezeilen: ?gemeldet= je Adresse und die wartenden Meldungen aus dem Cache (12.10.2026)')
{
  const gehalten = new Map<string, Response>()
  const global = globalThis as { caches?: unknown }
  global.caches = {
    default: {
      match: async (k: Request) => gehalten.get(k.url)?.clone(),
      put: async (k: Request, r: Response) => void gehalten.set(k.url, r),
      delete: async (k: Request) => gehalten.delete(k.url),
    },
  }
  const wartend: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void wartend.push(p.catch(() => {})) } as never
  const db = neueDatenbank()
  const env = umgebung(db)
  const A = 'https://www.disneyplus.com/de-de/browse/entity-a'
  const B = 'https://www.disneyplus.com/de-de/browse/entity-b'
  const von = (url: string, nr: number) => ({ ...folge(nr), url })
  await handlePruefung(post({ stapel: [von(A, 1), von(B, 1)] }), env, ctx)
  const hole = async (adresse: string) => {
    abfragen.length = 0
    const r = await handlePruefung(new Request(`https://worker.test/pruefung?${adresse}`), env, ctx)
    await Promise.all(wartend)
    return {
      status: r.status,
      inhalt: (await r.json()) as { paare?: { nummer: number }[]; anbieter?: unknown[] },
      /* Die Abfragen auf `pruefung`: `?gemeldet=` (MAX) und die wartenden Meldungen (ohne Adressen, die eine Titelzeile haben). */
      lesen: abfragen.filter((a) => /MAX\(gemeldet_am\)|WHERE uebernommen = 0( AND url NOT IN \(SELECT url FROM titel_zeile\))?$/.test(a.sql)).length,
    }
  }
  const nummern = (r: { inhalt: { paare?: { nummer: number }[] } }) => (r.inhalt.paare ?? []).map((p) => p.nummer).join(',')
  const a1 = await hole(`gemeldet=${encodeURIComponent(A)}`)
  const a2 = await hole(`gemeldet=${A}`)
  pruefe(a1.lesen === 1 && nummern(a1) === '1', `erster Aufruf liest die Adresse einmal (${a1.lesen}), Folge 1`)
  pruefe(a2.lesen === 0 && nummern(a2) === '1', 'zweiter Aufruf, anders kodiert, kommt aus dem Cache: 0 Zeilenabfragen')
  pruefe([...gehalten.values()][0]?.headers.get('Cache-Control') === 'public, max-age=1800', 'die Antwort hält 1800 Sekunden')
  await hole(`gemeldet=${encodeURIComponent(B)}`)
  await handlePruefung(post(von(A, 2)), env, ctx)
  const a3 = await hole(`gemeldet=${encodeURIComponent(A)}`)
  pruefe(a3.lesen === 1 && nummern(a3) === '1,2', 'nach einer Meldung zu A liest A neu und zeigt die neue Folge (ohne Verzögerung)')
  pruefe((await hole(`gemeldet=${encodeURIComponent(B)}`)).lesen === 0, '... B bleibt im Cache (verworfen wird nur die Adresse, zu der geschrieben wurde)')
  await handlePruefung(post({ stapel: [von(B, 2)] }), env, ctx)
  pruefe((await hole(`gemeldet=${encodeURIComponent(B)}`)).lesen === 1, 'ein Stapel verwirft die Adressen seiner Meldungen')
  const loeschen = (rumpf: unknown) =>
    handlePruefung(new Request('https://worker.test/pruefung', { method: 'DELETE', headers: { 'X-Lauf-Token': 't' }, body: JSON.stringify(rumpf) }), env, ctx)
  await loeschen({ url: A, nummern: [2] })
  const a4 = await hole(`gemeldet=${encodeURIComponent(A)}`)
  pruefe(a4.lesen === 1 && nummern(a4) === '1', 'Löschen einer Folge verwirft die Adresse')
  const id = (db.prepare('SELECT id FROM pruefung WHERE url = ? AND folge_nr = 1').get(A) as { id: number }).id
  await loeschen({ ids: [id] })
  const a5 = await hole(`gemeldet=${encodeURIComponent(A)}`)
  pruefe(a5.lesen === 1 && nummern(a5) === '', 'Löschen über die Zeilen-ID verwirft die Adresse')

  stand.anbieter = []
  const s1 = await hole('stand=1')
  const standEintrag = () => [...gehalten.keys()].find((k) => k.includes('stand=1'))!
  gehalten.delete(standEintrag())
  const s2 = await hole('stand=1')
  pruefe(s1.lesen === 1 && s2.lesen === 0, `die wartenden Meldungen kommen auch bei neu gerechnetem Stand aus dem Cache (${s1.lesen}, ${s2.lesen} Abfragen)`)
  const wartendeEintrag = [...gehalten.keys()].find((k) => k.endsWith('?wartend=1'))
  pruefe(!!wartendeEintrag, 'sie liegen unter eigener Adresse neben dem Stand')
  pruefe(gehalten.get(wartendeEintrag ?? '')?.headers.get('Cache-Control') === 'public, max-age=7200', 'die wartenden halten 7200 Sekunden (zwei Stunden, vorher 1800)')
  await hole('zaehlen=1')
  const zaehlenEintrag = [...gehalten.keys()].find((k) => k.includes('zaehlen=1'))
  pruefe(gehalten.get(zaehlenEintrag ?? '')?.headers.get('Cache-Control') === 'public, max-age=7200', '?zaehlen=1 hält 7200 Sekunden (zwei Stunden, vorher 1800)')
  await handlePruefung(post(von(A, 9)), env, ctx)
  gehalten.delete(standEintrag())
  pruefe((await hole('stand=1')).lesen === 0, 'eine Meldung verwirft die wartenden nicht (nur Ablauf; Meldungen seit dem Listenbau zieht der Stand frisch ab)')
  const kaputt = global.caches as { default: { delete: () => Promise<boolean> } }
  kaputt.default.delete = async () => {
    throw new Error('Cache kaputt')
  }
  const trotzFehler = await handlePruefung(post(von(A, 10)), env, ctx)
  const gespeichert = zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 10') === 1
  pruefe(trotzFehler.status === 200 && gespeichert, 'scheitert das Verwerfen, bleibt die Meldung gespeichert und beantwortet')
}

console.log('Rohfolgen: nur Geändertes wird geschrieben (12.10.2026, Migration 050)')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  const SEITE = 'https://www.amazon.de/dp/B0TEST'
  const prime = (n: number, notiz: string, ton = 'ja') => ({
    plattform: 'primevideo',
    url: SEITE,
    vorhanden: 'ja',
    ton_de: 'ja',
    art: 'gemessen',
    titel: 'Testserie',
    folgen: n,
    notiz,
    seiten_kennung: 's1',
    rohfolgen: Array.from({ length: n }, (_, i) => ({
      gti: `g${i + 1}`,
      nummer: i + 1,
      titel: `Folge ${i + 1}`,
      vorhanden: 'ja',
      ton_de: i === 2 ? ton : 'ja',
    })),
  })
  const ids = () => (db.prepare('SELECT id FROM prime_folge ORDER BY id').all() as { id: number }[]).map((r) => r.id).join()
  const schreibend = () => abfragen.filter((a) => /^(INSERT INTO|DELETE FROM) prime_folge/.test(a.sql))
  const sende = async (body: unknown) => {
    abfragen.length = 0
    await handlePruefung(post(body), env)
    return schreibend()
  }
  const erst = await sende(prime(10, 'a'))
  const idsErst = ids()
  pruefe(erst.length === 10 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge WHERE hash IS NOT NULL') === 10, 'erste Meldung: 10 Einfügungen, jede Zeile trägt einen Hash')
  const gleich = await sende(prime(10, 'b'))
  pruefe(gleich.length === 0 && ids() === idsErst, 'andere Notiz, gleiche Folgen: 0 Schreibzugriffe auf prime_folge, alle Zeilen bleiben (vorher 10 Löschungen + 10 Einfügungen)')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE uebernommen = 0') === 1, '... die Meldung selbst wurde ersetzt')
  const geaendert = await sende(prime(10, 'b', 'nein'))
  pruefe(geaendert.length === 2 && geaendert.filter((a) => /^INSERT/.test(a.sql)).length === 1, `eine geänderte Folge: genau ein DELETE und ein INSERT (${geaendert.length} Anweisungen)`)
  const nach = ids().split(',')
  pruefe(nach.length === 10 && idsErst.split(',').filter((i) => nach.includes(i)).length === 9, '... die übrigen neun Zeilen behalten ihre ID')
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM prime_folge WHERE ton_de = 'nein'") === 1, '... die neue Fassung steht in der Tabelle')
  const weniger = await sende(prime(9, 'b', 'nein'))
  pruefe(weniger.length === 1 && /^DELETE/.test(weniger[0]!.sql) && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 9, 'eine Folge fällt weg: nur ein DELETE, kein INSERT')
  const mehr = await sende(prime(10, 'c', 'nein'))
  pruefe(mehr.length === 1 && /^INSERT/.test(mehr[0]!.sql) && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 10, 'eine Folge kommt dazu: nur ein INSERT, kein DELETE')
  db.exec('UPDATE prime_folge SET hash = NULL')
  const altbestand = await sende(prime(10, 'd', 'nein'))
  pruefe(altbestand.length === 11 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 10, 'Zeilen ohne Hash (vor Migration 050) werden einmal ersetzt (1 Löschstapel + 10 Einfügungen)')
  pruefe((await sende(prime(10, 'e', 'nein'))).length === 0, '... danach greift der Hash')
  db.exec('INSERT INTO prime_folge (url, nummer, plattform, seiten_kennung, gemeldet_am, hash, gti) SELECT url, nummer, plattform, seiten_kennung, gemeldet_am, hash, gti FROM prime_folge WHERE nummer = 1')
  await sende(prime(10, 'f', 'nein'))
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge WHERE nummer = 1') === 1, 'eine Dublette derselben Folge wird entfernt, die Folge bleibt einmal')
  db.exec('UPDATE prime_folge SET uebernommen = 1')
  const nachAbhaken = await sende(prime(10, 'g', 'nein'))
  pruefe(nachAbhaken.length === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge WHERE uebernommen = 0') === 0, 'abgehakte Zeilen mit gleichem Hash werden nicht neu geschrieben (vorher 10 Einfügungen je Durchgang)')
}
{
  const db = neueDatenbank()
  const env = umgebung(db)
  const netflix = (nr: number, ton = 'ja') => ({
    plattform: 'netflix',
    url: 'https://www.netflix.com/title/1',
    vorhanden: 'ja',
    ton_de: ton,
    art: 'gemessen',
    titel: 'NF',
    folge_nr: nr,
    staffel: 1,
    /* Zwei Rohfolgen: mehr als eine bleibt in `prime_folge` (die eine Rohfolge steht sonst in der Meldungszeile). */
    rohfolgen: [
      { gti: `n${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton },
      { gti: `m${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton },
    ],
  })
  await handlePruefung(post({ stapel: [netflix(1), netflix(2)] }), env)
  const vorher = (db.prepare("SELECT id FROM prime_folge WHERE gti = 'n2'").get() as { id: number }).id
  abfragen.length = 0
  await handlePruefung(post(netflix(1, 'nein')), env)
  const lade = abfragen.find((a) => /^SELECT id, hash, .* FROM prime_folge/.test(a.sql))
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM prime_folge WHERE gti = 'n2' AND id = " + vorher) === 1, 'Netflix: eine Meldung ersetzt nur ihre eigene Kennung, Folge 2 bleibt unberührt')
  pruefe(!!lade && planVon(db, lade).includes('prime_folge_gti') && !/SCAN prime_folge/.test(planVon(db, lade)), `die Ladeabfrage je Kennung (offen und übernommen) nimmt den gti-Index, kein SCAN (${lade ? planVon(db, lade) : 'keine Abfrage'})`)
  abfragen.length = 0
  await handlePruefung(post({ plattform: 'primevideo', url: 'https://www.amazon.de/dp/B0X', vorhanden: 'ja', ton_de: 'ja', art: 'gemessen', seiten_kennung: 's1', rohfolgen: [{ gti: 'a', nummer: 1 }] }), env)
  const ladeSeite = abfragen.find((a) => /^SELECT id, hash, .* FROM prime_folge/.test(a.sql))
  pruefe(!!ladeSeite && planVon(db, ladeSeite).includes('prime_folge_seite') && !/SCAN prime_folge/.test(planVon(db, ladeSeite)), `die Ladeabfrage je Prime-Seite (offen und übernommen) nimmt den Seiten-Index, kein SCAN (${ladeSeite ? planVon(db, ladeSeite) : 'keine Abfrage'})`)
}

console.log('Wächter: Messverlauf wird einmal am Tag aufgeräumt (12.10.2026)')
{
  const sqls: string[] = []
  const fake = {
    prepare: (sql: string) => ({ bind: () => ({ sql }) }),
    batch: async (liste: { sql: string }[]) => void sqls.push(...liste.map((a) => a.sql)),
  } as never
  const ergebnis = [{ site: { url: 'https://a.test', name: 'a' }, ok: true, ms: 5 }] as never
  const loeschungen = () => sqls.filter((s) => s.startsWith('DELETE FROM site_history')).length
  await schreibeVerlauf(fake, ergebnis, '2026-10-12T14:00:00.000Z')
  pruefe(sqls.length === 1 && loeschungen() === 0, 'ein Lauf um 14 Uhr UTC hängt nur an, ohne Aufräumen')
  await schreibeVerlauf(fake, ergebnis, '2026-10-13T03:00:00.000Z')
  pruefe(loeschungen() === 1, 'der Lauf um 03 Uhr UTC räumt auf (einmal am Tag)')
}

if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
process.exit(0)
