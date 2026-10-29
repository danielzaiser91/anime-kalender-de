/**
 * Frische Anime2You-Vorschläge über den gespeicherten Bestand legen (`scrape-anime2you.ts`).
 * Ausgelagert, damit ein Test die Zusammenführung ohne Feed und Dateien aufruft.
 */
interface MitNachholfeldern {
  articleUrl: string
  sammel?: unknown
  sammelGelesen?: string
  volltextGelesen?: string
  dates?: unknown
}

export function vorschlaegeMitBestand<T extends MitNachholfeldern>(previous: T[], proposals: T[]): T[] {
  // Bestehende Vorschläge behalten: Ein Feed zeigt nur die letzten Meldungen,
  // ältere wären sonst nach einer Woche verschwunden, bevor jemand sie liest.
  const merged = new Map(previous.map((p) => [p.articleUrl, p] as const))
  /* Ein frischer Feed-Treffer kennt die gelesene Liste eines Sammelartikels nicht — sie bleibt erhalten, sonst verschwinden alle ihre Termine, bis der Artikel neu gelesen ist (ADN Oktober 2026, 05.10.2026). */
  for (const proposal of proposals) {
    const vorher = merged.get(proposal.articleUrl)
    merged.set(proposal.articleUrl, {
      ...proposal,
      ...(vorher?.sammel ? { sammel: vorher.sammel, sammelGelesen: vorher.sammelGelesen } : {}),
      /* Ebenso die Tage aus dem Volltext eines Shop-Artikels (`shopTabellenNachholen`): Der Feed-Auszug kennt die Tabelle nicht. */
      ...(vorher?.volltextGelesen ? { volltextGelesen: vorher.volltextGelesen, dates: vorher.dates } : {}),
    })
  }
  return [...merged.values()]
}
