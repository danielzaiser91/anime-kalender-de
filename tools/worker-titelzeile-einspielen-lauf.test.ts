/**
 * **Ein Lauf des Einspielens** (`tools/worker-titelzeile-einspielen-lauf.ts`, 14.10.2026) gegen eine SQLite-Datenbank mit mehr als
 * einer Exportseite und Zeilen anderer Anbieter dazwischen und dahinter:
 * - Export Seite für Seite, Marke `<tabelle>-bis.json` = höchste `id` der Tabelle; der nächste Lauf liest nur dahinter,
 *   der dritte hat nichts mehr zu tun;
 * - Probelauf: Faktor aus der ersten Seite, Hochrechnung = gelesene Zeilen des ganzen Exports; ab der Schwelle Abbruch
 *   nach den Probeseiten, die liegen bleiben und hinter denen der nächste Lauf fortsetzt;
 * - ohne `rows_read` bricht der Lauf mit Tor ab, ohne Tor (lokal) läuft er.
 *
 * Aufruf: `npx tsx tools/worker-titelzeile-einspielen-lauf.test.ts`
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { einspielLauf, PROBE_BEREICH, SCHWELLE, type Abfrage } from './worker-titelzeile-einspielen-lauf.ts'
import { abfrageAus, neueDatenbank, zahl } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const url = (n: number) => `https://www.netflix.com/title/820000${String(n).padStart(2, '0')}`
const AM = '2026-10-01T00:00:00Z'

/**
 * `pruefung`: 2.500 Netflix-Zeilen (25 Titel zu 100 Folgen), nach je zwei eine Disney+-Zeile, dahinter 500 Disney+-Zeilen
 * (4.250 Zeilen, ids lückenlos). `prime_folge`: 700 Prime-Zeilen und 48 Netflix-Rohfolgen (748). Der ganze Export liest
 * damit 1 + 4.250 + 1 + 748 = 5.000 Zeilen.
 */
function bestand() {
  const db = neueDatenbank()
  const meldung = db.prepare(
    "INSERT INTO pruefung (plattform, url, befund, gemeldet_am, staffel, folge_nr, vorhanden, ton_de, art) VALUES (?, ?, 'dub', ?, 1, ?, 'ja', 'ja', 'gemessen')",
  )
  for (let i = 0; i < 2500; i++) {
    meldung.run('netflix', url(i % 25), AM, Math.floor(i / 25) + 1)
    if (i % 2 === 1) meldung.run('disneyplus', 'https://www.disneyplus.com/series/x/1', AM, i)
  }
  for (let i = 0; i < 500; i++) meldung.run('disneyplus', 'https://www.disneyplus.com/series/x/2', AM, i)
  const roh = db.prepare("INSERT INTO prime_folge (plattform, url, gti, nummer, staffel_nr, titel, vorhanden, ton_de, gemeldet_am) VALUES (?, ?, ?, ?, 1, 'Folge', 'ja', 'ja', ?)")
  for (let i = 0; i < 700; i++) roh.run('primevideo', 'https://www.amazon.de/dp/B0X', `amzn1.${i}`, i, AM)
  for (let i = 0; i < 48; i++) roh.run('netflix', url(0), `8300${i}`, 101 + i, AM)
  return db
}

const neuerOrdner = () => mkdtempSync(join(tmpdir(), 'titelzeile-lauf-'))
const dateien = (ordner: string, muster: RegExp) => readdirSync(ordner).filter((d) => muster.test(d))
const marke = (ordner: string, tabelle: string) => Number(JSON.parse(readFileSync(`${ordner}/${tabelle}-bis.json`, 'utf8')))
const folgen = (db: ReturnType<typeof neueDatenbank>) => zahl(db, "SELECT COUNT(*) AS n FROM titel_zeile, json_each(daten, '$.f')")
const ausfuehren = (db: ReturnType<typeof neueDatenbank>, sql: string[]) => sql.forEach((a) => db.exec(a))

console.log('Mehrere Seiten, Marke, Nachzügler')
{
  const db = bestand()
  const ordner = neuerOrdner()
  const eins = einspielLauf('netflix', ordner, abfrageAus(db), true)
  ausfuehren(db, eins.sql)
  pruefe(eins.neu.pruefung === 2500 && eins.neu.prime_folge === 48, `alle Zeilen des Anbieters exportiert (${JSON.stringify(eins.neu)})`)
  pruefe(dateien(ordner, /^pruefung-\d+\.json$/).length === 3, `drei Seiten pruefung (${dateien(ordner, /^pruefung-\d+\.json$/)})`)
  pruefe(marke(ordner, 'pruefung') === 4250 && marke(ordner, 'prime_folge') === 748, 'Marke = höchste id der Tabelle, auch hinter der letzten Netflix-Zeile')
  pruefe(eins.gelesen === 5000 && eins.probelauf.hochrechnung === 5000, `gelesen ${eins.gelesen}, Hochrechnung ${eins.probelauf.hochrechnung} (erwartet je 5000)`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 25 && folgen(db) === 2548, `25 Titelzeilen mit 2548 Folgen (${folgen(db)})`)

  const meldung = db.prepare("INSERT INTO pruefung (plattform, url, befund, gemeldet_am, staffel, folge_nr, vorhanden, ton_de, art) VALUES ('netflix', ?, 'dub', ?, 1, ?, 'ja', 'ja', 'gemessen')")
  for (let i = 0; i < 10; i++) meldung.run(url(0), '2026-10-02T00:00:00Z', 201 + i)
  const protokoll: string[] = []
  const zwei = einspielLauf('netflix', ordner, abfrageAus(db, 1, protokoll), true)
  ausfuehren(db, zwei.sql)
  const erste = protokoll.find((s) => s.includes('FROM pruefung WHERE'))
  pruefe(zwei.lauf === 2 && zwei.neu.pruefung === 10 && /id > 4250 /.test(erste ?? ''), `zweiter Lauf liest nur hinter der Marke (${zwei.neu.pruefung} neu)`)
  pruefe(zwei.gelesen === 1 + 10 + 1 + 0 + 25, `zweiter Lauf: ${zwei.gelesen} gelesen (MAX, 10 neue, MAX, leere Seite, 25 Titelzeilen)`)
  pruefe(folgen(db) === 2558, `Nachzügler in der Titelzeile (${folgen(db)} Folgen)`)
  const drei = einspielLauf('netflix', ordner, abfrageAus(db), true)
  pruefe(drei.lauf === 3 && drei.sql.length === 0, 'dritter Lauf hat nichts mehr zu tun')
  rmSync(ordner, { recursive: true })
}

console.log('Probelauf: Schwelle')
{
  const db = bestand()
  const ordner = neuerOrdner()
  const unter = einspielLauf('netflix', ordner, abfrageAus(db, 49), true)
  pruefe(unter.probelauf.hochrechnung === 245_000 && unter.gelesen === 245_000, `Faktor 49: Hochrechnung ${unter.probelauf.hochrechnung} = gelesen ${unter.gelesen}, unter ${SCHWELLE}: läuft`)
  pruefe(unter.probelauf.faktor === 'pruefung 49.00, prime_folge 49.00', `Faktor je Tabelle aus der Probeseite (${unter.probelauf.faktor})`)
  rmSync(ordner, { recursive: true })

  const zweiter = neuerOrdner()
  const protokoll: string[] = []
  let meldung = ''
  try {
    einspielLauf('netflix', zweiter, abfrageAus(db, 50, protokoll), true)
  } catch (e) {
    meldung = (e as Error).message
  }
  pruefe(meldung.includes('Hochrechnung 250000'), `Faktor 50: Hochrechnung erreicht die Schwelle, Abbruch (${meldung.slice(0, 50)})`)
  const seiten = protokoll.filter((s) => s.includes(' ORDER BY id '))
  pruefe(protokoll.length === 4 && seiten.every((s) => / id > 0 /.test(s)), `nur die Probeseiten gelesen (${protokoll.length} Abfragen)`)
  pruefe(!existsSync(`${zweiter}/pruefung-bis.json`) && dateien(zweiter, /^titel_zeile-/).length === 0, 'keine Marke, keine Titelzeilen gelesen')
  const weiter = einspielLauf('netflix', zweiter, abfrageAus(db), true)
  pruefe(weiter.neu.pruefung === 1500 && weiter.sql.length === 25, `nächster Lauf setzt hinter der Probeseite fort (${weiter.neu.pruefung} neu, ${weiter.sql.length} Anweisungen)`)
  rmSync(zweiter, { recursive: true })
}

/** Der Lauf bricht ab (Meldung) oder läuft durch (leer); `protokoll` sammelt die Abfragen. */
function versuche(db: ReturnType<typeof neueDatenbank>, ordner: string, faktor: number, protokoll: string[] = []): string {
  try {
    einspielLauf('netflix', ordner, abfrageAus(db, faktor, protokoll), true)
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

console.log('Probelauf: Hochrechnung hinter einer Marke (Start > 0, volle Probeseite)')
{
  /* Marke 2000: die Probeseite von pruefung ist voll (1000 Netflix-Zeilen ab id 2001) und endet bei id 3500, die Tabelle bei 4250.
     Bis zum Ende sind es 2250 Ids, 750 davon noch hinter der Seite: bei Faktor 90 rechnet pruefung 90 × 2250 = 202.500,
     prime_folge 90 × 748 = 67.320, plus 2 × 90 für die MAX-Abfragen 270.000 >= 250.000. Ohne `- start` im Bereich (3500 statt 1500) wäre der Faktor
     36 und die Hochrechnung 1.500 × 90 + 36 × 750 + 67.320 = 229.320: kein Abbruch. */
  const db = bestand()
  const ordner = neuerOrdner()
  writeFileSync(`${ordner}/pruefung-bis.json`, '2000')
  const meldung = versuche(db, ordner, 90)
  pruefe(meldung.includes('Hochrechnung 270000 '), `Faktor 90 hinter Marke 2000: Abbruch (${meldung.slice(0, 40)})`)
  rmSync(ordner, { recursive: true })
}

console.log('Probelauf: Abbruch schon nach der ersten Probe')
{
  const db = bestand()
  const ordner = neuerOrdner()
  const protokoll: string[] = []
  const meldung = versuche(db, ordner, 300, protokoll)
  pruefe(meldung.includes('erreicht die Schwelle'), `Faktor 300: allein pruefung reißt die Schwelle (${meldung.slice(0, 40)})`)
  pruefe(protokoll.length === 2 && !protokoll.some((s) => s.includes('prime_folge')), `prime_folge nicht mehr gefragt (${protokoll.length} Abfragen)`)
  rmSync(ordner, { recursive: true })
}

console.log('Probelauf: Id-Bereich der Probeseite begrenzt')
{
  /* prime_folge: 60.000 Zeilen von Prime, erst dahinter 10 Netflix-Rohfolgen; pruefung: 100 Netflix-Zeilen. Die Probeseite
     liest höchstens PROBE_BEREICH Zeilen (ohne Deckel alle 60.010), findet nichts, ist aber nicht die letzte Seite: der
     Export geht dahinter weiter und findet die 10. */
  const db = neueDatenbank()
  const meldung = db.prepare("INSERT INTO pruefung (plattform, url, befund, gemeldet_am, staffel, folge_nr, vorhanden, ton_de, art) VALUES ('netflix', ?, 'dub', ?, 1, ?, 'ja', 'ja', 'gemessen')")
  for (let i = 0; i < 100; i++) meldung.run(url(i % 5), AM, i + 1)
  const roh = db.prepare("INSERT INTO prime_folge (plattform, url, gti, nummer, staffel_nr, titel, vorhanden, ton_de, gemeldet_am) VALUES (?, ?, ?, ?, 1, 'Folge', 'ja', 'ja', ?)")
  db.exec('BEGIN')
  for (let i = 0; i < 60_000; i++) roh.run('primevideo', 'https://www.amazon.de/dp/B0X', `amzn1.${i}`, i, AM)
  for (let i = 0; i < 10; i++) roh.run('netflix', url(0), `8300${i}`, 101 + i, AM)
  db.exec('COMMIT')
  const ordner = neuerOrdner()
  const protokoll: string[] = []
  const lauf = einspielLauf('netflix', ordner, abfrageAus(db, 1, protokoll), true)
  const erste = protokoll.find((s) => s.includes('FROM prime_folge WHERE'))
  pruefe(/ AND id <= 25000 /.test(erste ?? ''), `Probeseite hat den Deckel (${erste?.slice(-70)})`)
  const gelesen = abfrageAus(db)(erste!).meta?.rows_read
  pruefe(gelesen === PROBE_BEREICH, `Probeseite liest ${gelesen} Zeilen, höchstens ${PROBE_BEREICH}`)
  pruefe(lauf.neu.prime_folge === 10 && lauf.neu.pruefung === 100, `Export geht hinter dem Deckel weiter (${JSON.stringify(lauf.neu)})`)
  pruefe(lauf.probelauf.hochrechnung === 60_112 && lauf.gelesen === 60_112, `Hochrechnung ${lauf.probelauf.hochrechnung} = gelesen ${lauf.gelesen}`)
  rmSync(ordner, { recursive: true })

  const hinter = neuerOrdner()
  writeFileSync(`${hinter}/prime_folge-bis.json`, '30000')
  const protokollHinter: string[] = []
  const zwei = einspielLauf('netflix', hinter, abfrageAus(db, 1, protokollHinter), true)
  const probeHinter = protokollHinter.find((s) => s.includes('FROM prime_folge WHERE'))
  pruefe(/ AND id > 30000 AND id <= 55000 /.test(probeHinter ?? ''), `hinter einer Marke liegt der Deckel hinter der Marke (${probeHinter?.slice(-70)})`)
  pruefe(zwei.neu.prime_folge === 10, `Marke 30000: die 10 Netflix-Rohfolgen hinter dem Deckel kommen an (${zwei.neu.prime_folge})`)
  rmSync(hinter, { recursive: true })

  for (const [faktor, abbruch] of [[4, false], [5, true]] as const) {
    const eigener = neuerOrdner()
    const text = versuche(db, eigener, faktor)
    pruefe(text.includes('erreicht die Schwelle') === abbruch, `Deckel: Faktor ${faktor} ${abbruch ? 'bricht ab' : 'läuft'} (${text.slice(0, 30)})`)
    rmSync(eigener, { recursive: true })
  }
}

console.log('Probeseite endet genau an der höchsten id')
{
  /* 24.990 Prime-Zeilen und 10 Netflix-Rohfolgen: die höchste id (25.000) ist der Deckel. Die Probeseite ist damit die
     letzte, eine weitere Seite wäre eine Abfrage umsonst. */
  const db = neueDatenbank()
  const roh = db.prepare("INSERT INTO prime_folge (plattform, url, gti, nummer, staffel_nr, titel, vorhanden, ton_de, gemeldet_am) VALUES (?, ?, ?, ?, 1, 'Folge', 'ja', 'ja', ?)")
  db.exec('BEGIN')
  for (let i = 0; i < PROBE_BEREICH - 10; i++) roh.run('primevideo', 'https://www.amazon.de/dp/B0X', `amzn1.${i}`, i, AM)
  for (let i = 0; i < 10; i++) roh.run('netflix', url(0), `8300${i}`, 101 + i, AM)
  db.exec('COMMIT')
  const ordner = neuerOrdner()
  const protokoll: string[] = []
  const lauf = einspielLauf('netflix', ordner, abfrageAus(db, 1, protokoll), true)
  const seiten = protokoll.filter((s) => s.includes('FROM prime_folge WHERE')).length
  pruefe(seiten === 1 && lauf.neu.prime_folge === 10, `eine Seite für prime_folge, 10 Rohfolgen (${seiten} Seiten, ${lauf.neu.prime_folge})`)
  rmSync(ordner, { recursive: true })
}

console.log('Probelauf: leere Seite meldet Lesezeilen')
{
  /* Der dritte Lauf hat nichts zu lesen (Marke = höchste id), D1 meldet für die leere Seite trotzdem eine gelesene Zeile:
     Bereich 0, also Faktor 0 – keine Division durch 0, kein Faktor 1. */
  const db = bestand()
  const ordner = neuerOrdner()
  einspielLauf('netflix', ordner, abfrageAus(db), true)
  const leer: Abfrage = (sql) => {
    const a = abfrageAus(db)(sql)
    return { results: a.results, meta: { rows_read: (a.meta?.rows_read ?? 0) + 1 } }
  }
  const nochmal = einspielLauf('netflix', ordner, leer, true)
  pruefe(nochmal.probelauf.faktor === 'pruefung 0.00, prime_folge 0.00', `leere Probeseite: Faktor 0 (${nochmal.probelauf.faktor})`)
  pruefe(nochmal.probelauf.hochrechnung === 6, `Hochrechnung = gelesene Zeilen (${nochmal.probelauf.hochrechnung})`)
  rmSync(ordner, { recursive: true })
}

console.log('Probelauf: Zeilen kommen zwischen MAX und Probeseite dazu')
{
  /* Marke 3500, danach 167 Netflix-Zeilen; nach `MAX(id)` kommen 1.500 dazu: die volle Seite endet hinter der höchsten id.
     Der Rest bis zur höchsten id ist dann negativ und darf die Hochrechnung nicht unter die gelesenen Zeilen drücken. */
  const db = bestand()
  const ordner = neuerOrdner()
  writeFileSync(`${ordner}/pruefung-bis.json`, '3500')
  const einmal = abfrageAus(db)
  let eingefuegt = false
  const racig: Abfrage = (sql) => {
    const a = einmal(sql)
    if (!eingefuegt && sql.includes('AS id FROM pruefung')) {
      eingefuegt = true
      const meldung = db.prepare("INSERT INTO pruefung (plattform, url, befund, gemeldet_am, staffel, folge_nr, vorhanden, ton_de, art) VALUES ('netflix', ?, 'dub', ?, 1, ?, 'ja', 'ja', 'gemessen')")
      for (let i = 0; i < 1500; i++) meldung.run(url(0), AM, 500 + i)
    }
    return a
  }
  const lauf = einspielLauf('netflix', ordner, racig, true)
  pruefe(lauf.probelauf.hochrechnung === 2334, `Hochrechnung ${lauf.probelauf.hochrechnung} = gelesene Zeilen der Proben (1 + 1.583 + 1 + 749), nicht darunter`)
  rmSync(ordner, { recursive: true })
}

console.log('Ohne rows_read')
{
  const db = bestand()
  const ohne: Abfrage = (sql) => ({ results: abfrageAus(db)(sql).results })
  const ordner = neuerOrdner()
  let meldung = ''
  try {
    einspielLauf('netflix', ordner, ohne, true)
  } catch (e) {
    meldung = (e as Error).message
  }
  pruefe(meldung.startsWith('keine gelesenen Zeilen'), `mit Tor (echte D1): Abbruch (${meldung.slice(0, 40)})`)
  rmSync(ordner, { recursive: true })
  const lokal = neuerOrdner()
  const l = einspielLauf('netflix', lokal, ohne, false)
  pruefe(l.sql.length === 25 && l.gelesen === 0, `ohne Tor (lokal): läuft (${l.sql.length} Anweisungen)`)
  rmSync(lokal, { recursive: true })
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('alles ok')
