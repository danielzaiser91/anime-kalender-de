/** Zahlen im eigenen Text gegen die Belege prüfen, und Wertungen/Zitate aus Quellsätzen fernhalten (Nachtrag des Dirigenten, 12.10.2026). */

const WORT: Record<string, number> = {
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
}

/** Alle Zahlen eines Textes als Ziffern; „zwölf“ zählt wie „12“, „ein/eine“ bleiben Artikel. */
export function zahlenIn(text: string): Set<string> {
  const raus = new Set<string>()
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) raus.add(m[0].replace(/[.,]/g, ''))
  for (const w of text.toLowerCase().match(/[a-zäöüß]+/g) ?? []) if (WORT[w]) raus.add(String(WORT[w]))
  return raus
}

/** Zahlen des Textes, die in keinem Beleg (Quelltexte, Kartenfakten) vorkommen. */
export function unbelegteZahlen(text: string, belege: string[]): string[] {
  const bekannt = new Set<string>()
  for (const b of belege) for (const z of zahlenIn(b)) bekannt.add(z)
  return [...zahlenIn(text)].filter((z) => !bekannt.has(z))
}

export interface FolgenWiderspruch {
  katalog: number
  quellen: { name: string; wert: number }[]
}

/** Nennt eine Quelle eine andere Folgenzahl als der Katalog, wird die Zahl nicht stillschweigend übernommen. */
export function folgenWiderspruch(katalog: number | undefined, quellen: { name: string; wert: number | undefined }[]): FolgenWiderspruch | undefined {
  if (!katalog) return undefined
  const anders = quellen.filter((q): q is { name: string; wert: number } => !!q.wert && q.wert !== katalog)
  return anders.length ? { katalog, quellen: anders } : undefined
}

// Wertung, Rezension, Presse und Zitate sind nicht frei: nur Fakten aus Quellen mit genannter Lizenz.
const WERTUNG = /\b(reviewers?|critics?|reviews?|praised|criticized|criticised|panned|described (?:it )?as|called (?:it|the)|according to|box office|grossed|nominated|awarded|rated)\b|Rezension|Kritiker|Kritik\b|lobte|kritisierte|bezeichnete|\blaut\b|Einspielergebnis|ausgezeichnet|nominiert/i
const ZITAT = /["„“][^"„“”]*\s[^"„“”]*\s[^"„“”]*["”“]/

/** Für Quellsätze: Wertung oder ein längeres Zitat. */
export const istWertung = (satz: string): boolean => WERTUNG.test(satz) || ZITAT.test(satz)

/** Für den eigenen Text: Wertungswörter (Titel in Anführungszeichen sind dort erlaubt). */
export const enthaeltWertung = (satz: string): boolean => WERTUNG.test(satz)
