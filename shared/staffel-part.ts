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

/** Ein „Teil N" am Namensende (auch „(Teil 2)", römisch): Basisname davor und Nummer; für die eingedeutschte Form („Part 2", „Cour 2" → „Teil 2"). */
function teilAmEnde(name: string): { basis: string; nr: number } | undefined {
  const m = /^(.*?)[\s:–—(-]*\(?\s*Teil\s+(\d+|[IVX]+)\s*\)?\s*$/i.exec(name)
  if (!m?.[1]) return undefined
  const nr = /^\d+$/.test(m[2]!) ? Number(m[2]) : ROEMISCH[m[2]!.toUpperCase()]
  return nr ? { basis: m[1], nr } : undefined
}

/** Die Wörter eines Namens ohne Reihenfolge und Satzzeichen („Saint Seiya: Knights of the Zodiac" = „Knights of the Zodiac: Saint Seiya"). */
function woerter(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).sort().join(' ')
}

/**
 * Ist dieser Name der zweite (dritte …) Teil einer früheren Staffel, auch ohne den Reihennamen davor?
 * Ja, wenn er auf „Teil N" (N ≥ 2) endet und sein Basisname dieselben Wörter hat wie ein früherer Eintrag
 * (mit oder ohne dessen eigenes „Teil 1"): „Attack on Titan: Finale Staffel Teil 2" nach „… Finale Staffel".
 * Liefert den jüngsten solchen Eintrag. Ein Name mit eigener Staffelangabe ist nie ein Teil.
 */
export function teilEinerFrueherenStaffel<T extends { name: string }>(name: string, fruehere: T[]): { eintrag: T; nr: number } | undefined {
  const ende = teilAmEnde(name)
  if (!ende || ende.nr < 2 || /Staffel\s+\d+/i.test(name)) return undefined
  const gesucht = woerter(ende.basis)
  for (const e of fruehere.slice().reverse()) {
    if (woerter(teilAmEnde(e.name)?.basis ?? e.name) === gesucht) return { eintrag: e, nr: ende.nr }
  }
  return undefined
}
