/**
 * Baut die SQLite-Kopie der Meldungsdaten (Auswertungen und Einmal-SQL laufen daran, nie an der echten D1).
 * Quelle ist `wrangler d1 export --table …` plus die Index- und Sichtdefinitionen aus `sqlite_master`
 * (der Export mit `--table` liefert nur Tabellen, ohne Indexe wäre jeder Plan ein anderer als live).
 * Nur diese drei Tabellen; Newsletter-Adressen, Zugänge und Push-Abos gehören nie in die Kopie.
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, unlinkSync } from 'node:fs'

export const TABELLEN = ['pruefung', 'prime_folge', 'titel_zeile']
/** Die Sicht über `titel_zeile` (Migration 055); ihr `tbl_name` in `sqlite_master` ist ihr eigener Name. */
const SICHTEN = ['pruefung_titel']

export const SCHEMA_ABFRAGE =
  "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('index','view') AND tbl_name IN (" +
  [...TABELLEN, ...SICHTEN].map((t) => `'${t}'`).join(',') +
  ')'

/** Argumente für `wrangler d1 export`: nur die Meldungstabellen, fest verdrahtet. */
export function exportArgumente(datenbank, ausgabe, config) {
  return ['d1', 'export', datenbank, '--remote', '--config', config, ...TABELLEN.flatMap((t) => ['--table', t]), '--output', ausgabe, '--skip-confirmation']
}

/** Argumente für die Schemaabfrage (liest `sqlite_master`, einige Dutzend Zeilen). */
export function schemaArgumente(datenbank, config) {
  return ['d1', 'execute', datenbank, '--remote', '--config', config, '--json', '--command', SCHEMA_ABFRAGE]
}

/** Die `sql`-Spalten aus der JSON-Ausgabe von `wrangler d1 execute --json` (Banner davor werden übersprungen). */
export function schemaAusJson(text) {
  const start = text.search(/^\[\s*$/m)
  if (start < 0) throw new Error('Schemaabfrage: keine JSON-Liste in der Ausgabe')
  const ergebnis = JSON.parse(text.slice(start))
  const zeilen = ergebnis.flatMap((e) => e.results ?? [])
  if (!zeilen.length) throw new Error('Schemaabfrage lieferte keine Indexe oder Sichten')
  return zeilen.map((z) => z.sql)
}

/** Wirft, wenn der Export etwas anderes als die erlaubten Tabellen enthält oder eine davon fehlt. */
function pruefeTabellen(db) {
  const da = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((z) => z.name)
  const fremd = da.filter((t) => !TABELLEN.includes(t))
  if (fremd.length) throw new Error(`Export enthält Tabellen außerhalb der Meldungsdaten: ${fremd.join(', ')}`)
  const fehlt = TABELLEN.filter((t) => !da.includes(t))
  if (fehlt.length) throw new Error(`Export enthält nicht: ${fehlt.join(', ')}`)
}

/** Legt `ziel` an: Export einspielen, Tabellenliste prüfen, Indexe und Sicht anlegen, Stand eintragen. Liefert die Zeilen je Tabelle. */
export function baueKopie({ exportSql, schemaSql, stand, ziel }) {
  if (existsSync(ziel)) unlinkSync(ziel)
  const db = new DatabaseSync(ziel)
  try {
    // Eine Transaktion statt 73.000 einzelner Festschreibungen (sonst Minuten statt Sekunden).
    db.exec('BEGIN')
    db.exec(exportSql)
    db.exec('COMMIT')
    pruefeTabellen(db)
    for (const s of schemaSql) db.exec(s)
    db.exec('CREATE TABLE kopie_stand (stand TEXT NOT NULL)')
    db.prepare('INSERT INTO kopie_stand (stand) VALUES (?)').run(stand)
    return Object.fromEntries(TABELLEN.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]))
  } finally {
    db.close()
  }
}
