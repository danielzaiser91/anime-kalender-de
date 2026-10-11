/**
 * **Cover in der Größe, in der sie gezeigt werden** (18.09.2026, Leistungsmessung; seit 11.10.2026 ohne AniList).
 *
 * Die Wochenkarte zeigt ein Cover in 28 × 40 px; ein 600-px-Bild wäre dafür Verschwendung. TMDB führt dasselbe Plakat in festen Breiten
 * (`w92` … `w780`), aniSearch in zwei (`_400`, `_600`). Der Helfer gibt `src` und `srcSet` so zurück, dass der Browser je nach
 * Pixeldichte die kleinste passende Größe wählt — **nie größer als die gespeicherte**.
 */
const ANISEARCH = [400, 600]
/** Kachel-Cover bis Dichte 1,5: bei aniSearch genügt meist die 400er-Fassung; Kachel und Offline-Vorrat nehmen dieselbe Größe. */
export const KACHEL_DICHTE = 1.5
const TMDB = [92, 154, 185, 342, 500, 780]

/** `src` und `srcSet` aus den Breiten, die es gibt; `ersetze` setzt eine Breite in die Adresse ein. */
function stufenBild(breiten: number[], original: number, ersetze: (w: number) => string, cssBreite: number, sizes: string, dichte: number) {
  const stufen = breiten.filter((w) => w <= original)
  if (!stufen.length) return undefined
  const passend = stufen.find((w) => w >= cssBreite * dichte) ?? stufen[stufen.length - 1]!
  return { src: ersetze(passend), srcSet: stufen.map((w) => `${ersetze(w)} ${w}w`).join(', '), sizes }
}

export function coverBild(
  url: string | undefined,
  cssBreite: number,
  /** Für Raster, deren Kartenbreite mit dem Fenster wächst: die `sizes`-Angabe selbst. */
  sizes = `${cssBreite}px`,
  /** Höchste bediente Pixeldichte (Standard 2). Kacheln nehmen 1,5. */
  dichte = 2,
): { src?: string; srcSet?: string; sizes?: string } {
  if (!url) return {}
  const as = /^(https:\/\/cdn\.anisearch\.de\/.*_)(\d+)(\.webp)$/.exec(url)
  if (as) return stufenBild(ANISEARCH, Number(as[2]), (w) => `${as[1]}${w}${as[3]}`, cssBreite, sizes, dichte) ?? { src: url }
  const t = /\/t\/p\/w(\d+)\//.exec(url)
  if (t) return stufenBild(TMDB, Number(t[1]), (w) => url.replace(t[0], `/t/p/w${w}/`), cssBreite, sizes, 2) ?? { src: url }
  return { src: url }
}
