import type { Release, Title } from '@shared/types.ts'
import { gruppiereNachRelevanz, istGruppiert, type RelevanzArt } from './db-relevanz.ts'
import { sortiereNachTitel } from './titel-sortierung.ts'

interface Kachel {
  main: Title
  members: Title[]
}

/** Eine Kachel der Liste; in der Gruppenansicht mit ihrer Gruppe und, wo bekannt, dem Start der deutschen Fassung. */
export type ListenEintrag = Kachel & { art?: RelevanzArt; ab?: string }

/**
 * Bringt die Kacheln der Datenbank in die gewählte Reihenfolge. „Relevanz" ohne Suche gruppiert (`zahlen`: Kacheln je
 * Gruppe); mit Suche bleibt die Eingabe in Treffergüte stehen, die anderen Wahlen sortieren die Kacheln selbst.
 */
export function ordneListe(
  base: Kachel[],
  sort: string,
  suche: string,
  releasesByTitle: Map<number, Release[]>,
  today: string,
): { liste: ListenEintrag[]; zahlen: Partial<Record<RelevanzArt, number>> } {
  const zahlen: Partial<Record<RelevanzArt, number>> = {}
  if (istGruppiert(sort, suche)) {
    const liste: ListenEintrag[] = []
    for (const g of gruppiereNachRelevanz(base, releasesByTitle, today)) {
      zahlen[g.art] = g.eintraege.length
      for (const e of g.eintraege) liste.push({ ...e.gruppe, art: g.art, ab: e.ab })
    }
    return { liste, zahlen }
  }
  if (sort === 'titel') sortiereNachTitel(base)
  else if (sort === 'jahr') base.sort((a, b) => (b.main.jpYear ?? 0) - (a.main.jpYear ?? 0))
  else if (sort === 'score') base.sort((a, b) => (b.main.score ?? 0) - (a.main.score ?? 0))
  return { liste: base, zahlen }
}
