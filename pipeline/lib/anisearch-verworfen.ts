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
export function ohneVerworfeneSeiten<T extends { anisearchId?: number }>(zuordnung: Record<string, T>, verworfen: Verworfene): Record<string, T> {
  const weg = new Set(Object.values(verworfen).filter((v) => v.anilist !== undefined).map((v) => `${v.anilist}:${v.anisearch}`))
  return Object.fromEntries(Object.entries(zuordnung).filter(([anilist, e]) => !weg.has(`${anilist}:${e.anisearchId}`)))
}
