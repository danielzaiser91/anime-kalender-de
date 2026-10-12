import type { Title } from '@shared/types.ts'
import { istOhneBelegteSynchro } from './titel-sortierung.ts'

/** Alle Titel, die die Datenbank gerade führt — vor dem Filter. */
export function titelQuelle(kern: Title[], alle: Title[] | undefined, ohneSynchro: Title[] | undefined, zeigeOhne: boolean, cartoons: Title[] | undefined): Title[] {
  const basis = (alle ?? kern).filter((t) => zeigeOhne || !istOhneBelegteSynchro(t))
  /* Eine Kennung steht nur einmal in der Liste: doppelte Schlüssel ließen Kacheln beim Filtern als Geister im Raster stehen (Beerus, Fool Night). */
  const bekannt = new Set(basis.map((t) => t.id))
  const mitOhne = zeigeOhne && ohneSynchro ? [...basis, ...ohneSynchro.filter((t) => !bekannt.has(t.id))] : basis
  return cartoons ? [...mitOhne, ...cartoons.filter((t) => !bekannt.has(t.id))] : mitOhne
}
