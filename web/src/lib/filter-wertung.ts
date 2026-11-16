/**
 * **Der Wertungsfilter** (Daniel, 16.11.2026). `Title.score` liegt auf 0–100 (aniSearch, bei Cartoons TMDB) und wird als
 * Zahl mit einer Nachkommastelle gezeigt: aus 85 wird „8,5“. Der Filter nennt seine Schwellen in derselben Schreibweise.
 */

/** Schwellen in der Skala der Daten; an der Verteilung der 2.815 Wertungen gewählt (Stand 16.11.2026: ≥ 60 → 2.234, ≥ 70 → 1.486, ≥ 75 → 882, ≥ 80 → 373). */
export const WERTUNG_STUFEN = [60, 70, 75, 80] as const

/** Die Wertung mit Komma: aus 85 Prozent wird „8,5“. */
export function wertungText(score: number): string {
  return (score / 10).toFixed(1).replace('.', ',')
}

/** Ist ein Wertungsfilter gesetzt? Ohne ihn liest niemand `score` — die Kachel-Datei des Wochenstarts trägt es nicht (`TITEL_OHNE`). */
export function wertungGesetzt(f: { minScore: number; ohneWertungAus: boolean }): boolean {
  return f.minScore > 0 || f.ohneWertungAus
}

/**
 * Passt die Wertung eines Titels? `minScore` 0 = keine Schwelle. Ein Titel ohne Wertung fällt nur heraus, wenn
 * `ohneWertungAus` gesetzt ist — unabhängig von der Schwelle.
 */
export function passtWertung(score: number | undefined, minScore: number, ohneWertungAus: boolean): boolean {
  if (score === undefined) return !ohneWertungAus
  return score >= minScore
}

/** Adress-Schlüssel: `wm` = Mindestwertung, `wx=1` = Titel ohne Wertung ausschließen. */
export function wertungAusAdresse(params: URLSearchParams): { minScore: number; ohneWertungAus: boolean } {
  const roh = Number(params.get('wm'))
  const minScore = Number.isInteger(roh) && roh >= 1 && roh <= 100 ? roh : 0
  return { minScore, ohneWertungAus: params.get('wx') === '1' }
}

export function wertungInAdresse(params: URLSearchParams, f: { minScore: number; ohneWertungAus: boolean }): void {
  if (f.minScore > 0) params.set('wm', String(f.minScore))
  if (f.ohneWertungAus) params.set('wx', '1')
}
