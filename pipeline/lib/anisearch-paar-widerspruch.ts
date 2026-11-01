/**
 * Widerspricht ein Paar der aniSearch-Brücke (MAL → aniSearch-Seite) den Merkmalen des Titels? Gemessen am Bestand vom 01.11.2026 (5.283 Paare mit Titel
 * und Seiteneintrag): bei 14 verband die Brücke zwei verschiedene Werke (Voidoll irregular ↔ #Compass, Ga no Iru Tokoro ↔ Thinking and Drawing …).
 * Als widersprüchlich gilt ein Paar nur, wenn die Namen nichts gemeinsam haben UND Jahr oder Folgenzahl auseinanderliegen; Umschriftunterschiede
 * allein (Hone Kami / Honekami, Pinyin getrennt / zusammen) genügen nie.
 */
export type PaarTitel = { names: (string | undefined | null)[]; jahr?: number; folgen?: number }
export type PaarSeite = { names: (string | undefined | null)[]; jahr?: number; folgen?: number }

const woerter = (s: string): string[] =>
  s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((w) => w.length > 2)
const kompakt = (s: string): string => woerter(s).join('')

/** Teilen zwei Namen ein Wort, oder steckt der kürzere zusammengeschrieben im längeren? */
export function namenAehneln(a: string, b: string): boolean {
  const wa = new Set(woerter(a))
  if (woerter(b).some((w) => wa.has(w))) return true
  const ka = kompakt(a)
  const kb = kompakt(b)
  const [kurz, lang] = ka.length <= kb.length ? [ka, kb] : [kb, ka]
  return kurz.length >= 4 && lang.includes(kurz)
}

export function paarWiderspricht(titel: PaarTitel, seite: PaarSeite): boolean {
  const a = titel.names.filter((n): n is string => !!n)
  const b = seite.names.filter((n): n is string => !!n)
  if (a.length === 0 || b.length === 0) return false
  if (a.some((x) => b.some((y) => namenAehneln(x, y)))) return false
  const jahrWeicht = !!titel.jahr && !!seite.jahr && Math.abs(titel.jahr - seite.jahr) >= 2
  const folgenWeichen = !!titel.folgen && !!seite.folgen && titel.folgen !== seite.folgen
  return jahrWeicht || folgenWeichen
}
