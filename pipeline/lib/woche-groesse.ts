import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const KB = 1024

/**
 * Grenze für `woche.json` (gzip, 23.10.2026): Die Datei zählt voll zum Start-Budget (`tools/start-budget.mjs`, Grenze 300 KB, Ist 293,8 KB bei 33,7 KB Woche)
 * und schwankt mit dem Inhalt der Woche (+1,4 KB in einem Bau). Mit 38 KB bleibt der Bestandsbau rot, bevor ein Deploy am Budget scheitert.
 */
export const WOCHE_GRENZE = 38 * KB

/** `{ code, text }` zur Größe einer Wochen-Datei; fehlende oder unlesbare Datei ist ein Fehler, kein Freibrief. */
export function bewerteWocheGroesse(pfad: string, grenze: number = WOCHE_GRENZE): { code: number; text: string } {
  let bytes: number
  try {
    bytes = gzipSync(readFileSync(pfad), { level: 9 }).length
  } catch {
    return { code: 1, text: `woche.json nicht lesbar: ${pfad}` }
  }
  const kb = (b: number) => (b / KB).toFixed(1)
  if (bytes > grenze) return { code: 1, text: `woche.json ${kb(bytes)} KB gzip, ${kb(bytes - grenze)} KB über der Grenze von ${kb(grenze)} KB (Start-Budget)` }
  return { code: 0, text: `woche.json ${kb(bytes)} KB gzip von ${kb(grenze)} KB, ${kb(grenze - bytes)} KB Luft` }
}
