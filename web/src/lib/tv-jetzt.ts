import type { ReleaseEvent } from '@shared/types.ts'
import { kastenZustand, linienStand, type Kastenzustand, type LinienStand } from '@shared/laeuft-jetzt.ts'
import type { Dataset } from './data.ts'

export interface TvJetzt {
  zustand: Kastenzustand
  linie: LinienStand
}

/** Was im Fernseh-Kasten des heutigen Tages läuft und wo die Linie steht; die Sendungen gehören zur Reihe der ersten Zeile eines Bündels. */
export function tvJetzt(gruppen: ReleaseEvent[][], releaseBySlug: Dataset['releaseBySlug'], jetzt: string): TvJetzt | undefined {
  const heute = gruppen[0]?.[0]?.date
  if (!heute) return undefined
  const sendungen = gruppen.map((g) => releaseBySlug.get(g[0]!.releaseSlug)?.sendungen ?? [])
  const zustand = kastenZustand(gruppen, sendungen, heute, jetzt)
  return { zustand, linie: linienStand(zustand, gruppen, jetzt) }
}
