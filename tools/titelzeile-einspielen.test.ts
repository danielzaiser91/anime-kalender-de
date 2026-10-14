/**
 * **Einspielen der Titelzeilen über Export und lokalen Bau** (14.10.2026, `tools/titelzeile-einspielen-bau.ts`): die Regeln,
 * die es nur beim Umzug gibt, gegen eine echte SQLite-Datenbank mit den Migrationen des Workers.
 * - Nachzügler (Altzeilen nach dem Export): eine neuere Meldung derselben Folge ersetzt sie mit neuer Fassung, eine neue
 *   Folge kommt dazu; der Lauf danach hat nichts mehr zu tun.
 * - Was der Worker seither jünger eingetragen hat, bleibt stehen (Folge und Kopf).
 * - Ein Titel über der Grenze einer D1-Anweisung kommt in Teilen und ergibt dieselbe Zeile wie ungeteilt, auch beim Nachtrag.
 * - Legt der Worker die Titelzeile zwischen Lesen und Einfügen an, fügt das INSERT nichts ein und der nächste Lauf führt
 *   zusammen.
 *
 * Aufruf: `npx tsx tools/titelzeile-einspielen.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { AM, FASSUNG, lies, MELDUNG_UEBERNOMMEN, NUMMER, ROHFOLGE_UEBERNOMMEN, type Eintrag, type TitelDaten } from '../worker/src/titelzeile-format.ts'
import { baueTitelzeilen, einspielAnweisungen, eintragAusAltzeilen, exportSql, GRENZE, type PruefZeile, type RohZeile, type Vorhanden } from './titelzeile-einspielen-bau.ts'
import { neueDatenbank, post, umgebung } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const U = 'https://www.netflix.com/title/81000009'
const tag = (t: number) => `2026-10-${String(t).padStart(2, '0')}T00:00:00Z`

/** Eine Altzeile aus `pruefung` (Netflix, Durchlauf mit Rohfolge). */
const meldung = (id: number, folge: number, am: string, mehr: Partial<PruefZeile> = {}): PruefZeile => ({
  id,
  url: U,
  staffel: 1,
  folge_nr: folge,
  folge: `8100${folge}`,
  r_gti: `8100${folge}`,
  r_titel: `Folge ${folge}`,
  sprachen: '["de|Deutsch"]',
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  befund: 'dub',
  titel_id: 501,
  uebernommen: 0,
  roh_uebernommen: 0,
  notiz: null,
  folgen: null,
  gemeldet_am: am,
  staffeln: null,
  titel: 'Netflix-Serie',
  serientitel: null,
  ...mehr,
})

/** Ein Lauf wie `tools/titelzeile-einspielen.ts`: Titelzeilen lesen, bauen, Anweisungen ausführen. */
function lauf(db: ReturnType<typeof neueDatenbank>, pruefung: PruefZeile[]) {
  const vorhanden = db.prepare(exportSql('titel_zeile', 'netflix')).all() as Vorhanden[]
  const sql = einspielAnweisungen('netflix', pruefung, [], vorhanden)
  for (const a of sql) db.exec(a)
  return sql
}
/** Eine Hand-Meldung an den Worker (Netflix, Folge `nr`), wie `extension/melder.js` sie schickt. */
const workerMeldung = (nr: number) => ({
  plattform: 'netflix',
  url: U,
  titel: 'Netflix-Serie',
  titelId: 501,
  sprachen: ['de|Deutsch'],
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  staffel: 1,
  folge_nr: nr,
  folgen: 10,
})
const zeile = (db: ReturnType<typeof neueDatenbank>) => db.prepare('SELECT version, daten, gemeldet_am FROM titel_zeile WHERE url = ?').get(U) as Vorhanden
const folge = (d: TitelDaten, nr: number) => d.f.find((e) => e[NUMMER] === nr)

console.log('Nachzügler')
{
  const db = neueDatenbank()
  const export1 = [meldung(1, 1, tag(1)), meldung(2, 2, tag(1))]
  lauf(db, export1)
  const nachzuegler = [meldung(3, 1, tag(2), { ton_de: 'nein', befund: 'kein_dub' }), meldung(4, 3, tag(2))]
  const zweiter = lauf(db, [...export1, ...nachzuegler])
  const z = zeile(db)
  const d = lies(z.daten)
  pruefe(zweiter.length === 1 && zweiter[0]!.startsWith('UPDATE'), `ein UPDATE (${zweiter.length})`)
  pruefe(folge(d, 1)?.[6] === 'nein' && folge(d, 1)?.[FASSUNG] === 1, 'neuere Meldung derselben Folge ersetzt sie mit neuer Fassung')
  pruefe(folge(d, 2)?.[FASSUNG] === 0 && folge(d, 3) !== undefined, 'unveränderte Folge bleibt, neue Folge kommt dazu')
  pruefe(z.version === 2 && z.gemeldet_am === tag(2), `Version 2, gemeldet_am ${z.gemeldet_am}`)
  pruefe(lauf(db, [...export1, ...nachzuegler]).length === 0, 'der Lauf danach hat nichts mehr zu tun')
  const gleich = [meldung(5, 2, tag(3))]
  pruefe(lauf(db, [...export1, ...nachzuegler, ...gleich]).length === 0, 'jüngere Meldung mit gleichem Inhalt schreibt nichts')
}

console.log('Worker jünger')
{
  const db = neueDatenbank()
  const export1 = [meldung(1, 1, tag(1))]
  lauf(db, export1)
  /* Der Worker trägt am 5. Folge 1 neu ein und setzt den Titel. */
  const d = lies(zeile(db).daten)
  folge(d, 1)![AM] = tag(5)
  folge(d, 1)![6] = 'unbekannt'
  d.t = 'Vom Worker'
  db.prepare('UPDATE titel_zeile SET daten = ?, version = 2, gemeldet_am = ? WHERE url = ?').run(JSON.stringify(d), tag(5), U)
  const alt = [meldung(2, 1, tag(2), { ton_de: 'nein', titel: 'Aus Altzeile' })]
  pruefe(lauf(db, [...export1, ...alt]).length === 0, 'ältere Altzeile ändert nichts')
  const neueFolge = [meldung(3, 4, tag(6), { titel: null })]
  lauf(db, [...export1, ...alt, ...neueFolge])
  const nachher = lies(zeile(db).daten)
  pruefe(folge(nachher, 1)?.[6] === 'unbekannt' && folge(nachher, 4) !== undefined, 'Folge des Workers bleibt, jüngere Folge kommt dazu')
  pruefe(nachher.t === 'Vom Worker', `Kopf nur, wenn jünger als die Titelzeile (t = ${nachher.t})`)
}

console.log('Teilung großer Titel')
{
  const notiz = 'x'.repeat(500)
  const viele = Array.from({ length: 300 }, (_, i) => meldung(i + 1, i + 1, tag(1), { notiz }))
  const db = neueDatenbank()
  const sql = lauf(db, viele)
  const erwartet = JSON.stringify(baueTitelzeilen(viele, []).get(U)!.daten)
  pruefe(sql.length > 1 && sql.every((s) => Buffer.byteLength(s) <= GRENZE), `${sql.length} Anweisungen, jede höchstens ${GRENZE} Byte`)
  pruefe(JSON.stringify(lies(zeile(db).daten)) === erwartet, 'geteilt eingefügt = ungeteilt gebaut')
  const mehr = Array.from({ length: 300 }, (_, i) => meldung(1000 + i, 1000 + i, tag(2), { notiz }))
  const nachtrag = lauf(db, [...viele, ...mehr])
  const d = lies(zeile(db).daten)
  pruefe(nachtrag.length > 1 && nachtrag.every((s) => Buffer.byteLength(s) <= GRENZE), `Nachtrag in ${nachtrag.length} Anweisungen`)
  pruefe(d.f.length === 600 && zeile(db).version === 2, `Nachtrag vollständig (${d.f.length} Folgen)`)
}

console.log('Zusammenstoß beim Einfügen')
{
  const db = neueDatenbank()
  const export1 = [meldung(1, 1, tag(1))]
  const sql = einspielAnweisungen('netflix', export1, [], [])
  /* Zwischen Lesen und Einfügen legt der Worker die Titelzeile mit Folge 7 an. */
  const worker = lies('{"f":[]}')
  worker.f.push([1, 7, null, null, null, 'ja', 'ja', 'gemessen', null, tag(3), 0, 1, null, 0])
  db.prepare("INSERT INTO titel_zeile (url, plattform, nr, version, daten, gemeldet_am) VALUES (?, 'netflix', 1, 1, ?, ?)").run(U, JSON.stringify(worker), tag(3))
  for (const a of sql) db.exec(a)
  pruefe(lies(zeile(db).daten).f.length === 1, 'INSERT fügt nichts ein')
  lauf(db, export1)
  const d = lies(zeile(db).daten)
  pruefe(folge(d, 7) !== undefined && folge(d, 1) !== undefined, 'nächster Lauf führt zusammen')
}

console.log('Worker schreibt zwischen Lesen und UPDATE')
{
  const db = neueDatenbank()
  const export1 = [meldung(1, 1, tag(1))]
  lauf(db, export1)
  const mitNachzuegler = [...export1, meldung(2, 2, tag(2))]
  const sql = einspielAnweisungen('netflix', mitNachzuegler, [], db.prepare(exportSql('titel_zeile', 'netflix')).all() as Vorhanden[])
  const env = umgebung(db, { geschrieben: 0 }, 'disneyplus,netflix')
  const r = await handlePruefung(post(workerMeldung(7)), env)
  pruefe(r.status === 200 && zeile(db).version === 2, `der Worker schreibt Folge 7 in die Titelzeile (Status ${r.status}, Version ${zeile(db).version})`)
  for (const a of sql) db.exec(a)
  const d = lies(zeile(db).daten)
  pruefe(folge(d, 7) !== undefined && folge(d, 2) === undefined, 'UPDATE gegen die gelesene Version ändert nichts, die Folge des Workers bleibt')
  lauf(db, mitNachzuegler)
  const danach = lies(zeile(db).daten)
  pruefe(folge(danach, 7) !== undefined && folge(danach, 2) !== undefined, 'der nächste Lauf liest neu und führt zusammen')
}

console.log('Anhang nur an die eben geschriebene Fassung')
for (const [fall, stoerung] of [
  ['andere Version', 'UPDATE titel_zeile SET version = version + 1'],
  ['anderer Zeitstempel', `UPDATE titel_zeile SET gemeldet_am = '${tag(9)}'`],
  ['andere Folgenzahl', "UPDATE titel_zeile SET daten = json_remove(daten, '$.f[#-1]')"],
] as const) {
  const viele = Array.from({ length: 300 }, (_, i) => meldung(i + 1, i + 1, tag(1), { notiz: 'x'.repeat(500) }))
  const sql = einspielAnweisungen('netflix', viele, [], [])
  const db = neueDatenbank()
  db.exec(sql[0]!)
  db.exec(stoerung)
  const vorher = lies(zeile(db).daten).f.length
  for (const a of sql.slice(1)) db.exec(a)
  pruefe(sql.length > 1 && lies(zeile(db).daten).f.length === vorher, `${fall}: Anhang hängt nichts an (${vorher} Folgen)`)
}

console.log('Kopf und Gleichstand')
{
  const kopf = baueTitelzeilen([meldung(1, 1, tag(2), { titel: 'Neu' }), meldung(2, 2, tag(1), { titel: 'Alt' }), meldung(3, 3, tag(3), { titel: null })], []).get(U)!
  pruefe(kopf.daten.t === 'Neu' && kopf.kopfAm.t === tag(2), `Kopf: jüngster nicht leerer Wert (${kopf.daten.t}, ${kopf.kopfAm.t})`)
  const gleich = baueTitelzeilen([meldung(5, 1, tag(1), { ton_de: 'nein', befund: 'kein_dub' }), meldung(4, 1, tag(1))], []).get(U)!
  pruefe(folge(gleich.daten, 1)?.[6] === 'nein', 'gleicher Zeitpunkt: die höhere id gewinnt')
}

console.log('Abhak-Marken')
{
  const roh = (uebernommen: number): RohZeile => ({ id: 9, url: U, staffel_nr: 1, nummer: 1, gti: '81001', titel: 'Folge 1', sprachen: null, vorhanden: 'ja', ton_de: 'ja', uebernommen, angenommen: null, gemeldet_am: tag(1) })
  const marken = (e: Eintrag) => `${e[MELDUNG_UEBERNOMMEN]}/${e[ROHFOLGE_UEBERNOMMEN]}`
  const ohne = meldung(1, 1, tag(1), { roh_uebernommen: null })
  pruefe(marken(eintragAusAltzeilen(ohne, undefined)) === '0/1', 'ohne Marke und ohne prime_folge: Rohfolge gilt als übernommen')
  pruefe(marken(eintragAusAltzeilen(ohne, roh(0))) === '0/0', 'ohne Marke: die Marke aus prime_folge zählt')
  pruefe(marken(eintragAusAltzeilen(meldung(1, 1, tag(1), { uebernommen: 1 }), roh(1))) === '1/0', 'Marke der Meldung vor prime_folge, Meldung abgehakt')
}

console.log('Nachzügler ändert nur den Kopf')
{
  const db = neueDatenbank()
  const export1 = [meldung(1, 1, tag(1))]
  lauf(db, export1)
  const sql = lauf(db, [...export1, meldung(2, 1, tag(2), { titel: 'Neuer Titel' })])
  pruefe(sql.length === 1 && lies(zeile(db).daten).t === 'Neuer Titel', `jüngerer Titel bei gleicher Folge wird geschrieben (${sql.length})`)
}

console.log('Gleicher Zeitpunkt wie die Titelzeile')
{
  const db = neueDatenbank()
  const export1 = [meldung(1, 1, tag(1))]
  lauf(db, export1)
  const d = lies(zeile(db).daten)
  folge(d, 1)![AM] = tag(5)
  folge(d, 1)![6] = 'unbekannt'
  d.t = 'Vom Worker'
  db.prepare('UPDATE titel_zeile SET daten = ?, version = 2, gemeldet_am = ? WHERE url = ?').run(JSON.stringify(d), tag(5), U)
  const gleichAlt = [meldung(2, 1, tag(5), { ton_de: 'nein', titel: 'Aus Altzeile' })]
  pruefe(lauf(db, [...export1, ...gleichAlt]).length === 0, 'Folge mit gleichem Zeitpunkt: die Titelzeile bleibt')
  lauf(db, [...export1, ...gleichAlt, meldung(3, 4, tag(5), { titel: 'Aus Altzeile' })])
  const nachher = lies(zeile(db).daten)
  pruefe(folge(nachher, 4) !== undefined && nachher.t === 'Vom Worker', `neue Folge kommt dazu, Kopf vom gleichen Zeitpunkt nicht (t = ${nachher.t})`)
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('alles ok')
