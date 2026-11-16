import type { Title } from '../../shared/types.ts'

/** Der Titel hat Streams, aber an keinem ist ein Sprachurteil (`dub`) gesetzt. Eine Formel für `check-qualitaet.ts` und das Mängel-Register. */
export function ohneSprachurteil(t: Pick<Title, 'streams'>): boolean {
  const s = t.streams ?? []
  return s.length > 0 && s.every((x) => x.dub === undefined)
}
