/** Marke mit Wortmarke „anime·kalender" davor/daneben (Lockup) als Ebenen der Vorschaubilder. */
import type { OverlayOptions } from 'sharp'
import { markeSvg } from './og-marke.ts'
import { text } from './og-text.ts'

/** Marke `marke` px hoch, daneben die Wortmarke in `schrift` px; Kino-Bild 46/30/14, Standardbild 112/76/26. */
export async function lockup(x: number, y: number, marke: number, schrift: number, abstand = 14): Promise<OverlayOptions[]> {
  const wort = await text(`anime<span foreground="#ff5a36">·</span>kalender`, 'marke', schrift, '#f2f1ee', 900)
  return [
    { input: markeSvg(marke), top: y, left: x },
    { input: wort.input, top: y + Math.round((marke - wort.hoehe) / 2), left: x + marke + abstand },
  ]
}
