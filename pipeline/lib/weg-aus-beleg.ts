import type { StreamLink } from '../../shared/types.ts'
import type { DubCheck } from './dub-confirmed.ts'

/** Urteil und Folge-Bereiche eines Belegs am Weg. Ohne die Bereiche gilt der Weg für alle Folgen (Slime S4: Prime „24 Folgen“, belegt 1–19). */
export function urteilAmWeg(check: DubCheck): Pick<StreamLink, 'dub' | 'dubRanges'> {
  const bereiche = check.dubRanges?.length ? { dubRanges: check.dubRanges.map((r) => ({ from: r.from, to: r.to, dub: r.dub })) } : {}
  return { dub: check.dub, ...bereiche }
}

const AMAZON_SUCHE = /amazon\.[a-z.]+\/s\?/i

/**
 * **Verändert `streams`:** Ersetzt auf der Plattform des Belegs die einzige Amazon-Suche durch die Beleg-Adresse; liefert, ob die Plattform einen Weg hat.
 * Hat der Titel auf der Plattform des Belegs schon einen Weg? Ist der einzige eine Amazon-Suche (AniList verlinkt einen fremden
 * Marktplatz, der Bau macht daraus die Suche), bekommt er dabei die Titelseite des Belegs: Ein Beleg ohne Urteil (Kanal-Titel, `kanalOhneBeleg`)
 * erreicht `belegFuer()` nicht, und eine Suche, die am Ende übrig bleibt, fliegt ohne Protokoll heraus (11-3). 16 Titel verloren so ihren Prime-Weg
 * (One Piece Film: Strong World u. a., 12.10.2026).
 */
export function ersetztSucheUndMeldetWeg(streams: StreamLink[], check: DubCheck): boolean {
  const wege = streams.filter((s) => s.platform === check.platform)
  if (wege.length === 1 && AMAZON_SUCHE.test(wege[0]!.url)) Object.assign(wege[0]!, { url: check.url, ...urteilAmWeg(check) })
  return wege.length > 0
}
