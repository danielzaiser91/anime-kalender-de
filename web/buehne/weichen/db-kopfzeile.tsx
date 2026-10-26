import { useContext, type ComponentProps } from 'react'
import { DbKopfzeile as EchteKopfzeile } from '../../src/components/db-kopfzeile.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Alles andere aus `db-kopfzeile.tsx` bleibt, wie es ist; ausgetauscht werden kann die Trefferzeile („0 Ergebnisse für …“). */
export * from '../../src/components/db-kopfzeile.tsx'

export function DbKopfzeile(eigenschaften: ComponentProps<typeof EchteKopfzeile>) {
  const Kopfzeile = useContext(ErsatzKontext).DbKopfzeile ?? EchteKopfzeile
  return <Kopfzeile {...eigenschaften} />
}
