import type { DubCheck } from '../lib/dub-confirmed.ts'
import type { PlatformId, Title } from '../../shared/types.ts'

export type CartoonBeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges'>

/**
 * Handbelege (negative Kennung) tragen Adresse und Sprache an die Wege der Cartoons nach oder nehmen den Weg heraus.
 * Gibt die Zahl der Wege mit Ja zurück.
 */
export function wendeCartoonBelegeAn(titel: Title[], belege: CartoonBeleg[]): number {
  const nachId = new Map(titel.map((t) => [t.id, t]))
  let belegt = 0
  for (const b of belege) {
    const t = nachId.get(b.anilistId)
    if (!t) continue
    if (b.available === false || b.dub === false) {
      t.streams = t.streams.filter((s) => s.platform !== b.platform)
      continue
    }
    if (b.dub !== true && !b.url) continue
    let s = t.streams.find((x) => x.platform === b.platform)
    if (!s) {
      s = { platform: b.platform as PlatformId, url: '' }
      t.streams.push(s)
    }
    if (b.url) s.url = b.url
    if (b.dub === true) {
      s.dub = true
      if (b.dubRanges?.length) s.dubRanges = b.dubRanges
      belegt++
    }
  }
  return belegt
}
