/**
 * **Cover in der Größe, in der sie gezeigt werden** (18.09.2026, Leistungsmessung).
 *
 * Die Wochenkarte zeigt ein Cover in 28 × 40 px und lud dafür AniLists „large" — 460 px
 * breit, gemessen bis 660 KB je Bild. AniList führt dasselbe Bild unter demselben Namen
 * auch als `medium` (230 px) und `small` (100 px), TMDB in festen Breiten (`w92` … `w780`).
 * Der Helfer gibt `src` und `srcSet` so zurück, dass der Browser je nach Pixeldichte die
 * kleinste passende Größe wählt — **nie größer als die gespeicherte**, denn ältere
 * AniList-Einträge führen nur `medium`.
 */
const ANILIST = [
  ['small', 100],
  ['medium', 230],
  ['large', 460],
] as const
const TMDB = [92, 154, 185, 342, 500, 780]

export function coverBild(
  url: string | undefined,
  cssBreite: number,
  /** Für Raster, deren Kartenbreite mit dem Fenster wächst: die `sizes`-Angabe selbst. */
  sizes = `${cssBreite}px`,
): { src?: string; srcSet?: string; sizes?: string } {
  if (!url) return {}
  const a = /\/cover\/(small|medium|large|extraLarge)\//.exec(url)
  if (a) {
    const obergrenze = a[1] === 'extraLarge' ? 3 : ANILIST.findIndex(([n]) => n === a[1]) + 1
    const stufen = ANILIST.slice(0, obergrenze)
    const variante = (n: string) => url.replace(a[0], `/cover/${n}/`)
    const passend = stufen.find(([, w]) => w >= cssBreite * 2) ?? stufen[stufen.length - 1]!
    return {
      src: variante(passend[0]),
      srcSet: stufen.map(([n, w]) => `${variante(n)} ${w}w`).join(', '),
      sizes,
    }
  }
  const t = /\/t\/p\/w(\d+)\//.exec(url)
  if (t) {
    const original = Number(t[1])
    const stufen = TMDB.filter((w) => w <= original)
    if (!stufen.length) return { src: url }
    const variante = (w: number) => url.replace(t[0], `/t/p/w${w}/`)
    const passend = stufen.find((w) => w >= cssBreite * 2) ?? stufen[stufen.length - 1]!
    return { src: variante(passend), srcSet: stufen.map((w) => `${variante(w)} ${w}w`).join(', '), sizes }
  }
  return { src: url }
}
