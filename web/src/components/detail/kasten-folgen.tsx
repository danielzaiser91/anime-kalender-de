import type { ComponentProps } from 'react'
import { AntwortKastenMitMarke } from './kasten-marke.tsx'

/**
 * Die Folgenliste löst sich vom roten Kasten (Daniel, 27.10.2026, F96): Der Kasten endet mit dem Disc-Bereich, die
 * Folgenliste steht darunter in einer eigenen Karte. Ohne Folgenliste bleibt die Karte leer und verschwindet (`empty:hidden`).
 */
export function KastenMitFolgenKarte({ folgen, ...kasten }: ComponentProps<typeof AntwortKastenMitMarke>) {
  return (
    <>
      <AntwortKastenMitMarke {...kasten} />
      <div className="mt-2 rounded-xl border border-ak-linie px-3 py-1 empty:hidden [&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0" data-folgen-karte>
        {folgen}
      </div>
    </>
  )
}
