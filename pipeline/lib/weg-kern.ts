import { gtiAus } from './amazon-gti.ts'

/**
 * Adresse ohne Schema, `www.`, Anhang und Schlussstrich, klein — bei Amazon-Adressen mit `gti` (JustWatch) die gti selbst.
 * Ohne sie war jede `watch.amazon.de/detail?gti=…` dieselbe Adresse: Zwei entfernte Prime-Verweise sperrten alle Amazon-Wege
 * von JustWatch (10.11.2026: Drei kleine Geister, Haganai, Laidbackers u. a. verloren so ihren Stream).
 */
export function wegKern(u: string): string {
  return gtiAus(u) ?? u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0]!.replace(/\/$/, '').toLowerCase()
}
