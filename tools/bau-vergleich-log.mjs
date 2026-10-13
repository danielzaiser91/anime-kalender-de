/**
 * Zwischenstand von `bau-vergleich.mjs` und seiner Warteschlange: eine Zeile mit Uhrzeit, sofort geschrieben (`writeSync` auf
 * Standardausgabe, kein Puffer des Prozesses). Bauer warten bis zu 80 min in der Schlange; ein Log, das erst am Ende gefüllt
 * wird, sieht von außen aus wie ein hängender Lauf (13.10.2026).
 */
import { writeSync } from 'node:fs'

const zweistellig = (n) => String(n).padStart(2, '0')

/** `[HH:MM:SS] text` in der Ortszeit des Rechners. */
export function zeitzeile(text, jetzt = new Date()) {
  return `[${zweistellig(jetzt.getHours())}:${zweistellig(jetzt.getMinutes())}:${zweistellig(jetzt.getSeconds())}] ${text}`
}

/** Schreibt die Zeile mit Uhrzeit sofort; ist die Ausgabe nicht beschreibbar (Pipe voll), fällt es auf `console.log` zurück. */
export function logge(text) {
  try {
    writeSync(1, `${zeitzeile(text)}\n`)
  } catch {
    console.log(zeitzeile(text))
  }
}
