import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

export const SPRECHER_ARCHIV_DIR = 'data/anisearch-sprecher-raw'

/** Alle Zeilen der Besetzungstabelle, roh — mehr liest `sprecherAus()` nicht, und Kopf, Fuß und Skripte der Seite sind nicht aufhebenswert. */
export function zeilenAus(html: string): string {
  const von = html.indexOf('<tr>')
  const bis = html.lastIndexOf('</tr>')
  return von < 0 || bis < von ? '' : html.slice(von, bis + 5)
}

/**
 * Legt die Besetzungszeilen gzip-komprimiert ab, eine Datei je Seite (wie `data/anisearch-raw`): Ein Feldwunsch später braucht dann keinen zweiten Lauf.
 * Eine unveränderte Datei bleibt unangetastet, sonst wanderte jede Auffrischung als neuer Blob in die Historie. Gibt zurück, ob etwas abgelegt wurde.
 */
export function legeArchivAb(id: number, html: string, dir = SPRECHER_ARCHIV_DIR): boolean {
  const zeilen = zeilenAus(html)
  if (!zeilen) return false
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const pfad = `${dir}/${id}.html.gz`
  const neu = gzipSync(zeilen, { level: 9 })
  if (!existsSync(pfad) || !readFileSync(pfad).equals(neu)) writeFileSync(pfad, neu)
  return true
}
