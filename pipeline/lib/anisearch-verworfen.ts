import { readJson } from './util.ts'

/** Ein von Hand verworfenes Paar der aniSearch-Brücke (`data/anisearch-mal-verworfen.json`, Schlüssel = MAL-Kennung). `anilist` nur, wenn `anisearch.json` die Seite demselben AniList-Titel zuordnet. */
export type VerworfenesPaar = { anisearch: number; anilist?: number; grund: string }
export type Verworfene = Record<string, VerworfenesPaar>

export const ladeVerworfene = (lies: typeof readJson = readJson): Verworfene => lies<Verworfene>('data/anisearch-mal-verworfen.json', {})

/** Streicht die verworfenen MAL-Paare aus der Brücke MAL → aniSearch; die Abrufdatei wird täglich überschrieben, die Streichung steht daneben. */
export function ohneVerworfene(paare: Record<string, number>, verworfen: Verworfene): Record<string, number> {
  return Object.fromEntries(Object.entries(paare).filter(([mal, as]) => verworfen[mal]?.anisearch !== as))
}

/** Streicht aus einer Zuordnung AniList-Kennung → Eintrag mit `anisearchId` jede verworfene Seite dieses Titels; ein anderer Titel auf derselben Seite bleibt. */
export function ohneVerworfeneSeiten<T extends object>(zuordnung: Record<string, T>, verworfen: Verworfene): Record<string, T> {
  const weg = new Set(Object.values(verworfen).filter((v) => v.anilist !== undefined).map((v) => `${v.anilist}:${v.anisearch}`))
  return Object.fromEntries(Object.entries(zuordnung).filter(([anilist, e]) => !weg.has(`${anilist}:${(e as { anisearchId?: number }).anisearchId}`)))
}

/** `data/anisearch-mal.json` ohne die verworfenen MAL-Paare — der Weg für jeden Leser der Brücke (Bau und Katalogabgleich). */
export function ladeAnisearchMal(lies: typeof readJson = readJson): Record<string, number> {
  return ohneVerworfene(lies<Record<string, number>>('data/anisearch-mal.json', {}), ladeVerworfene(lies))
}

/** `data/anisearch-ids-katalog.json` (AniList → aniSearch) ohne die verworfenen Seiten des jeweiligen AniList-Titels. */
export function ladeAnisearchKatalog(lies: typeof readJson = readJson): Record<string, number> {
  const roh = lies<Record<string, number>>('data/anisearch-ids-katalog.json', {})
  const frei = ohneVerworfeneSeiten(Object.fromEntries(Object.entries(roh).map(([anilist, anisearchId]) => [anilist, { anisearchId }])), ladeVerworfene(lies))
  return Object.fromEntries(Object.entries(frei).map(([anilist, e]) => [anilist, e.anisearchId]))
}

/** `data/anisearch.json` ohne die verworfenen Seiten — der einzige Weg, die Datei im Bau zu lesen (jeder Leser sieht dieselbe Zuordnung). */
export function ladeAnisearchAbruf<T extends object>(lies: typeof readJson = readJson): Record<string, T> {
  return ohneVerworfeneSeiten(lies<Record<string, T>>('data/anisearch.json', {}), ladeVerworfene(lies))
}
