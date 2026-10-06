import type { DatiertNews } from './news-verlauf.ts'

/**
 * **Letzte Bereinigung vor dem Gruppieren** (06.10.2026, Analyse des News-Bereichs: 8 exakte Dublettengruppen, eine Meldung ohne Quelle,
 * ein `am` mit Zeitstempel).
 *
 * - `am` ist ein Tag („2026-08-30"), nie ein Zeitstempel — sonst sortiert und gruppiert dieselbe Meldung getrennt.
 * - Eine Meldung ohne Quelle und ohne Beleg fällt weg (CLAUDE.md: kein Termin ohne `sources`).
 * - Dieselbe Aussage (Titel, Art, Anbieter, Datum, Termin, Folgen) steht nur einmal; bleibt eine zurückgezogene oder ersetzte Fassung neben
 *   einer gültigen, gewinnt die gültige.
 */
export function bereinigeNews(meldungen: DatiertNews[]): DatiertNews[] {
  const tagGleich = meldungen.map((m) => (m.am.length > 10 ? { ...m, am: m.am.slice(0, 10) } : m))
  const mitQuelle = tagGleich.filter((m) => m.quelle || (m.belege?.length ?? 0) > 0)
  const jeAussage = new Map<string, DatiertNews>()
  for (const m of mitQuelle) {
    const schluessel = [m.titel.id, m.art, m.platform ?? '', m.datum ?? '', m.release ?? '', m.von ?? '', m.bis ?? '', m.am].join('|')
    const bisher = jeAussage.get(schluessel)
    const gueltig = !m.ersetzt && !m.zurueckgezogen
    if (!bisher || (gueltig && (bisher.ersetzt || bisher.zurueckgezogen))) jeAussage.set(schluessel, m)
  }
  /* Die Reihenfolge der ersten Fundstelle bleibt erhalten. */
  const behalten = new Set(jeAussage.values())
  return mitQuelle.filter((m) => behalten.has(m))
}
