import { useContext } from 'react'
import { DbKopfbereich as EchterKopf, type DbKopfProps } from '../../src/components/filter/DbWerkzeug.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Über dem Raster der Datenbank (Schalter, Zählzeile bzw. Werkzeugleiste): austauschbar. */
export function DbKopfbereich(eigenschaften: DbKopfProps) {
  const Kopf = useContext(ErsatzKontext).DbKopfbereich ?? EchterKopf
  return <Kopf {...eigenschaften} />
}
