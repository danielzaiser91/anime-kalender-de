import { dubKey, neinHandbelege, type DubCheck } from '../lib/dub-confirmed.ts'
import type { PlatformId, Title } from '../../shared/types.ts'

export type CartoonBeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges'>

/**
 * Handbelege (negative Kennung) tragen Adresse und Sprache an die Wege der Cartoons nach oder nehmen den Weg heraus.
 * Erst kommen alle Ja, dann nimmt `neinHandbelege` den Weg nur, wenn das Nein der ganzen Plattform gilt: Ein Nein zu einer anderen
 * Prime-Ausgabe nimmt den Weg einer Ausgabe mit Ja nicht mit (Hazbin Hotel: zwei Ja, ein Nein, das spätere Nein löschte den Prime-Weg ganz).
 * Die Adresse eines Wegs mit Ja kommt aus einer Ja-Zeile; eine Zeile ohne Urteil (Kanal-Ausgabe) überschreibt sie nicht.
 * Gibt die Zahl der Ja-Wege zurück.
 */
export function wendeCartoonBelegeAn(titel: Title[], belege: CartoonBeleg[]): number {
  const nachId = new Map(titel.map((t) => [t.id, t]))
  let belegt = 0
  const jaAdresse = new Set<Title['streams'][number]>()
  for (const b of belege) {
    const t = nachId.get(b.anilistId)
    if (!t || b.available === false || b.dub === false) continue
    if (b.dub !== true && !b.url) continue
    let s = t.streams.find((x) => x.platform === b.platform)
    if (!s) {
      s = { platform: b.platform as PlatformId, url: '' }
      t.streams.push(s)
    }
    if (b.url && (b.dub === true || !jaAdresse.has(s))) s.url = b.url
    if (b.dub === true) {
      jaAdresse.add(s)
      s.dub = true
      if (b.dubRanges?.length) s.dubRanges = b.dubRanges
      belegt++
    }
  }
  const nein = neinHandbelege(belege)
  for (const t of titel) t.streams = t.streams.filter((s) => !nein.has(dubKey(t.id, s.platform)))
  return belegt
}
