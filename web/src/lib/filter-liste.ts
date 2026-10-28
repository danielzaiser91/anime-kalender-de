/** Anzahl der Genres, die der Kalender-Filter ohne Klick auf „alle anzeigen“ vorschlägt. */
export const GENRE_VORSCHAU = 12

/**
 * Alle Einträge, die häufigsten des Zeitraums zuerst, der Rest in Ausgangsreihenfolge.
 * Ein Eintrag ohne Termin im Zeitraum bleibt auffindbar (Suche, „alle anzeigen“).
 */
export function nachZahlGeordnet<T>(alle: readonly T[], zaehlung: ReadonlyMap<T, number>): T[] {
  return alle.slice().sort((a, b) => (zaehlung.get(b) ?? 0) - (zaehlung.get(a) ?? 0))
}

/**
 * Welche Genres der Filter zeigt: die ersten `GENRE_VORSCHAU` plus gewählte; mit Suche oder
 * aufgeklappt alle. `versteckt` ist die Zahl der Genres hinter dem Knopf.
 */
export function genreAnzeige(geordnet: readonly string[], gewaehlt: readonly string[], alle: boolean, sucht: boolean): { sichtbar: string[]; versteckt: number } {
  if (alle || sucht) return { sichtbar: geordnet.slice(), versteckt: 0 }
  const sichtbar = geordnet.filter((g, i) => i < GENRE_VORSCHAU || gewaehlt.includes(g))
  return { sichtbar, versteckt: geordnet.length - sichtbar.length }
}
