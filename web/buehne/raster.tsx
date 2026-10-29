import type { CSSProperties } from 'react'
import { GROESSE, geraeteFuer } from './geraete.ts'
import type { MockupDef } from './register.ts'
import type { Zustand } from './zustand.ts'

/** Adresse einer Zelle: dieselbe Seite im Zellen-Modus (siehe `start.ts`) — eigener Rahmen, also echte Breite und echtes Thema. */
function zellenAdresse(z: Zustand, thema: 'hell' | 'dunkel', variante: string): string {
  const w = new URLSearchParams({ mockup: z.mockup, v: variante, fall: z.fall, thema })
  if (z.zeit) w.set('zeit', z.zeit)
  return `${location.pathname}#zelle?${w}`
}

/** Das Raster: Gerät × Thema × (Vorher, Nachher) nebeneinander, jede Zelle ein Rahmen mit dem echten Panel. */
export function Raster({ def, zustand, ersteVariante }: { def: MockupDef; zustand: Zustand; ersteVariante: string }) {
  const geraete = zustand.geraet === 'beide' ? geraeteFuer(def.ausschnitt) : ([zustand.geraet] as const)
  const themen = zustand.thema === 'beide' ? (['hell', 'dunkel'] as const) : ([zustand.thema] as const)
  const teile = zustand.teil === 'beide' ? (['vorher', 'nachher'] as const) : ([zustand.teil] as const)
  const variante = zustand.variante || ersteVariante
  return (
    <div className="raster">
      {geraete.flatMap((g) =>
        themen.flatMap((thema) =>
          teile.map((teil) => {
            const adresse = zellenAdresse(zustand, thema, teil === 'vorher' ? '' : variante)
            return (
              <figure key={adresse + g} className="zelle" style={{ '--hoehe': `${GROESSE[g].hoehe}px` } as CSSProperties}>
                <figcaption>{teil === 'vorher' ? 'Vorher' : `Nachher (${variante})`} · {GROESSE[g].name} · {thema}</figcaption>
                <iframe title={`${teil} ${g} ${thema}`} src={adresse} width={GROESSE[g].breite} data-zelle={`${teil}-${g}-${thema}`} />
              </figure>
            )
          }),
        ),
      )}
    </div>
  )
}
