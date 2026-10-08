import type { Title } from '@shared/types.ts'
import { releaseStatus } from '@shared/logic.ts'
import type { Dataset } from './data.ts'

/** Vorschau `db-sortierung`: laufend zuerst (zuletzt gestartet vorn), dann baldige Starts (nächster vorn), dann Erschienenes und Unbekanntes (jüngstes Jahr vorn). */
function schluessel(g: { main: Title; members: Title[] }, data: Dataset, today: string): [number, number] {
  let laufend = ''
  let bald = ''
  let fertig = false
  for (const m of g.members) {
    for (const r of data.releasesByTitle.get(m.id) ?? []) {
      const status = releaseStatus(r, today)
      const start = r.schedule?.firstEpisodeDate ?? ''
      if (status === 'airing') laufend = start > laufend ? start : laufend
      else if (status === 'tba') bald = !bald || start < bald ? start : bald
      else if (status === 'abgeschlossen') fertig = true
    }
  }
  const tag = (iso: string) => Number(iso.replaceAll('-', '')) || 0
  const jahr = g.main.jpYear ?? 0
  if (laufend) return [0, -tag(laufend)]
  if (bald) return [1, tag(bald)]
  return [fertig ? 2 : 3, -jahr]
}

/** Ordnet Gruppen nach Relevanz ohne Suche. Stabil: gleiche Schlüssel behalten die Reihenfolge der Eingabe. */
export function sortiereNachRelevanz<T extends { main: Title; members: Title[] }>(gruppen: T[], data: Dataset, today: string): void {
  const key = new Map<T, [number, number]>(gruppen.map((g) => [g, schluessel(g, data, today)]))
  gruppen.sort((a, b) => {
    const x = key.get(a)!
    const y = key.get(b)!
    return x[0] - y[0] || x[1] - y[1]
  })
}
