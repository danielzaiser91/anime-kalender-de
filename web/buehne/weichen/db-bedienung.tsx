import { useContext, type ComponentProps } from 'react'
import { DbLeer as EchtesLeer, DbRaster as EchtesRaster } from '../../src/components/db-bedienung.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Alles andere aus `db-bedienung.tsx` bleibt, wie es ist; austauschbar sind das Kachelraster und die Leer-Anzeige. */
export { MehrKnopf } from '../../src/components/db-bedienung.tsx'

export function DbRaster(eigenschaften: ComponentProps<typeof EchtesRaster>) {
  const Raster = useContext(ErsatzKontext).DbRaster ?? EchtesRaster
  return <Raster {...eigenschaften} />
}

export function DbLeer(eigenschaften: ComponentProps<typeof EchtesLeer>) {
  const Leer = useContext(ErsatzKontext).DbLeer ?? EchtesLeer
  return <Leer {...eigenschaften} />
}
