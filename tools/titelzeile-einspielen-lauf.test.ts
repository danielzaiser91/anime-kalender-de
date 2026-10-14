/**
 * **Ein Lauf des Einspielens** (`tools/titelzeile-einspielen-lauf.ts`, 14.10.2026) gegen eine SQLite-Datenbank mit mehr als
 * einer Exportseite und Zeilen anderer Anbieter dazwischen und dahinter:
 * - Export Seite für Seite, Marke `<tabelle>-bis.json` = höchste `id` der Tabelle; der nächste Lauf liest nur dahinter,
 *   der dritte hat nichts mehr zu tun;
 * - Probelauf: Faktor aus der ersten Seite, Hochrechnung = gelesene Zeilen des ganzen Exports; ab der Schwelle Abbruch
 *   nach den Probeseiten, die liegen bleiben und hinter denen der nächste Lauf fortsetzt;
 * - ohne `rows_read` bricht der Lauf mit Tor ab, ohne Tor (lokal) läuft er.
 *
 * Aufruf: `npx tsx tools/titelzeile-einspielen-lauf.test.ts`
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { einspielLauf, SCHWELLE, type Abfrage } from './titelzeile-einspielen-lauf.ts'
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
