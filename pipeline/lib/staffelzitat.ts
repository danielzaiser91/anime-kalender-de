/**
 * Staffelzitat-Wächter: Ein Anime2You-Zitat in `zweiteQuelle`, das eine Staffel nennt, darf nicht an einer Adresse stehen, die eine andere Staffel zeigt
 * (115740 trug „erste Staffel“ an Staffel-2-Adressen, 18.11.2026). Die Regel steht in `tools/anime2you-staffel.mjs` (`pruefeStaffel`), hier nur die Schleife über den Bestand.
 */
import { pruefeStaffel } from '../../tools/anime2you-staffel.mjs'

interface Zeile {
  anilistId: number
  url?: string
  note?: string
  zweiteQuelle?: string
}

export interface Staffelverstoss {
  id: number
  url: string
  grund: string
}

/** Titel mit bekanntem Fund, den ein eigener Daten-PR klärt; die Liste darf nur sinken. */
export const STAFFELZITAT_BEKANNT = new Set<number>([9367])

/** Zeilen mit Anime2You-Zitat, deren Zitat laut `pruefeStaffel` eine andere Staffel nennt als die Adresse (Urteil „abweichung“); „unbekannt“ zählt nicht. */
export function staffelzitatVerstoesse(zeilen: Zeile[], folgenJeId: Map<number, number | null>): Staffelverstoss[] {
  const out: Staffelverstoss[] = []
  for (const z of zeilen) {
    if (typeof z.zweiteQuelle !== 'string' || !z.zweiteQuelle.startsWith('Anime2You')) continue
    const urteil = pruefeStaffel(z.zweiteQuelle, z.note, folgenJeId.get(z.anilistId) ?? null)
    if (urteil.urteil === 'abweichung') out.push({ id: z.anilistId, url: z.url ?? '', grund: urteil.grund })
  }
  return out
}
