/**
 * Die Marke „Block AK" (Daniel, 14.10.2026): orangefarbenes Kalenderblatt mit Kopfzeile, Ringen und
 * den Großbuchstaben AK. Eine Zeichnung im 64er-Raster für App-Symbole (`build-icons.ts`) und
 * Vorschaubilder (`og-karte.ts`); `web/src/components/kalender/Zeichen.tsx` trägt eine Kopie.
 */
export const MARKE_KACHEL = '#0d0f14'
export const MARKE_AKZENT = '#ff5a36'

/** Blatt und Buchstaben ohne Kachel; die Zeichnung belegt 8–56 des 64er-Rasters. */
export const MARKE_INNEN = `<rect x="8" y="14" width="48" height="42" rx="8" fill="${MARKE_AKZENT}"/>
<rect x="8" y="24" width="48" height="4" fill="${MARKE_KACHEL}"/>
<rect x="18" y="8" width="4" height="12" rx="2" fill="${MARKE_KACHEL}"/>
<rect x="42" y="8" width="4" height="12" rx="2" fill="${MARKE_KACHEL}"/>
<path d="M10 52 L18.5 31 H23.5 L32 52 H27 L25 47 H17 L15 52 Z M21 37 L23.4 43 H18.6 Z" fill-rule="evenodd" fill="${MARKE_KACHEL}"/>
<rect x="35" y="31" width="5" height="21" fill="${MARKE_KACHEL}"/>
<path d="M40 43 L50 31 M40 41 L50 52" fill="none" stroke="${MARKE_KACHEL}" stroke-width="5" stroke-linecap="butt"/>`

/** Die Marke samt Kachel als eigenständiges SVG der Kantenlänge `px`. */
export function markeSvg(px: number, deckkraft = 1): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" opacity="${deckkraft}"><rect width="64" height="64" rx="14" fill="${MARKE_KACHEL}"/>${MARKE_INNEN}</svg>`,
  )
}
