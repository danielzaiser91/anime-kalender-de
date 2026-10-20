/** Das Standard-Vorschaubild zeichnen: große Marke, Versprechen, drei Aussagen (Inhalt: `og-standard.ts`). */
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'
import { AKZENT, glutEbenen, GRUND, H, TEXT, W } from './og-karte.ts'
import { lockup } from './og-lockup.ts'
import { markup, text } from './og-text.ts'
import type { StandardDaten } from './og-standard.ts'

const X = 80
const ZEILE_Y = 400
const ZEILE_ABSTAND = 55

export async function zeichneStandard(daten: StandardDaten, datei: string): Promise<void> {
  const ebenen: OverlayOptions[] = [...glutEbenen(), ...(await lockup(X, 150, 112, 76, 26))]
  const claim = await text(markup(daten.claim), 'titel', 42, TEXT, 1040)
  ebenen.push({ input: claim.input, top: 300, left: X })
  for (const [i, zeile] of daten.liste.entries()) {
    const t = await text(markup(zeile), 'halbfett', 34, TEXT, 1000)
    const y = ZEILE_Y + i * ZEILE_ABSTAND
    const punkt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="7" fill="${AKZENT}"/></svg>`
    ebenen.push({ input: Buffer.from(punkt), top: y + Math.round((t.hoehe - 14) / 2), left: X }, { input: t.input, top: y, left: X + 30 })
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: GRUND } })
    .composite(ebenen)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(datei)
}
