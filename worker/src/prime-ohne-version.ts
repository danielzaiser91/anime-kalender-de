/**
 * Prime-Meldungen ohne Erweiterungsversion werden abgewiesen (21.11.2026, Aufgabe 18): Seit der Version in jeder Prime-Meldung
 * (`akKontext.meldungKopf()`, 20.11.2026) lässt sich jede Meldung einer Erweiterung zuordnen. Eine ohne Version stammt von einem
 * Altstand oder einem toten Kontext, und genau solche Meldungen waren am 18.11.2026 (152 falsche Umleitungen) nicht zurückzuverfolgen.
 * Die Ablehnung steht im Protokoll (`ablehnungLoggen`, Ereignis `meldung_abgelehnt`) und ist so zählbar.
 */
import { erweiterungVersion } from './erweiterung-version.ts'

export const PRIME_OHNE_VERSION = 'Erweiterungsversion fehlt — Erweiterung neu laden'

/** `true`, wenn der Rumpf eine Prime-Meldung ist und keine brauchbare Version trägt. */
export function primeOhneVersion(daten: Record<string, unknown>): boolean {
  return daten.plattform === 'primevideo' && erweiterungVersion(daten) === null
}
