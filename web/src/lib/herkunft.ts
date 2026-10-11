import type { Title } from '@shared/types.ts'

/**
 * **Die Herkunft eines Titels für den Filter** (Mockup „Herkunftsfilter" B, 09.10.2026).
 * Land = Produktionsland laut AniList (`land`, nur gesetzt, wo es nicht Japan ist) bzw. TMDB bei Cartoons.
 * `US` steht für „USA & Co.": jedes andere Land als die vier Asien-Gruppen. `XX` = unbekannt.
 */
export type Herkunft = 'JP' | 'KR' | 'CN' | 'TW' | 'US' | 'XX'

export const HERKUENFTE: Herkunft[] = ['JP', 'KR', 'CN', 'TW', 'US', 'XX']

/**
 * AniList-Kennungen ab hier (aniSearch) und Cartoons (negativ) haben ohne `land` keine AniList-Auskunft — nicht als Japan zählen.
 * Die ausgelieferte `id` ist unsere eigene Kennung; die AniList-Kennung steht in `al` (Cartoons haben keine).
 */
const ANISEARCH_ID_BASIS = 10_000_000

export function herkunftVon(t: Title): Herkunft {
  if (t.land === 'JP' || t.land === 'KR' || t.land === 'CN' || t.land === 'TW') return t.land
  if (t.land) return 'US'
  const anilist = t.al ?? t.id
  return anilist >= ANISEARCH_ID_BASIS || anilist < 0 ? 'XX' : 'JP'
}

/** Titel je Herkunft; nur Herkünfte mit mindestens einem Titel stehen in der Map. */
export function zaehleHerkunft(titel: Iterable<Title | undefined>): Map<Herkunft, number> {
  const z = new Map<Herkunft, number>()
  for (const t of titel) {
    if (!t) continue
    const h = herkunftVon(t)
    z.set(h, (z.get(h) ?? 0) + 1)
  }
  return z
}
