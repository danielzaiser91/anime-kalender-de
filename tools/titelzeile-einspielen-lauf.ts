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
 * Exportiert ab der letzten Nummer Seite für Seite; gibt die neuen Zeilen und die gelesenen D1-Zeilen zurück. Die
 * höchste `id` der Tabelle vor dem Export merkt sich `<tabelle>-bis.json`: Der nächste Lauf beginnt dort, auch wenn die
 * letzte Zeile des Anbieters weit davor liegt (ohne Index auf `plattform` läse er sonst alle Zeilen anderer Anbieter dahinter).
 */
function exportiere(ordner: string, tabelle: 'pruefung' | 'prime_folge', plattform: string, abfrage: Abfrage) {
  const marke = `${ordner}/${tabelle}-bis.json`
  const bisher = existsSync(marke) ? Number(JSON.parse(readFileSync(marke, 'utf8'))) : 0
  let ab = Math.max(bisher, ...geladen<{ id: number }>(ordner, tabelle).map((z) => z.id))
  const hoechste = abfrage(`SELECT IFNULL(MAX(id), 0) AS id FROM ${tabelle}`)
  let gelesen = hoechste.meta?.rows_read ?? 0
  let neu = 0
  for (;;) {
    const a = abfrage(exportSql(tabelle, plattform, ab))
    gelesen += a.meta?.rows_read ?? 0
    if (a.results.length) writeFileSync(`${ordner}/${tabelle}-${ab}.json`, JSON.stringify(a.results))
    neu += a.results.length
    if (a.results.length < SEITE) break
    ab = Number(a.results.at(-1)!.id)
  }
  writeFileSync(marke, JSON.stringify(Math.max(ab, Number(hoechste.results[0]!.id))))
  return { neu, gelesen }
}

/**
 * Exportiert, was seit dem letzten Lauf im Ordner dazukam, liest die Titelzeilen des Anbieters neu und baut die
 * Anweisungen (leer = nichts mehr zu tun). `lauf` zählt die Läufe im Ordner, `gelesen` summiert `meta.rows_read`.
 */
export function einspielLauf(plattform: string, ordner: string, abfrage: Abfrage) {
  if (!existsSync(ordner)) mkdirSync(ordner, { recursive: true })
  const lauf = readdirSync(ordner).filter((d) => /^titel_zeile-\d+\.json$/.test(d)).length + 1
  const p = exportiere(ordner, 'pruefung', plattform, abfrage)
  const r = exportiere(ordner, 'prime_folge', plattform, abfrage)
  const t = abfrage(exportSql('titel_zeile', plattform))
  writeFileSync(`${ordner}/titel_zeile-${lauf}.json`, JSON.stringify(t.results))
  const sql = einspielAnweisungen(plattform, geladen<PruefZeile>(ordner, 'pruefung'), geladen<RohZeile>(ordner, 'prime_folge'), t.results as Vorhanden[])
  const gelesen = p.gelesen + r.gelesen + (t.meta?.rows_read ?? 0)
  return { lauf, sql, neu: { pruefung: p.neu, prime_folge: r.neu }, titelzeilen: t.results.length, gelesen }
}
