import { readJson } from './util.ts'

/**
 * **Die Titelseite bei aniSearch, so wie aniSearch sie verlangt** (Dominik, 06.10.2026: Quellenlinks an übernommenen Beschreibungen
 * führen direkt auf die Titelseite, in der kanonischen Form mit Slug — sonst wird jeder Besucher einmal umgeleitet).
 * Die Slugs holt `fetch-anisearch-slugs.ts` aus `/v1/anime/slugs` nach `data/anisearch-slugs.json` (Kennung → Slug).
 * Ohne Slug gilt `/anime/<Kennung>`. **Ohne Kennung gibt es keine Adresse** — nie eine Suche (Daniel, 09.10.2026).
 */
let slugs: Record<string, string> | undefined

export function anisearchSeite(asId: number | undefined): string | undefined {
  if (asId === undefined || !Number.isFinite(asId)) return undefined
  slugs ??= readJson<Record<string, string>>('data/anisearch-slugs.json', {})
  const slug = slugs[String(asId)]
  return `https://www.anisearch.de/anime/${asId}${slug ? `,${slug}` : ''}`
}

/** Eine aniSearch-Adresse mit Kennung (aus dem Beschreibungstext) in die kanonische Form mit Slug bringen; alles andere bleibt. */
export function anisearchKanonisch(url: string): string {
  const treffer = /^(https?:\/\/(?:www\.)?anisearch\.de)\/anime\/(\d+)(?:,[^/?#]*)?\/?$/.exec(url)
  return (treffer && anisearchSeite(Number(treffer[2]))) || url
}
