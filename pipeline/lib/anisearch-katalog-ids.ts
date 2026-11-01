import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './util.ts'
import { ladeAnisearchAbruf, ladeAnisearchKatalog } from './anisearch-verworfen.ts'

/**
 * Die Katalogtitel, die der Abgleich einer aniSearch-Kennung zugeordnet hat (`data/anisearch-ids-katalog.json`, geschrieben von
 * `fetch-anisearch-katalog-abgleich.ts`): Paare AniList-Kennung → aniSearch-Kennung. Die Handdatei gilt vor ihnen, deshalb stehen sie in
 * den Leseschleifen vor ihr.
 */
export function anisearchKatalogPaare(): [number, number][] {
  return Object.entries(ladeAnisearchKatalog()).map(([anilist, anisearch]) => [Number(anilist), anisearch])
}

/** Unsere Titel-Kennung → aniSearch-Kennung: Abruf-Ergebnis (`data/anisearch.json`), Katalogabgleich, darüber die Handdatei (`data/anisearch-ids-hand.yaml`). */
export function anisearchBruecke(): Map<string, string> {
  const bruecke = new Map<string, string>()
  for (const [id, e] of Object.entries(ladeAnisearchAbruf<{ anisearchId?: number }>())) if (e.anisearchId) bruecke.set(id, String(e.anisearchId))
  for (const [id, asId] of anisearchKatalogPaare()) bruecke.set(String(id), String(asId))
  for (const m of readFileSync(resolve(ROOT, 'data/anisearch-ids-hand.yaml'), 'utf8').matchAll(/^(\d+):\s*(\d+)/gm)) bruecke.set(m[1]!, m[2]!)
  return bruecke
}
