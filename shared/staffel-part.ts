/**
 * „Part N" als Staffel statt als Teil (Lupin III. Part 1–6: jede Part ist eine eigene Serie).
 * Die Namen kommen schon eingedeutscht herein („Part 6" → „Teil 6", siehe `eindeutschenStaffel`).
 */
const ROEMISCH: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }

/** „… Teil 6" / „… Part V" am Namensende als Zahl; ein Name mit Staffelangabe („Staffel 2 - Teil 2") liefert nichts. */
export function partNummer(name: string): number | undefined {
  if (/Staffel\s+\d+/i.test(name)) return undefined
  const m = /(?:^|[\s:–—-])(?:Teil\s+(\d+)|Part\s+([IVX]+))\s*$/i.exec(name)
  if (!m) return undefined
  return m[1] ? Number(m[1]) : ROEMISCH[m[2]!.toUpperCase()]
}

/**
 * Zählt die Reihe „Part N" als Staffel? Ja, wenn schon der erste Eintrag „Part 1" heißt und mindestens drei
 * Einträge eine Part-Nummer tragen. Ohne „Part 1" am Anfang bleibt „Part 2" die zweite Hälfte einer Staffel
 * (Kengan Ashura, Saint Seiya: Battle for Sanctuary).
 */
export function zaehltPartAlsStaffel(namenNachAusstrahlung: string[]): boolean {
  if (partNummer(namenNachAusstrahlung[0] ?? '') !== 1) return false
  return namenNachAusstrahlung.filter((n) => partNummer(n) !== undefined).length >= 3
}
