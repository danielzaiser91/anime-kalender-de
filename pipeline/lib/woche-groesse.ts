import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const KB = 1024

/**
 * Grenze für `woche-kacheln.json` (gzip, 25.10.2026): Die Datei zählt voll zum Start-Budget (`tools/start-budget.mjs`) und schwankt mit dem Inhalt
 * der Woche (+1,4 KB in einem Bau, 23.10.2026; +3 KB durch Toggo-Fensterblöcke, 07.11.2026). Stand 07.11.2026: 21,1 KB im Bestand, nach der
 * Kachel-Form der Toggo-Fenster (`shared/toggo-fenster.ts`) deutlich darunter; mit 22 KB bleibt der Bestandsbau rot, bevor ein Deploy am Budget scheitert.
 */
export const WOCHE_GRENZE = 22 * KB

/** Ab hier warnt der Bestandsbau (`⚠ WARNUNG`, Exit 0), damit Wachstum auffällt, bevor die Grenze den Bau rot macht (07.11.2026). */
export const WOCHE_WARNUNG = 20 * KB

/** `{ code, text }` zur Größe einer Wochen-Datei; fehlende oder unlesbare Datei ist ein Fehler, kein Freibrief. */
export function bewerteWocheGroesse(pfad: string, grenze: number = WOCHE_GRENZE, warnung: number = WOCHE_WARNUNG): { code: number; text: string } {
  let bytes: number
  try {
    bytes = gzipSync(readFileSync(pfad), { level: 9 }).length
  } catch {
    return { code: 1, text: `woche-kacheln.json nicht lesbar: ${pfad}` }
  }
  const kb = (b: number) => (b / KB).toFixed(1)
  if (bytes > grenze) return { code: 1, text: `woche-kacheln.json ${kb(bytes)} KB gzip, ${kb(bytes - grenze)} KB über der Grenze von ${kb(grenze)} KB (Start-Budget)` }
  if (bytes > warnung) return { code: 0, text: `⚠ WARNUNG woche-kacheln.json ${kb(bytes)} KB gzip, nur ${kb(grenze - bytes)} KB Luft zur Grenze von ${kb(grenze)} KB (Warnung ab ${kb(warnung)} KB)` }
  return { code: 0, text: `woche-kacheln.json ${kb(bytes)} KB gzip von ${kb(grenze)} KB, ${kb(grenze - bytes)} KB Luft` }
}
