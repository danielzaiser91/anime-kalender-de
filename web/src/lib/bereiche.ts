import type { ViewId } from './router.ts'

export type Bereich = 'kalender' | 'datenbank' | 'news' | 'saison' | 'entdecken'

/** Die Bereiche der Seite (am Handy ohne „Entdecken“: dort führt der Knopf in der Datenbank hin). Woche und Monat sind beide „Kalender". */
export const BEREICHE: { id: Bereich; ziel: ViewId }[] = [
  { id: 'kalender', ziel: 'woche' },
  { id: 'datenbank', ziel: 'datenbank' },
  { id: 'news', ziel: 'news' },
  { id: 'saison', ziel: 'saison' },
  { id: 'entdecken', ziel: 'entdecken' },
]

export function bereichVon(view: ViewId): Bereich | undefined {
  if (view === 'woche' || view === 'monat') return 'kalender'
  if (view === 'datenbank' || view === 'news' || view === 'saison' || view === 'entdecken') return view
  return undefined
}

