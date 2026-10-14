/**
 * Holt die jüngste Meldungskopie, die der Lauf `meldungskopie.yml` als Artefakt abgelegt hat (GitHub, kein D1-Zugriff).
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { entschluessle, tokenOderAbbruch } from './meldungskopie-schluessel.mjs'

export const WORKFLOW = 'meldungskopie.yml'
export const ARTEFAKT = 'meldungskopie'
export const DATEINAME = 'meldungen.sqlite'
/** Im Artefakt liegt nur die verschlüsselte Fassung. */
export const ARTEFAKT_DATEI = DATEINAME + '.enc'

/** Der Stand der vorhandenen Kopie (leer, wenn es keine gibt). */
export function lokalerStand(datei) {
  if (!existsSync(datei)) return ''
  const db = new DatabaseSync(datei, { readOnly: true })
  try {
    return db.prepare('SELECT stand FROM kopie_stand').get().stand
  } finally {
    db.close()
  }
}

/** `gh(args)` liefert den Text der Ausgabe; die Kopie wird nur geholt, wenn der jüngste erfolgreiche Lauf neuer ist als sie. */
export function holen({ gh, ziel, umgebung = process.env }) {
  const token = tokenOderAbbruch(umgebung)
  const lauf = JSON.parse(gh(['run', 'list', '--workflow', WORKFLOW, '--status', 'success', '--limit', '1', '--json', 'databaseId,createdAt']))[0]
  if (!lauf) throw new Error(`Noch kein erfolgreicher Lauf von ${WORKFLOW}: gh workflow run ${WORKFLOW}`)
  const vorhanden = lokalerStand(ziel)
  if (vorhanden && Date.parse(vorhanden) >= Date.parse(lauf.createdAt)) return { art: 'aktuell', stand: vorhanden }
  const ordner = mkdtempSync(join(tmpdir(), 'meldungskopie-holen-'))
  try {
    gh(['run', 'download', String(lauf.databaseId), '--name', ARTEFAKT, '--dir', ordner])
    mkdirSync(dirname(ziel), { recursive: true })
    writeFileSync(ziel, entschluessle(readFileSync(join(ordner, ARTEFAKT_DATEI)), token))
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
  return { art: 'geholt', stand: lokalerStand(ziel), lauf: lauf.databaseId }
}
