/**
 * aniSearch-Amazon-Adressen für die Link-Prüfung.
 *
 * Stand 12.11.2026: 92 aniSearch-Amazon-Wege waren nie geprüft, weil sie nur bei
 * Titeln mit Prime-**Such**-Stream in die Schlange kamen (z. B. Ragna Crimson
 * B0F1XK58VQ: Prime-Handbeleg, kein Stream, tote Seite ohne Befund). Jetzt kommt
 * jede solche Adresse in die Schlange; `vorrang` (zuerst dran) bleibt den Titeln
 * mit Suchadresse vorbehalten, deren Suche sie ablösen könnte.
 */
import type { Title } from '../../shared/types.ts'

const AMAZON_VIDEO = /amazon\.[a-z.]+\/(gp\/video\/detail|dp)\//i
const SUCHADRESSE = /amazon\.[a-z.]+\/s\?|[?&]k=/i

export type AniSearchStreams = Record<string, { streams?: Array<{ url?: string }> }>

export function aniSearchAmazon(
  titles: Pick<Title, 'id' | 'streams'>[],
  anisearch: AniSearchStreams,
): { alle: Set<string>; vorrang: Set<string> } {
  const alle = new Set<string>()
  const vorrang = new Set<string>()
  for (const t of titles) {
    const sucht = (t.streams ?? []).some((s) => s.platform === 'primevideo' && SUCHADRESSE.test(s.url))
    for (const s of anisearch[String(t.id)]?.streams ?? []) {
      const u = s.url?.split('?')[0]
      if (!u || !AMAZON_VIDEO.test(u) || SUCHADRESSE.test(u)) continue
      alle.add(u)
      if (sucht) vorrang.add(u)
    }
  }
  return { alle, vorrang }
}
