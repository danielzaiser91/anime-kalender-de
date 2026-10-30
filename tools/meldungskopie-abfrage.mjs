/**
 * Führt eine Abfrage oder ein Einmal-SQL an der SQLite-Kopie der Meldungsdaten aus (`meldungskopie-bauen.mjs`).
 * Gearbeitet wird immer an einer Wegwerf-Kopie der Datei, die Kopie selbst bleibt unverändert.
 * `node:sqlite` zählt keine gelesenen Zeilen; die Zahl für die echte D1 misst `d1-schutz/messe.mjs`, und lokale Zahlen sind nur eine Untergrenze.
 */
import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TABELLEN } from './meldungskopie-bauen.mjs'

/** Ab diesem Alter der Kopie (Stunden) warnt die Ausgabe; der Bau läuft täglich, 36 h ist ein verpasster Lauf. */
export const STAND_MAX_STUNDEN = 36

/** Der Text ohne Zeichenketten und Kommentare, damit ein `;` darin nicht als Anweisungsende zählt. */
const ohneLiterale = (sql) => sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"/g, ' ')

/** Eine einzige Anweisung? `prepare` liest sonst nur die erste und ignoriert den Rest still. */
export const istEinzeln = (sql) => !/;\s*\S/.test(ohneLiterale(sql))

export function alterStunden(stand, jetzt = new Date()) {
  return (jetzt.getTime() - Date.parse(stand)) / 3_600_000
}

const zeilenJeTabelle = (db) => Object.fromEntries(TABELLEN.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]))

/** Liest streamend (kein `all()`: bei Millionen Zeilen sprengt es den Speicher); behält die ersten `max`, zählt den Rest. */
function lies(stmt, max) {
  const zeilen = []
  let gesamt = 0
  for (const z of stmt.iterate()) {
    if (gesamt < max) zeilen.push(z)
    gesamt++
  }
  return { zeilen, gesamt }
}

/** Ergebnis einer Abfrage: `zeilen` (höchstens `max`) samt `gesamt` bei einer einzelnen SELECT-Anweisung, sonst `geaendert` und `differenz` je Tabelle. */
function laufe(db, sql, max) {
  // Nur Kommentar/Leerraum/`;`: `prepare` liefert eine schon abgeschlossene Anweisung ("statement has been finalized").
  if (ohneLiterale(sql).replace(/[\s;]/g, '') === '') throw new Error('Keine SQL-Anweisung (nur Kommentar oder leer)')
  const einzeln = istEinzeln(sql) ? db.prepare(sql) : null
  if (einzeln && einzeln.columns().length > 0) return { art: 'zeilen', ...lies(einzeln, max) }
  const vorher = zeilenJeTabelle(db)
  db.exec(sql)
  const nachher = zeilenJeTabelle(db)
  const differenz = Object.fromEntries(TABELLEN.map((t) => [t, nachher[t] - vorher[t]]))
  return { art: 'aenderung', geaendert: db.prepare('SELECT total_changes() AS n').get().n, differenz }
}

export function fuehreAus(kopie, sql, jetzt = new Date(), max = Infinity) {
  const ordner = mkdtempSync(join(tmpdir(), 'meldungskopie-'))
  const arbeit = join(ordner, 'arbeit.sqlite')
  copyFileSync(kopie, arbeit)
  const db = new DatabaseSync(arbeit)
  try {
    const stand = db.prepare('SELECT stand FROM kopie_stand').get().stand
    const t0 = performance.now()
    const ergebnis = laufe(db, sql, max)
    return { ...ergebnis, ms: Math.round(performance.now() - t0), stand, alterStunden: alterStunden(stand, jetzt) }
  } finally {
    db.close()
    rmSync(ordner, { recursive: true, force: true })
  }
}

/** Fußzeile mit Stand der Kopie; warnt, wenn sie älter als `STAND_MAX_STUNDEN` ist. */
export function fusszeile(e) {
  const alt = `Kopie vom ${e.stand} (vor ${e.alterStunden.toFixed(1)} h)`
  const warnung = e.alterStunden > STAND_MAX_STUNDEN ? ` — ÄLTER ALS ${STAND_MAX_STUNDEN} h: neue Kopie mit "holen" oder den Lauf meldungskopie.yml anstoßen` : ''
  const was = e.art === 'zeilen' ? `${e.gesamt} Zeilen` : `${e.geaendert} Zeilen geändert, Differenz ${JSON.stringify(e.differenz)}`
  return `${was} in ${e.ms} ms · ${alt}${warnung}`
}
