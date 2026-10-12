import type { StreamLink } from '../../shared/types.ts'
import type { DubCheck } from './dub-confirmed.ts'

/** Urteil und Folge-Bereiche eines Belegs am Weg. Ohne die Bereiche gilt der Weg für alle Folgen (Slime S4: Prime „24 Folgen“, belegt 1–19). */
export function urteilAmWeg(check: DubCheck): Pick<StreamLink, 'dub' | 'dubRanges'> {
  const bereiche = check.dubRanges?.length ? { dubRanges: check.dubRanges.map((r) => ({ from: r.from, to: r.to, dub: r.dub })) } : {}
  return { dub: check.dub, ...bereiche }
}
