/**
 * Die Ausgabe einer Disc-Meldung in zwei, drei Wörtern („Vol. 1/2", „Gesamtausgabe", „Komplettset", „Box 9").
 *
 * Anlass (06.10.2026, News-Analyse): „Erscheint am 06.11. auf Disc" sagte bei Sailor Moon sieben Mal dasselbe — 89 von 175 Disc-Meldungen
 * betrafen verschiedene Volumes oder Boxen, und der Satz nannte nie, welche. Die Angabe steht schon in `edition` des Termins.
 */
export function ausgabeKurz(edition: string | undefined): string | undefined {
  if (!edition) return undefined
  const kopf = edition
    .split(/[:,·+]| – /)[0]!
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(blu-ray|dvd|4k|uhd)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /^(vol\b|volume|box\b|teil\b|komplett|gesamt|staffel)/i.test(kopf) ? kopf : undefined
}
