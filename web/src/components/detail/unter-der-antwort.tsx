import type { ReactNode } from 'react'
import type { Title } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { Fortschritt } from './fortschritt.tsx'
import { Neuigkeiten } from './neuigkeiten.tsx'
import { OhneWegHinweis } from './ohne-weg.tsx'

/**
 * Was unter dem Antwortkasten steht: der Grund, wenn ein Titel keinen Streaming-Weg hat, „gesehen bis" bei Favoriten, die Reihe (Karte, seit 09.10.2026 vor den Neuigkeiten:
 * nach „wann und wo" fragt man „welche Staffel ist das"), dann die Neuigkeiten des Titels.
 */
export function UnterDerAntwort({ data, title, favorites, reihe }: { data: Dataset; title: Title; favorites: Set<number>; reihe: ReactNode }) {
  return (
    <>
      <OhneWegHinweis title={title} />
      {favorites.has(title.id) && <Fortschritt data={data} titelId={title.id} />}
      {reihe}
      <Neuigkeiten data={data} titelId={title.id} />
    </>
  )
}
