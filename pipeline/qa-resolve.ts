/**
 * Hilfsskript: zeigt, worauf jeder kuratierte Eintrag aufgelöst wurde, und
 * markiert Verdachtsfälle (Jahr passt nicht zum deutschen Termin).
 * Aufruf: npx tsx pipeline/qa-resolve.ts [Suchbegriff]
 */
import { searchMedia, type AniListMedia } from './lib/anilist.ts'
import { loadCurated } from './lib/curated.ts'
import { readJson } from './lib/util.ts'

const term = process.argv.slice(2).join(' ')

if (term) {
  const hit = await searchMedia(term)
  console.log(hit ? `${hit.id} · ${hit.title.romaji} (${hit.startDate?.year}) · ${hit.format}` : 'kein Treffer')
} else {
  const curated = loadCurated()
  const ids = readJson<Record<string, number>>('data/curated-ids.json', {})
  const byId = readJson<Record<string, AniListMedia>>('data/cache/anilist-by-id.json', {})

  for (const entry of curated) {
    const id = entry.anilistId ?? ids[entry.slug]
    const media = id ? byId[String(id)] : undefined
    const releaseYear = Number(entry.schedule?.firstEpisodeDate?.slice(0, 4) ?? 0)
    const jpYear = media?.startDate?.year ?? 0
    const suspicious = media && jpYear && releaseYear && Math.abs(jpYear - releaseYear) > 1
    const flag = !media ? '✖ NICHT AUFGELÖST' : suspicious ? '⚠ Jahr weicht ab' : '  ok'
    console.log(
      `${flag}  ${entry.slug.padEnd(42)} → ${media ? `${media.id} ${media.title.romaji} (${jpYear}, ${media.episodes ?? '?'} Ep)` : '—'}`,
    )
  }
}
