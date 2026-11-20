import type { ReactNode } from 'react'
import type { Title } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { Fortschritt } from './fortschritt.tsx'
import { Neuigkeiten } from './neuigkeiten.tsx'
import { OhneWegHinweis } from './ohne-weg.tsx'

/**
 * Was unter dem Antwortkasten steht: der Grund, wenn ein Titel keinen Streaming-Weg hat, „gesehen bis" bei Favoriten, die Handlung,
 * die Neuigkeiten des Titels (seit 20.11.2026 über der Reihe: Was gerade neu ist, gehört zum Titel selbst) und zuletzt die Reihe (Karte).
 */
export function UnterDerAntwort({ data, title, favorites, handlung, reihe }: { data: Dataset; title: Title; favorites: Set<number>; handlung: ReactNode; reihe: ReactNode }) {
  return (
    <>
      <OhneWegHinweis title={title} />
      {favorites.has(title.id) && <Fortschritt data={data} titelId={title.id} />}
      {handlung}
      <Neuigkeiten data={data} titelId={title.id} />
      {reihe}
    </>
  )
}
