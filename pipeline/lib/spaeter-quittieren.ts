/**
 * **Der Briefkasten vergisst erst, was im Repo steht** (17.10.2026).
 *
 * Ein Schritt im Bestandsbau merkt sich hier die Kennungen, die der Worker abhaken oder löschen soll (`OFFEN`).
 * Nur `tools/commit-data.sh` verschiebt sie nach einem gelungenen Commit nach `FREI`, und quittiert wird nur aus
 * `FREI`. Ob ein Quittungsschritt vor dem Commit steht oder wie er aufgerufen wird, ist damit gleich: Vorher liegt
 * dort nichts. Scheitert der Bau dazwischen, bleibt die Datei in `OFFEN` und die Zeilen kommen beim nächsten Lauf wieder.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { log, ROOT, warn } from './util.ts'

export const OFFEN = 'data/cache/quittung-offen'
export const FREI = 'data/cache/quittung-frei'
export const ROHFOLGEN_ABHAKEN = 'rohfolgen-abhaken.json'
export const VORFAELLE_LOESCHEN = 'vorfaelle-loeschen.json'
export const PRUEFUNGEN_ABHAKEN = 'pruefungen-abhaken.json'

/** Legt die Kennungen für den Schritt nach dem Commit ab; eine leere Liste räumt eine alte Datei weg. */
export function merkeZumQuittieren(datei: string, ids: number[]): void {
  const pfad = resolve(ROOT, OFFEN, datei)
  if (!ids.length) {
    rmSync(pfad, { force: true })
    return
  }
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, JSON.stringify(ids))
}

/**
 * Schickt die freigegebenen Kennungen ab (`{ [feld]: ids }`) und löscht die Datei nur bei Erfolg.
 * Liefert die Zahl der quittierten Kennungen, 0 ohne Datei, null bei einem Fehlschlag.
 */
export async function quittiereGemerkte(a: {
  datei: string
  url: string
  methode: 'POST' | 'DELETE'
  feld: string
  token: string
}): Promise<number | null> {
  const pfad = resolve(ROOT, FREI, a.datei)
  if (!existsSync(pfad)) {
    log(existsSync(resolve(ROOT, OFFEN, a.datei)) ? 'Nichts freigegeben: der Commit steht noch aus.' : 'Nichts zu quittieren.')
    return 0
  }
  const ids = JSON.parse(readFileSync(pfad, 'utf8')) as number[]
  try {
    const res = await fetch(a.url, {
      method: a.methode,
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': a.token },
      body: JSON.stringify({ [a.feld]: ids }),
    })
    if (!res.ok) {
      warn(`Nicht quittiert: HTTP ${res.status} — die Zeilen kommen beim nächsten Lauf erneut`)
      return null
    }
  } catch (e) {
    warn(`Nicht quittiert: ${(e as Error).message}`)
    return null
  }
  rmSync(pfad)
  log(`${ids.length} Kennungen quittiert`)
  return ids.length
}
