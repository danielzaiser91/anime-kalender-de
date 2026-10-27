import { useContext } from 'react'
import { discZeilen as echteDiscZeilen } from '../../src/components/detail/wege-zeilen.tsx'
import { ErsatzKontext, type DiscBereichEigenschaften } from '../ersatz.tsx'

export { streamZeilen, terminPillen } from '../../src/components/detail/wege-zeilen.tsx'

/** Zeigt den Ersatz des Mockups, sonst die echten Disc-Zeilen (die Zählung `disc.length` bleibt wie auf der Seite: 0 oder nicht 0). */
function DiscWeiche(eigenschaften: DiscBereichEigenschaften) {
  const Ersatz = useContext(ErsatzKontext).DiscBereich
  return Ersatz ? <Ersatz {...eigenschaften} /> : <>{echteDiscZeilen(eigenschaften)}</>
}

/** Wie `discZeilen()` der Seite, nur als ein Knoten — leer bleibt leer, damit der Umschalter „Disc“ nicht grundlos erscheint. */
export function discZeilen(eigenschaften: DiscBereichEigenschaften) {
  if (!echteDiscZeilen(eigenschaften).length) return []
  return [<DiscWeiche key="disc-weiche" {...eigenschaften} />]
}
