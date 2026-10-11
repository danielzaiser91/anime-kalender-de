import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { ARCHIV_SEITEN } from './anisearch-relationen.ts'
import { readJson } from './util.ts'

/**
 * **Woher ein Cover kommt** (Daniel, 10.10.2026: „Cover TMDB → aniSearch", nicht mehr von AniList): zuerst das TMDB-Plakat des Titels
 * (`data/tmdb-poster.json`), sonst das aniSearch-Cover aus der Kennung, sonst keines (die Oberfläche zeigt dann den Platzhalter).
 *
 * Die aniSearch-Adresse folgt einem festen Muster (`cover/<Kennung ÷ 1000>/<Kennung>_600.webp`, `_400` für kleine Kacheln); es passt auf 99,3 % der
 * archivierten Seiten (11.10.2026: 17.224 von 17.466). Die übrigen Seiten zeigen einen Altersschutz-Platzhalter (`ecchi.v1_600`, `hentai.v1_600`) oder
 * `0_600` (kein Cover); deren Kennungen liest `anisearchOhneCover` aus dem Archiv, für sie gilt „keins". Eine Kennung ohne archivierte Seite gilt als bildbar.
 */
export const ANISEARCH_BILD = 'https://cdn.anisearch.de/images/anime/cover'
const TMDB_BILD = 'https://image.tmdb.org/t/p/w500'

export type CoverQuellen = {
  /** Titelkennung → TMDB-Plakat (`null`: TMDB kennt keins). */
  tmdb: Record<string, { p: string } | null>
  /** aniSearch-Kennungen, deren Seite kein echtes Cover zeigt. */
  anisearchOhne: Set<number>
}

export const anisearchCoverUrl = (anisearchId: number): string => `${ANISEARCH_BILD}/${Math.floor(anisearchId / 1000)}/${anisearchId}_600.webp`

/** Die Adresse für einen Titel nach der Regel; `undefined`, wenn keine Quelle ein Cover führt. */
export function coverNachRegel(titelId: number, anisearchId: number | undefined, q: CoverQuellen): string | undefined {
  const plakat = q.tmdb[String(titelId)]
  if (plakat?.p) return `${TMDB_BILD}${plakat.p}`
  if (anisearchId !== undefined && !q.anisearchOhne.has(anisearchId)) return anisearchCoverUrl(anisearchId)
  return undefined
}

/** Zeigt die Seite ein eigenes Cover? Nur wo sie einen Platzhalter nennt (`cover/<Name>_600.webp` ohne Ordner), lautet die Antwort nein. */
export function seiteOhneCover(html: string, anisearchId: number): boolean {
  if (html.includes(`/${anisearchId}_600.webp`)) return false
  return /images\/anime\/cover\/[^/"' )]+_600\.webp/.test(html)
}

/** Kennungen der archivierten Seiten ohne eigenes Cover (rund 3,5 s für 17.000 Seiten). */
export function anisearchOhneCover(dir = ARCHIV_SEITEN): Set<number> {
  const ohne = new Set<number>()
  if (!existsSync(dir)) return ohne
  for (const datei of readdirSync(dir)) {
    const id = Number(datei.split('.')[0])
    if (Number.isFinite(id) && seiteOhneCover(gunzipSync(readFileSync(`${dir}/${datei}`)).toString('utf8'), id)) ohne.add(id)
  }
  return ohne
}

export const ladeCoverQuellen = (): CoverQuellen => ({
  tmdb: readJson<CoverQuellen['tmdb']>('data/tmdb-poster.json', {}),
  anisearchOhne: anisearchOhneCover(),
})
