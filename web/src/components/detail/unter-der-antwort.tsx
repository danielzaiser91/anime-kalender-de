import type { Title } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { Fortschritt } from './fortschritt.tsx'
import { Neuigkeiten } from './neuigkeiten.tsx'

/** Was unter dem Antwortkasten steht: „gesehen bis" bei Favoriten, dann die Neuigkeiten der Reihe. */
export function UnterDerAntwort({ data, title, favorites, reihenIds }: { data: Dataset; title: Title; favorites: Set<number>; reihenIds: number[] }) {
  return (
    <>
      {favorites.has(title.id) && <Fortschritt data={data} titelId={title.id} />}
      <Neuigkeiten data={data} titelId={title.id} reihenIds={reihenIds} />
    </>
  )
}
