import { hauptstaffeln } from '../../shared/titles.ts'

export type QuellenGlied = { id: number; name: string; format?: string; beiwerk?: boolean; eigenesWerk?: boolean; episodes?: number; staffelQuelle?: number }

export type QuellenWiderspruch = { staffel: number; ids: number[]; namen: string[] }

/**
 * Zwei Hauptstaffeln derselben Reihe, die beide eine belegte deutsche Staffelnummer (`staffelQuelle`) tragen, tragen dieselbe: einer von beiden
 * irrt. Der häufige Grund: aniSearch zählt „(Staffel 2)“ innerhalb einer Unterserie (Tokyo Ghoul:re 2), die Reihe zählt anders.
 * `erlaubt` sind Einträge, deren Doppelung belegt ist (Pokémon: beide laut TMDB in Staffel 16, `data/curated/pokemon-staffeln.yaml`).
 */
export function staffelQuellenWidersprueche(reihe: QuellenGlied[], erlaubt: Set<number>): QuellenWiderspruch[] {
  const jeStaffel = new Map<number, QuellenGlied[]>()
  for (const m of hauptstaffeln(reihe)) {
    if (m.staffelQuelle === undefined || erlaubt.has(m.id)) continue
    jeStaffel.set(m.staffelQuelle, [...(jeStaffel.get(m.staffelQuelle) ?? []), m])
  }
  return [...jeStaffel]
    .filter(([, ms]) => ms.length > 1)
    .map(([staffel, ms]) => ({ staffel, ids: ms.map((m) => m.id), namen: ms.map((m) => m.name) }))
}
