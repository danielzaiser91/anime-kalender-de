import { readJson } from './util.ts'

/**
 * Die Katalogtitel, die der Abgleich einer aniSearch-Kennung zugeordnet hat (`data/anisearch-ids-katalog.json`, geschrieben von
 * `fetch-anisearch-katalog-abgleich.ts`): Paare AniList-Kennung → aniSearch-Kennung. Die Handdatei gilt vor ihnen, deshalb stehen sie in
 * den Leseschleifen vor ihr.
 */
export function anisearchKatalogPaare(): [number, number][] {
  return Object.entries(readJson<Record<string, number>>('data/anisearch-ids-katalog.json', {})).map(([anilist, anisearch]) => [Number(anilist), anisearch])
}
