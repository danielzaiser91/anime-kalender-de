/**
 * Setzt aus Cache + kuratierten Daten die Dateien zusammen, die die Web-App lädt.
 * Ausgabe landet in public/data/ und wird mit ins Repo committet.
 */
import type { AniListMedia } from './lib/anilist.ts'
import {
  crunchyrollSeriesId,
  normalizeTitle,
  type CrunchyrollData,
  type CrunchyrollEntry,
} from './lib/crunchyroll.ts'
import { loadCurated, type CuratedEntry } from './lib/curated.ts'
import type { TmdbInfo } from './lib/tmdb.ts'
import { clearDir, log, readJson, slugify, warn, writeJson, writeText } from './lib/util.ts'
import type {
  DataMeta,
  DubConfidence,
  Fsk,
  PlatformId,
  Release,
  ReleaseEvent,
  StreamLink,
  Title,
} from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { addDays, weekdayIndex } from '../shared/time.ts'
import { buildIcs } from '../shared/ics.ts'
import {
  KEYWORD_BLOCKLIST,
  PLATFORM_PRIORITY,
  TAG_AS_GENRE,
  TAG_AS_GENRE_MIN_RANK,
  amazonSearchUrl,
  isUnusablePrimeLink,
  primeVideoSearchUrl,
  germanizeUrl,
  platformFromSite,
} from '../shared/mappings.ts'

const OUT = 'public/data'
const KEYWORD_MIN_RANK = 55
const KEYWORD_MAX = 24
const CR_CALENDAR_URL = 'https://www.crunchyroll.com/de/simulcastcalendar'

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

/**
 * Genres bleiben im Datensatz englisch — übersetzt wird erst in der
 * Oberfläche, sonst könnte sie nicht zwischen Sprachen umschalten.
 * Prägende Tags wie „Isekai" zählen mit als Genre.
 */
function mapGenres(media: AniListMedia): string[] {
  const fromTags = (media.tags ?? [])
    .filter((t) => !t.isMediaSpoiler && !t.isAdult && t.rank >= TAG_AS_GENRE_MIN_RANK)
    .filter((t) => t.name in TAG_AS_GENRE)
    .map((t) => t.name)
  return [...new Set([...(media.genres ?? []), ...fromTags])]
}

function mapKeywords(media: AniListMedia): string[] {
  return (media.tags ?? [])
    .filter((t) => !t.isMediaSpoiler && !t.isAdult && t.rank >= KEYWORD_MIN_RANK)
    .filter((t) => !KEYWORD_BLOCKLIST.has(t.name))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, KEYWORD_MAX)
    .map((t) => t.name)
}

function isoDate(d: { year: number | null; month: number | null; day: number | null } | undefined) {
  if (!d?.year) return undefined
  const p = (n: number | null, fallback: string) => (n ? String(n).padStart(2, '0') : fallback)
  return `${d.year}-${p(d.month, '12')}-${p(d.day, '31')}`
}

function mapStreams(media: AniListMedia): StreamLink[] {
  const out: StreamLink[] = []
  const displayTitle = media.title.english ?? media.title.romaji ?? ''

  for (const link of media.externalLinks ?? []) {
    if (link.type !== 'STREAMING') continue
    const platform = platformFromSite(link.site)
    if (!platform) continue
    if (out.some((s) => s.platform === platform)) continue

    // Prime Video läuft grundsätzlich über amazon.de. Ein Deeplink von AniList
    // zeigt auf einen fremden Marktplatz und endet in Deutschland auf einer
    // Fehlerseite — dann lieber zur Suche schicken als ins Nichts.
    const url =
      platform === 'primevideo' && isUnusablePrimeLink(link.url)
        ? primeVideoSearchUrl(displayTitle)
        : germanizeUrl(platform, link.url)
    out.push({ platform, url })
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
    jpEnd: isoDate(media.endDate) ?? isoDate(media.startDate),
    genres: mapGenres(media),
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
  // Liegt bewusst im Repo statt im Cache: ohne TMDB-Key soll ein Build die
  // bereits ermittelten FSK-Angaben nicht wieder verlieren.
  const tmdb = readJson<Record<string, TmdbInfo>>('data/tmdb.json', {})
  // Je AniList-ID: deutsche Handlung, FSK und Anbieter — für alle Titel, nicht
  // nur die kuratierten.
  const tmdbTitles = readJson<Record<string, { overviewDe?: string; fsk?: Fsk; providers?: PlatformId[] }>>(
    'data/tmdb-titles.json',
    {},
  )
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

  // --- Reihen zusammenführen -------------------------------------------------
  // Staffeln, Cours und Specials derselben Serie bekommen eine gemeinsame ID,
  // damit die Datenbank sie auf Wunsch zu einer Karte bündeln kann.
  const FRANCHISE_RELATIONS = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY'])
  const parent = new Map<number, number>()
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!
    let cur = id
    while (parent.get(cur) !== undefined && parent.get(cur) !== cur) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // Die kleinere ID gewinnt — das ist in aller Regel die erste Staffel.
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  for (const media of [...Object.values(byMal), ...Object.values(byAniId)]) {
    if (!media?.id) continue
    parent.set(media.id, parent.get(media.id) ?? media.id)
    for (const edge of media.relations?.edges ?? []) {
      if (!FRANCHISE_RELATIONS.has(edge.relationType)) continue
      if (edge.node?.type !== 'ANIME') continue
      parent.set(edge.node.id, parent.get(edge.node.id) ?? edge.node.id)
      union(media.id, edge.node.id)
    }
  }
  for (const title of titles.values()) title.franchiseId = find(title.id)

  // FSK aus TMDB für alle Titel übernehmen, nicht nur für kuratierte.
  for (const title of titles.values()) {
    const extra = tmdbTitles[title.id]
    if (extra?.fsk !== undefined && title.fsk === undefined) title.fsk = extra.fsk
  }

  // --- Crunchyroll-Sendeplätze indizieren ------------------------------------
  const crunchyroll = readJson<CrunchyrollData>('data/crunchyroll.json', {
    scrapedAt: '',
    german: {},
    slots: [],
  })
  const crBySeriesId = new Map<string, CrunchyrollEntry>()
  for (const entry of Object.values(crunchyroll.german)) {
    if (entry.seriesId) crBySeriesId.set(entry.seriesId, entry)
  }
  /** AniList-Titel über ihre Crunchyroll-Serien-ID auffindbar machen. */
  const titleByCrSeries = new Map<string, Title>()
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const id = stream.platform === 'crunchyroll' ? crunchyrollSeriesId(stream.url) : undefined
      if (id && !titleByCrSeries.has(id)) titleByCrSeries.set(id, title)
    }
  }

  function findCrunchyroll(entryUrl: string | undefined, name: string): CrunchyrollEntry | undefined {
    const id = crunchyrollSeriesId(entryUrl)
    return (id ? crBySeriesId.get(id) : undefined) ?? crunchyroll.german[normalizeTitle(name)]
  }

  // --- Releases aufbauen ----------------------------------------------------
  const releases: Release[] = []
  const seenSlugs = new Set<string>()
  const usedCrKeys = new Set<string>()

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
    const platformUrl = pickPlatformUrl(entry, title)

    // Belegte Sendezeit aus dem Crunchyroll-Kalender einsetzen. Sie ersetzt
    // eine geschätzte Angabe, weil sie direkt vom Anbieter kommt.
    const sources = [...(entry.sources ?? [])]
    if (entry.platform === 'crunchyroll' && !entry.schedule.time) {
      const slot = findCrunchyroll(platformUrl, entry.titleDe ?? name)
      if (slot) {
        usedCrKeys.add(normalizeTitle(slot.rawTitle))
        schedule.time = slot.time
        const startsOnSlotWeekday =
          weekdayIndex(schedule.firstEpisodeDate) === slot.weekday || slot.dates.includes(schedule.firstEpisodeDate)
        if (startsOnSlotWeekday && slot.weeklyConfirmed) delete schedule.estimated
        sources.push(CR_CALENDAR_URL)
      }
    }

    if (title && fsk !== undefined && title.fsk === undefined) title.fsk = fsk
    if (title && entry.titleDe && !title.titleDe) title.titleDe = entry.titleDe

    releases.push({
      slug: entry.slug,
      titleId: titleId ?? -1,
      name,
      platform: entry.platform,
      platformUrl,
      buyUrl:
        entry.buyUrl ?? (entry.releaseType === 'disc' ? amazonSearchUrl(name) : undefined),
      releaseType: entry.releaseType,
      fsk,
      publisher: entry.publisher,
      edition: entry.edition,
      note: entry.note,
      schedule,
      year: releaseYear,
      sources: [...new Set(sources)],
    })
  }

  // --- Automatisch ergänzte Crunchyroll-Simuldubs ----------------------------
  // Alles, was der Kalender von Crunchyroll als „(Deutsch)" führt und noch
  // nicht kuratiert ist, wird selbsttätig aufgenommen. Der Staffelstart wird
  // aus der frühesten gesehenen Folgennummer zurückgerechnet.
  let autoAdded = 0
  for (const [key, slot] of Object.entries(crunchyroll.german)) {
    if (usedCrKeys.has(key)) continue
    if (!slot.earliest?.date) continue

    const title = slot.seriesId ? titleByCrSeries.get(slot.seriesId) : undefined
    const slug = `cr-${slot.seriesId ?? slugify(key)}`
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    const episodeOffset = (slot.earliest.episode ?? 1) - 1
    const firstEpisodeDate = addDays(slot.earliest.date, -7 * episodeOffset)
    const name = slot.rawTitle.replace(/\s*\(Deutsch\)\s*$/i, '').trim()
    const releaseYear = Number(firstEpisodeDate.slice(0, 4))

    let episodeCount = title?.episodes
    let episodeCountAssumed = false
    if (!episodeCount || !title?.jpYear || Math.abs(title.jpYear - releaseYear) > 1) {
      episodeCount = Math.max(12, (slot.earliest.episode ?? 1) + slot.dates.length)
      episodeCountAssumed = true
    }

    releases.push({
      slug,
      titleId: title?.id ?? -1,
      name,
      platform: 'crunchyroll',
      platformUrl: slot.seriesUrl,
      releaseType: 'weekly',
      fsk: title?.fsk,
      schedule: {
        firstEpisodeDate,
        time: slot.time,
        episodeCount,
        episodeCountAssumed,
        // Uhrzeit und Wochentag sind belegt; nur der zurückgerechnete Start
        // bleibt eine Annahme, solange die Wochentaktung nicht bestätigt ist.
        estimated: !slot.weeklyConfirmed || episodeOffset > 0,
      },
      year: releaseYear,
      sources: [CR_CALENDAR_URL],
    })
    autoAdded++
  }
  log(`${autoAdded} Simuldubs automatisch aus dem Crunchyroll-Kalender ergänzt`)

  // --- Synchro-Verfügbarkeit je Plattform ------------------------------------
  // Ein Stream-Link allein sagt nichts über die Sprache. Belegt ist die Synchro
  // nur dort, wo sie tatsächlich nachgewiesen wurde.
  const dubByTitle = new Map<number, Set<PlatformId>>()
  for (const release of releases) {
    if (release.titleId < 0) continue
    const set = dubByTitle.get(release.titleId) ?? new Set<PlatformId>()
    set.add(release.platform)
    dubByTitle.set(release.titleId, set)
  }
  for (const title of titles.values()) {
    const confirmed = dubByTitle.get(title.id)
    for (const stream of title.streams) {
      if (confirmed?.has(stream.platform)) {
        stream.dub = true
        continue
      }
      if (stream.platform === 'crunchyroll') {
        const id = crunchyrollSeriesId(stream.url)
        // Nur ein Treffer beweist etwas. Ein Fehlen beweist nichts: Der
        // Simulcast-Kalender führt ausschließlich laufende Staffeln, nicht den
        // gesamten Katalog. „Nicht gefunden" bleibt deshalb „ungeprüft".
        if (id && crBySeriesId.has(id)) stream.dub = true
      }
    }
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
  // Zweisprachig: AniList führt nur Englisch, die deutsche Fassung kommt von TMDB.
  const synopses: Record<number, { de?: string; en?: string }> = {}
  const slim = allTitles.map((t) => {
    const de = tmdbTitles[t.id]?.overviewDe
    if (t.synopsis || de) synopses[t.id] = { de, en: t.synopsis }
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
  // Erst leeren: Genres kommen und gehen, sonst blieben alte Feeds als Leichen
  // im Repository liegen und würden weiter ausgeliefert.
  clearDir(`${OUT}/feeds`)
  const siteUrl = process.env.SITE_URL ?? 'https://anime-kalender.de/'
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
