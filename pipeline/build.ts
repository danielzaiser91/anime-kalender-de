/**
 * Setzt aus Cache + kuratierten Daten die Dateien zusammen, die die Web-App lädt.
 * Ausgabe landet in public/data/ und wird mit ins Repo committet.
 */
import type { AniListMedia } from './lib/anilist.ts'
import { loadCurated, type CuratedEntry } from './lib/curated.ts'
import type { TmdbInfo } from './lib/tmdb.ts'
import { log, readJson, slugify, warn, writeJson, writeText } from './lib/util.ts'
import type {
  DataMeta,
  DubConfidence,
  PlatformId,
  Release,
  ReleaseEvent,
  StreamLink,
  Title,
} from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { buildIcs } from '../shared/ics.ts'
import {
  GENRE_DE,
  KEYWORD_BLOCKLIST,
  KEYWORD_DE,
  PLATFORM_PRIORITY,
  amazonSearchUrl,
  germanizeUrl,
  platformFromSite,
} from '../shared/mappings.ts'

const OUT = 'public/data'
const KEYWORD_MIN_RANK = 55
const KEYWORD_MAX = 14

function cleanSynopsis(raw: string | null): string | undefined {
  if (!raw) return undefined
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mapGenres(genres: string[]): string[] {
  return genres.map((g) => GENRE_DE[g] ?? g)
}

function mapKeywords(media: AniListMedia): string[] {
  return (media.tags ?? [])
    .filter((t) => !t.isMediaSpoiler && !t.isAdult && t.rank >= KEYWORD_MIN_RANK)
    .filter((t) => !KEYWORD_BLOCKLIST.has(t.name))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, KEYWORD_MAX)
    .map((t) => KEYWORD_DE[t.name] ?? t.name)
}

function mapStreams(media: AniListMedia): StreamLink[] {
  const out: StreamLink[] = []
  for (const link of media.externalLinks ?? []) {
    if (link.type !== 'STREAMING') continue
    const platform = platformFromSite(link.site)
    if (!platform) continue
    if (out.some((s) => s.platform === platform)) continue
    out.push({ platform, url: germanizeUrl(platform, link.url) })
  }
  return out.sort(
    (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
  )
}

function titleFromMedia(media: AniListMedia, confidence: DubConfidence): Title {
  const display = media.title.english ?? media.title.romaji ?? media.title.native ?? `#${media.id}`
  return {
    id: media.id,
    malId: media.idMal ?? undefined,
    slug: `${slugify(display)}-${media.id}`,
    titleRomaji: media.title.romaji ?? undefined,
    titleEn: media.title.english ?? undefined,
    titleNative: media.title.native ?? undefined,
    format: media.format ?? undefined,
    episodes: media.episodes ?? undefined,
    jpYear: media.seasonYear ?? media.startDate?.year ?? undefined,
    jpSeason: media.season ?? undefined,
    genres: mapGenres(media.genres ?? []),
    keywords: mapKeywords(media),
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
    bannerImage: media.bannerImage ?? undefined,
    synopsis: cleanSynopsis(media.description),
    studios: (media.studios?.nodes ?? []).filter((s) => s.isAnimationStudio !== false).map((s) => s.name).slice(0, 3),
    score: media.averageScore ?? undefined,
    dubConfidence: confidence,
    streams: mapStreams(media),
  }
}

function pickPlatformUrl(entry: CuratedEntry, title: Title | undefined): string | undefined {
  if (entry.platformUrl) return entry.platformUrl
  const match = title?.streams.find((s) => s.platform === entry.platform)
  return match?.url
}

function main(): void {
  const confidenceRaw = readJson<Record<string, DubConfidence>>('data/cache/dub-confidence.json', {})
  const byMal = readJson<Record<string, AniListMedia>>('data/cache/anilist-media.json', {})
  const byAniId = readJson<Record<string, AniListMedia>>('data/cache/anilist-by-id.json', {})
  const curatedIds = readJson<Record<string, number>>('data/curated-ids.json', {})
  const tmdb = readJson<Record<string, TmdbInfo>>('data/cache/tmdb.json', {})
  const curated = loadCurated()

  // --- Titel aufbauen -------------------------------------------------------
  const titles = new Map<number, Title>()

  for (const [malId, media] of Object.entries(byMal)) {
    if (!media?.id) continue
    if (media.isAdult) continue
    const confidence = confidenceRaw[malId] ?? 'low'
    titles.set(media.id, titleFromMedia(media, confidence))
  }

  // Kuratierte Titel können auf AniList-Einträge zeigen, die nicht über MyDubList kamen.
  for (const media of Object.values(byAniId)) {
    if (!media?.id || titles.has(media.id)) continue
    const confidence = media.idMal ? (confidenceRaw[media.idMal] ?? 'normal') : 'normal'
    titles.set(media.id, titleFromMedia(media, confidence))
  }

  // --- Releases aufbauen ----------------------------------------------------
  const releases: Release[] = []
  const seenSlugs = new Set<string>()

  for (const entry of curated) {
    if (seenSlugs.has(entry.slug)) {
      warn(`Doppelter Slug "${entry.slug}" — zweiter Eintrag ignoriert`)
      continue
    }
    if (!entry.schedule?.firstEpisodeDate) {
      warn(`"${entry.slug}" hat kein firstEpisodeDate — übersprungen`)
      continue
    }
    seenSlugs.add(entry.slug)

    const titleId = entry.anilistId ?? curatedIds[entry.slug]
    const title = titleId ? titles.get(titleId) : undefined
    if (!title) warn(`"${entry.slug}": kein AniList-Titel verknüpft — läuft ohne Metadaten`)

    const info = tmdb[entry.slug]
    const schedule = { ...entry.schedule }
    const releaseYear = Number(entry.schedule.firstEpisodeDate.slice(0, 4))
    if (!schedule.episodeCount && entry.releaseType === 'weekly') {
      // Folgenzahl nur übernehmen, wenn der verknüpfte AniList-Eintrag zeitlich
      // zum deutschen Termin passt — sonst stammt sie aus der falschen Staffel.
      const jpYear = title?.jpYear
      if (title?.episodes && jpYear && Math.abs(jpYear - releaseYear) <= 1) {
        schedule.episodeCount = title.episodes
      } else if (title?.episodes) {
        warn(
          `"${entry.slug}": Folgenzahl von AniList verworfen (Titel von ${jpYear}, Release ${releaseYear})`,
        )
      }
      // Ohne belegte Folgenzahl wird eine Standardstaffel angenommen — das steht
      // als Flag im Datensatz, damit die Oberfläche es nicht als Fakt ausgibt.
      if (!schedule.episodeCount) {
        schedule.episodeCount = 12
        schedule.episodeCountAssumed = true
      }
    }

    const name = entry.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? entry.slug
    const fsk = entry.fsk ?? info?.fsk ?? title?.fsk

    if (title && fsk !== undefined && title.fsk === undefined) title.fsk = fsk
    if (title && entry.titleDe && !title.titleDe) title.titleDe = entry.titleDe

    releases.push({
      slug: entry.slug,
      titleId: titleId ?? -1,
      name,
      platform: entry.platform,
      platformUrl: pickPlatformUrl(entry, title),
      buyUrl:
        entry.buyUrl ?? (entry.releaseType === 'disc' ? amazonSearchUrl(name) : undefined),
      releaseType: entry.releaseType,
      fsk,
      publisher: entry.publisher,
      edition: entry.edition,
      note: entry.note,
      schedule,
      year: releaseYear,
      sources: entry.sources ?? [],
    })
  }

  // --- Termine ausrollen ----------------------------------------------------
  const events: ReleaseEvent[] = releases
    .flatMap(expandEvents)
    .sort((a, b) => (a.date === b.date ? (a.time ?? '99') .localeCompare(b.time ?? '99') : a.date.localeCompare(b.date)))

  // --- Meta -----------------------------------------------------------------
  const allTitles = [...titles.values()]
  const genres = [...new Set(allTitles.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b, 'de'))
  const keywords = [...new Set(allTitles.flatMap((t) => t.keywords))].sort((a, b) => a.localeCompare(b, 'de'))
  const platforms = [...new Set(releases.map((r) => r.platform))] as PlatformId[]
  const years = [...new Set(releases.map((r) => r.year))].sort((a, b) => b - a)

  const meta: DataMeta = {
    generatedAt: new Date().toISOString(),
    titleCount: allTitles.length,
    releaseCount: releases.length,
    eventCount: events.length,
    genres,
    keywords,
    platforms,
    years,
    attribution: [
      'Dub-Daten: MyDubList (https://mydublist.com) — CC BY 4.0',
      'Metadaten: AniList (https://anilist.co)',
      'FSK & Anbieter: TMDB (https://www.themoviedb.org)',
      'Termine: aniSearch, Anime2You — siehe Quellenangabe je Eintrag',
    ],
  }

  // --- Schreiben ------------------------------------------------------------
  // Synopsen liegen getrennt, damit die Startseite nicht Megabytes laden muss.
  const synopses: Record<number, string> = {}
  const slim = allTitles.map((t) => {
    if (t.synopsis) synopses[t.id] = t.synopsis
    const { synopsis: _drop, ...rest } = t
    return rest
  })

  // Der Kalender braucht nur die Titel, zu denen es einen Termin gibt. Die
  // vollständige Liste (mehrere Megabyte) lädt erst die Datenbank-Ansicht nach.
  const referenced = new Set(releases.map((r) => r.titleId))
  writeJson(`${OUT}/titles-core.json`, slim.filter((t) => referenced.has(t.id)))
  writeJson(`${OUT}/titles.json`, slim)
  writeJson(`${OUT}/synopses.json`, synopses)
  writeJson(`${OUT}/releases.json`, releases)
  writeJson(`${OUT}/events.json`, events)
  writeJson(`${OUT}/meta.json`, meta, true)

  // --- ICS-Abo-Feeds --------------------------------------------------------
  const siteUrl = process.env.SITE_URL ?? 'https://danielzaiser91.github.io/anime-kalender-de/'
  writeText(`${OUT}/feeds/all.ics`, buildIcs(events, { siteUrl, calendarName: 'Anime-Kalender DE' }))

  for (const platform of platforms) {
    const subset = events.filter((e) => e.platform === platform)
    if (!subset.length) continue
    writeText(
      `${OUT}/feeds/platform-${platform}.ics`,
      buildIcs(subset, { siteUrl, calendarName: `Anime-Kalender DE – ${platform}` }),
    )
  }

  const titleById = new Map(allTitles.map((t) => [t.id, t]))
  for (const genre of genres) {
    const subset = events.filter((e) => titleById.get(e.titleId)?.genres.includes(genre))
    if (subset.length < 3) continue
    writeText(
      `${OUT}/feeds/genre-${slugify(genre)}.ics`,
      buildIcs(subset, { siteUrl, calendarName: `Anime-Kalender DE – ${genre}` }),
    )
  }

  log(`Titel: ${meta.titleCount}`)
  log(`Releases: ${meta.releaseCount}`)
  log(`Termine: ${meta.eventCount}`)
  log(`Genres: ${genres.length}, Keywords: ${keywords.length}`)
}

main()
