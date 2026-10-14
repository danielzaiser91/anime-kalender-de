/**
 * **Ein Lauf des Einspielens** (aus `tools/titelzeile-einspielen.ts` herausgelöst, 14.10.2026): exportieren, die Titelzeilen
 * lesen, bauen. Die Abfrage kommt als Parameter: das Werkzeug fragt über wrangler, die Tests (`spieleEin`) eine
 * SQLite-Datenbank — beide gehen so denselben Ablauf. Ablauf und Messung: docs/wissen/betrieb.md, Abschnitt
 * „Titelzeile einspielen: Export, lokal bauen, einfügen“.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { einspielAnweisungen, exportSql, SEITE, type PruefZeile, type RohZeile, type Tabelle, type Vorhanden } from './titelzeile-einspielen-bau.ts'

export type Antwort = { results: Record<string, unknown>[]; meta?: { rows_read?: number } }
export type Abfrage = (sql: string) => Antwort

/** Die schon exportierten Seiten einer Tabelle (Dateien `<tabelle>-<ab>.json`). */
function geladen<Z>(ordner: string, tabelle: Tabelle): Z[] {
  const dateien = readdirSync(ordner).filter((d) => new RegExp(`^${tabelle}-\\d+\\.json$`).test(d))
  return dateien.flatMap((d) => JSON.parse(readFileSync(`${ordner}/${d}`, 'utf8')) as Z[])
}

/**
 * Höchstens so viele gelesene Zeilen darf der Export eines Anbieters laut Hochrechnung kosten (14.10.2026: Dreifaches der
 * Schätzung, Tagesbudget fürs Einspielen 1,0 Mio.; betrieb.md). Darüber bricht der Lauf nach den Probeseiten ab.
 */
export const SCHWELLE = 250_000

/** Stand des Exports einer Tabelle: nächste Seite ab `ab`, `fertig` nach der letzten Seite. */
type Export = { tabelle: 'pruefung' | 'prime_folge'; ab: number; hoechste: number; gelesen: number; neu: number; fertig: boolean }

/**
 * Id-Bereich der Probeseite: Sie liest höchstens so viele Zeilen. 25.000 je Tabelle = 50.000 für beide, 5 % des
 * Tagesbudgets von 1,0 Mio. (14.10.2026); ohne Deckel läse die Probe von `prime_folge` bei einem kleinen Anbieter fast
 * die ganze Tabelle (Zeilen anderer Anbieter dazwischen), bevor sie etwas hochrechnen kann.
 */
export const PROBE_BEREICH = 25_000

/**
 * Eine Exportseite ab `ab` holen und als `<tabelle>-<ab>.json` ablegen. Mit `bis` (Probeseite) ist eine nicht volle Seite
 * erst dann die letzte, wenn der Deckel die höchste `id` erreicht; sonst hat sie den Bereich bis `bis` abgesucht.
 */
function seite(ordner: string, e: Export, plattform: string, abfrage: Abfrage, bis?: number): Export {
  const a = abfrage(exportSql(e.tabelle, plattform, e.ab, bis))
  if (a.results.length) writeFileSync(`${ordner}/${e.tabelle}-${e.ab}.json`, JSON.stringify(a.results))
  const voll = a.results.length === SEITE
  const fertig = !voll && (bis === undefined || bis >= e.hoechste)
  const ab = fertig ? e.ab : voll ? Number(a.results.at(-1)!.id) : bis!
  return { ...e, ab, gelesen: e.gelesen + (a.meta?.rows_read ?? 0), neu: e.neu + a.results.length, fertig }
}

/**
 * Probeseite: die höchste `id` und die erste Seite ab der letzten Nummer. Der Faktor setzt die gelesenen Zeilen der Seite
 * ins Verhältnis zu ihrem Id-Bereich (bis zur letzten Zeile, bei einer nicht vollen Seite bis zum Deckel bzw. zur höchsten
 * `id`, denn bis dorthin hat sie gesucht); die Hochrechnung legt ihn auf den übrigen Bereich bis zur höchsten `id`.
 */
function probe(ordner: string, tabelle: Export['tabelle'], plattform: string, abfrage: Abfrage) {
  const marke = `${ordner}/${tabelle}-bis.json`
  const bisher = existsSync(marke) ? Number(JSON.parse(readFileSync(marke, 'utf8'))) : 0
  const start = Math.max(bisher, ...geladen<{ id: number }>(ordner, tabelle).map((z) => z.id))
  const max = abfrage(`SELECT IFNULL(MAX(id), 0) AS id FROM ${tabelle}`)
  const hoechste = Number(max.results[0]!.id)
  const anfang: Export = { tabelle, ab: start, hoechste, gelesen: max.meta?.rows_read ?? 0, neu: 0, fertig: false }
  const e = seite(ordner, anfang, plattform, abfrage, start + PROBE_BEREICH)
  const bereich = (e.fertig ? Math.max(hoechste, start) : e.ab) - start
  const faktor = bereich > 0 ? (e.gelesen - anfang.gelesen) / bereich : 0
  const hochrechnung = e.gelesen + (e.fertig ? 0 : faktor * Math.max(0, hoechste - e.ab))
  return { e, faktor, hochrechnung }
}

/**
 * Die übrigen Seiten bis zur letzten. Die höchste `id` der Tabelle vor dem Export merkt sich `<tabelle>-bis.json`: Der
 * nächste Lauf beginnt dort, auch wenn die letzte Zeile des Anbieters weit davor liegt (ohne Index auf `plattform` läse
 * er sonst alle Zeilen anderer Anbieter dahinter).
 */
function fortsetzen(ordner: string, e: Export, plattform: string, abfrage: Abfrage): Export {
  while (!e.fertig) e = seite(ordner, e, plattform, abfrage)
  writeFileSync(`${ordner}/${e.tabelle}-bis.json`, JSON.stringify(Math.max(e.ab, e.hoechste)))
  return e
}

/** An der echten D1 ohne `rows_read` gibt es keine Hochrechnung: dann lieber abbrechen als blind exportieren. */
const gezaehlt = (abfrage: Abfrage, tor: boolean): Abfrage => (sql) => {
  const a = abfrage(sql)
  if (tor && typeof a.meta?.rows_read !== 'number') throw new Error(`keine gelesenen Zeilen (meta.rows_read) gemeldet: ${sql.slice(0, 60)}`)
  return a
}

type Probe = ReturnType<typeof probe>

const faktorText = (proben: Probe[]) => proben.map((x) => `${x.e.tabelle} ${x.faktor.toFixed(2)}`).join(', ')

/** Bricht ab, sobald die Hochrechnung der bisherigen Proben die Schwelle erreicht (nach jeder Probe, vor der nächsten). */
function pruefeSchwelle(proben: Probe[]) {
  const hochrechnung = proben.reduce((summe, x) => summe + x.hochrechnung, 0)
  if (hochrechnung < SCHWELLE) return hochrechnung
  throw new Error(`Hochrechnung ${Math.round(hochrechnung)} gelesene Zeilen (Faktor ${faktorText(proben)}) erreicht die Schwelle ${SCHWELLE}: abgebrochen nach den Probeseiten`)
}

/**
 * Exportiert, was seit dem letzten Lauf im Ordner dazukam, liest die Titelzeilen des Anbieters neu und baut die
 * Anweisungen (leer = nichts mehr zu tun). Erst je Tabelle eine Probeseite; liegt die Hochrechnung des Exports bei
 * `SCHWELLE` oder darüber (schon nach der ersten Probe), bricht der Lauf vor allen weiteren Seiten ab. `tor`: `rows_read` ist Pflicht (echte D1; lokal
 * meldet wrangler es nicht, die Hochrechnung ist dann 0). `lauf` zählt die Läufe im Ordner, `gelesen` summiert `rows_read`.
 */
export function einspielLauf(plattform: string, ordner: string, abfrage: Abfrage, tor: boolean) {
  if (!existsSync(ordner)) mkdirSync(ordner, { recursive: true })
  const lauf = readdirSync(ordner).filter((d) => /^titel_zeile-\d+\.json$/.test(d)).length + 1
  const frage = gezaehlt(abfrage, tor)
  const proben = [probe(ordner, 'pruefung', plattform, frage)]
  pruefeSchwelle(proben)
  proben.push(probe(ordner, 'prime_folge', plattform, frage))
  const hochrechnung = pruefeSchwelle(proben)
  const faktor = faktorText(proben)
  const [p, r] = proben.map((x) => fortsetzen(ordner, x.e, plattform, frage))
  const t = frage(exportSql('titel_zeile', plattform))
  writeFileSync(`${ordner}/titel_zeile-${lauf}.json`, JSON.stringify(t.results))
  const sql = einspielAnweisungen(plattform, geladen<PruefZeile>(ordner, 'pruefung'), geladen<RohZeile>(ordner, 'prime_folge'), t.results as Vorhanden[])
  const gelesen = p!.gelesen + r!.gelesen + (t.meta?.rows_read ?? 0)
  const probelauf = { faktor, hochrechnung: Math.round(hochrechnung) }
  return { lauf, sql, neu: { pruefung: p!.neu, prime_folge: r!.neu }, titelzeilen: t.results.length, gelesen, probelauf }
}
