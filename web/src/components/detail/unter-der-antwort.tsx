import type { Title } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { Fortschritt } from './fortschritt.tsx'
import { Neuigkeiten } from './neuigkeiten.tsx'

/** Was unter dem Antwortkasten steht: „gesehen bis" bei Favoriten, dann die Neuigkeiten des Titels. */
export function UnterDerAntwort({ data, title, favorites }: { data: Dataset; title: Title; favorites: Set<number> }) {
  return (
    <>
      {favorites.has(title.id) && <Fortschritt data={data} titelId={title.id} />}
      <Neuigkeiten data={data} titelId={title.id} />
    </>
  )
}
