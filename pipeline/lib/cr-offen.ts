import { appendFileSync } from 'node:fs'
import { log } from './util.ts'

/**
 * Antwort von `data:cr-dub -- --offen-pruefen`: wie viele Serien der Lauf lesen würde. Der Stundenlauf holt das Zugangspaket der Weiche
 * nur, wenn die Zahl nicht 0 ist (Ausgabe `cr_offen` für spätere Schritte). Fehlt die Ausgabedatei (lokal), bleibt es bei der Logzeile.
 */
export function offenMelden(anzahl: number, ausgabeDatei = process.env.GITHUB_OUTPUT): void {
  log(`Crunchyroll: ${anzahl} Serien würden gelesen (Zählung ohne Abruf)`)
  if (ausgabeDatei) appendFileSync(ausgabeDatei, `cr_offen=${anzahl}\n`)
}
