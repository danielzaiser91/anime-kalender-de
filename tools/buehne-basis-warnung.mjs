/**
 * Meldungen der Basis-Messung der Bühne: Deckung der Basis gegenüber dem Kopf und die Warnung, die im PR sichtbar wird.
 * Die Warnung steht als `⚠ WARNUNG` im Log, als `::warning::` (Annotation am Lauf) und in der Job-Zusammenfassung — nie nur im Log.
 */
import { appendFileSync } from 'node:fs'

/** Ab diesem Anteil gemessener Kopf-Zellen mit Basis-Gegenstück gilt die Basis als vollständig genug (Neue Mockups haben keins). */
export const MIN_DECKUNG = 0.8

/** Zählt die Kopf-Zellen ohne Basis-Gegenstück; `warnung` ist gesetzt, wenn die Basis leer oder deutlich dünner als der Kopf ist. */
export function deckung(basisSchluessel, kopfSchluessel) {
  const bekannt = new Set(basisSchluessel)
  const mit = kopfSchluessel.filter((k) => bekannt.has(k)).length
  const gesamt = kopfSchluessel.length
  const ohne = gesamt - mit
  const zeile = `Basis-Deckung: ${ohne} von ${gesamt} Zellen ohne Basis-Gegenstück`
  const duenn = mit < gesamt * MIN_DECKUNG
  return { zeile, warnung: duenn ? `Basis deckt nur ${mit} von ${gesamt} Zellen — Vergleich gegen main unvollständig` : '' }
}

/** Gibt die Warnung dreifach aus (Log, Annotation, Zusammenfassung); `zusammenfassung` ist der Pfad aus `$GITHUB_STEP_SUMMARY`. */
export function warne(text, ausgabe, zusammenfassung = process.env.GITHUB_STEP_SUMMARY) {
  ausgabe(`⚠ WARNUNG Bühne-Basis ${text}`)
  ausgabe(`::warning title=Bühne-Basis::${text}`)
  if (zusammenfassung) appendFileSync(zusammenfassung, `\n⚠ **Bühne-Basis:** ${text}\n`)
}

/** Deckungszeile und gegebenenfalls Warnung des Kopf-Laufs gegen eine Basis. */
export function meldeDeckung({ basis, vorher, ausgabe, zusammenfassung }) {
  const d = deckung(Object.keys(basis), [...vorher.keys()])
  ausgabe(d.zeile)
  if (d.warnung) warne(d.warnung, ausgabe, zusammenfassung)
}
