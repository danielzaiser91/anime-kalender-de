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
import { loadCurated, loadWatchLinks, type CuratedEntry } from './lib/curated.ts'
import type { TmdbInfo } from './lib/tmdb.ts'
import type { AdnData } from './fetch-adn.ts'
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
  WatchLink,
} from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { addDays } from '../shared/time.ts'
import { buildIcs } from '../shared/ics.ts'
import {
  KEYWORD_BLOCKLIST,
  PLATFORM_PRIORITY,
  TAG_AS_GENRE,
  TAG_AS_GENRE_MIN_RANK,
  amazonSearchUrl,
  anisearchPlatform,
  providerKind,
  providerName,
  stripAffiliate,
  isUnusablePrimeLink,
  primeVideoSearchUrl,
  platformSearchUrl,
  germanizeUrl,
  platformFromSite,
} from '../shared/mappings.ts'

const OUT = 'public/data'
const KEYWORD_MIN_RANK = 55
const KEYWORD_MAX = 24
const CR_CALENDAR_URL = 'https://www.crunchyroll.com/de/simulcastcalendar'
const ADN_CALENDAR_URL = 'https://animationdigitalnetwork.com/de/'

/** ADN schreibt die Freigabe als "12+"; unser Datensatz kennt die FSK-Stufen. */
function fskFromAdnAge(age: string | undefined): Fsk | undefined {
  const value = Number((age ?? '').replace(/\D+/g, ''))
  return ([0, 6, 12, 16, 18] as const).includes(value as Fsk) ? (value as Fsk) : undefined
}

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

/**
 * TMDB-Anbietername → unsere Plattform. Dieselbe Zuordnung wie im Abrufskript,
 * hier noch einmal gebraucht, weil der Build entscheidet, was als Plattform
 * und was als schlichter Verweis erscheint.
 */
function providerToPlatform(name: string): PlatformId | undefined {
  const n = name.toLowerCase()
  if (n.includes('crunchyroll')) return 'crunchyroll'
  if (n.includes('netflix')) return 'netflix'
  if (n.includes('disney')) return 'disneyplus'
  if (n.includes('amazon') || n.includes('prime video')) return 'primevideo'
  if (n.includes('animation digital network') || n === 'adn') return 'adn'
  if (n.includes('wow')) return 'wow'
  if (n.includes('joyn')) return 'joyn'
  if (n.includes('rtl')) return 'rtlplus'
  if (n.includes('aniverse')) return 'aniverse'
  return undefined
}

/**
 * Müsste diese Serie im abgesuchten Crunchyroll-Zeitraum laufen?
 *
 * Die Frage entscheidet, ob das Fehlen im Kalender etwas beweist. Vorher wurde
 * nur geprüft, ob der **Starttermin** im Fenster liegt — und das ging schief,
 * sobald das Fenster weiterwanderte:
 *
 *   Fenster 03.08.–23.08., Mushoku Tensei S3 startet angeblich am 05.07.
 *   → Start liegt davor → keine Prüfung → der Eintrag bleibt stehen.
 *
 * Im Juli war derselbe Eintrag korrekt verworfen worden. Der Fehler reparierte
 * sich also von selbst wieder kaputt, und niemand hätte es gemerkt (gemeldet
 * von Daniel am 10.08.2026: „gibt es noch nicht auf Deutsch, nicht mal die
 * erste Folge").
 *
 * Richtig ist: Wenn eine wöchentliche Serie am 05.07. beginnt und vierzehn
 * Folgen hat, müssen im August Folgen im Kalender stehen. Stehen dort keine,
 * gibt es die deutsche Fassung nicht. Nur bei Serien, die vor dem Fenster
 * abgeschlossen waren, beweist das Fehlen nichts.
 */
function overlapsWindow(
  schedule: { firstEpisodeDate: string; episodeCount?: number; lastEpisodeDate?: string },
  window: { from: string; to: string },
): boolean {
  const start = schedule.firstEpisodeDate
  const ende =
    schedule.lastEpisodeDate ??
    addDays(start, 7 * Math.max(0, (schedule.episodeCount ?? 12) - 1))
  return start <= window.to && ende >= window.from
}

/** Wochentag eines ISO-Datums, 0 = Montag. */
function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/**
 * Rechnet aus dem beobachteten Sendeplan den Start der deutschen Fassung.
 *
 * Der Kalender zeigt nur ein Fenster von wenigen Wochen. Lief die früheste dort
 * gesehene Folge als Nummer 5, lag Folge 1 vier Wochen davor — das ist Rechnen,
 * kein Raten, solange der Wochentakt stimmt.
 *
 * Entscheidend ist, **welcher** Beobachtung man dabei glaubt. Die erste Fassung
 * nahm die früheste und lag bei „Skeleton Knight" zwei Tage daneben: Dort stand
 * eine einzelne Kachel am Samstag, 04.07., als Folge 1 im Kalender, während vier
 * spätere Termine einträchtig montags lagen. Aus dem Samstag hochgerechnet war
 * anschließend **jeder** Termin der Staffel falsch.
 *
 * Deshalb entscheidet jetzt die Mehrheit:
 *  1. Der Wochentag, auf dem die meisten Beobachtungen liegen, ist der
 *     Sendeplatz. Alles daneben fliegt raus — auch wenn es früher liegt.
 *  2. Jede verbliebene Beobachtung rechnet ihren eigenen Staffelstart aus.
 *     Der häufigste gewinnt; bei Gleichstand der aus dem jüngsten Termin,
 *     weil ein aktueller Sendeplan mehr über den laufenden Plan sagt.
 *
 * `assumed` bleibt gesetzt, solange nur eine einzige Stimme hinter dem
 * Ergebnis steht — dann ist es eine plausible Rechnung, aber kein Beleg.
 */
function derivedStart(slot: CrunchyrollEntry): { date: string; assumed: boolean } | undefined {
  const observations = slot.observations?.length
    ? slot.observations
    : slot.earliest
      ? [slot.earliest]
      : []
  if (!observations.length) return undefined

  // 1. Der Sendeplatz ist der Wochentag mit den meisten Beobachtungen.
  const perWeekday = new Map<number, number>()
  for (const o of observations) {
    const day = weekdayOf(o.date)
    perWeekday.set(day, (perWeekday.get(day) ?? 0) + 1)
  }
  const slotDay = [...perWeekday.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
  const onSlot = observations.filter((o) => weekdayOf(o.date) === slotDay)

  // 2. Jede Beobachtung mit Folgennummer rechnet ihren Staffelstart aus.
  const votes = new Map<string, { count: number; latest: string }>()
  for (const o of onSlot) {
    if (!o.episode || o.episode < 1) continue
    const start = addDays(o.date, -7 * (o.episode - 1))
    const entry = votes.get(start)
    if (entry) {
      entry.count++
      if (o.date > entry.latest) entry.latest = o.date
    } else {
      votes.set(start, { count: 1, latest: o.date })
    }
  }

  if (!votes.size) {
    // Keine einzige Folgennummer: Dann bleibt nur der früheste Termin auf dem
    // Sendeplatz, und das ist ausdrücklich eine Annahme.
    const fallback = onSlot.map((o) => o.date).sort()[0]
    return fallback ? { date: fallback, assumed: true } : undefined
  }

  const [date, winner] = [...votes.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest),
  )[0]
  return { date, assumed: winner.count < 2 }
}

/**
 * Die im Kalender tatsächlich gesehenen Termine je Folgennummer.
 *
 * Nur was eine Nummer trägt, lässt sich einer Folge zuordnen. Alles andere
 * bleibt der Hochrechnung überlassen.
 */
function observedEpisodes(slot: CrunchyrollEntry): Record<number, string> {
  const out: Record<number, string> = {}
  for (const o of slot.observations ?? []) {
    if (o.episode && o.episode > 0) out[o.episode] = o.date
  }
  return out
}

function pickPlatformUrl(entry: CuratedEntry, title: Title | undefined): string | undefined {
  if (entry.platformUrl) return entry.platformUrl
  const match = title?.streams.find((s) => s.platform === entry.platform)
  if (match) return match.url
  // Kein Deeplink bekannt: lieber zur Suche des Anbieters schicken als die
  // Plattform als toten Text stehen lassen. Bei `kino` gibt es keine, dann
  // bleibt es leer.
  const query = searchableName(entry.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? entry.search)
  return query ? platformSearchUrl(entry.platform, query) : undefined
}

/**
 * Reduziert einen Anzeigenamen auf den Serientitel.
 *
 * „Yu-Gi-Oh! – Staffel 2" findet bei Disney+ nichts, „Yu-Gi-Oh!" schon: Die
 * Suchfelder der Anbieter sind keine Volltextsuche, jeder Zusatz kostet Treffer.
 * Staffel-, Volume- und Part-Angaben fliegen deshalb raus.
 */
function searchableName(name: string | undefined): string | undefined {
  if (!name) return undefined
  const trimmed = name
    .replace(/\s*[–—-]\s*(Staffel|Season|Vol\.?|Part|Box)\s*\d+.*$/i, '')
    .replace(/\s*\((\d{4}|Remaster|2K-Remaster)\)\s*$/i, '')
    .trim()
  return trimmed || name
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
  const tmdbTitles = readJson<
    Record<
      string,
      {
        overviewDe?: string
        fsk?: Fsk
        providers?: PlatformId[]
        offers?: { name: string; kind: 'flatrate' | 'rent' | 'buy' }[]
        justwatchUrl?: string
      }
    >
  >(
    'data/tmdb-titles.json',
    {},
  )
  // Deutsche Inhaltsangaben und Anbieter von aniSearch. Fehlt die Datei, läuft
  // alles wie zuvor — nur eben mit den schwächeren Texten.
  const anisearch = readJson<
    Record<string, { descriptionDe?: string; streams: { provider: string; url: string }[] }>
  >('data/anisearch.json', {})
  const curated = loadCurated()

  // Notbremse: Ohne den AniList-Cache baut dieser Lauf einen Datensatz ohne
  // einen einzigen Titel — und damit ohne Genres, Keywords, Cover und
  // Beschreibungen. Das sieht in der Ausgabe harmlos aus („Titel: 0") und
  // überschreibt trotzdem alles unter public/data/.
  //
  // Genau das ist am 08.08.2026 passiert: Der stündliche Workflow rief
  // `data:build` ohne vorheriges `data:fetch` auf, und `data/cache/` liegt
  // bewusst nicht im Repo. Der Kalender stand danach eine Stunde lang ohne
  // Genre- und Keyword-Filter da.
  if (!Object.keys(byMal).length && !Object.keys(byAniId).length) {
    console.error(
      'Abbruch: data/cache/ ist leer — ohne AniList-Daten gäbe es keinen einzigen Titel.\n' +
        'Erst `npm run data:fetch` laufen lassen. Der bestehende Datensatz bleibt unangetastet.',
    )
    process.exit(1)
  }

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

  // Anbieter von aniSearch dazunehmen. Die decken genau die Lücke, die AniList
  // lässt: alte Katalogtitel, die nur noch als DVD oder bei einem kleinen
  // Dienst zu haben sind.
  for (const title of titles.values()) {
    const extra = anisearch[title.id]
    if (!extra?.streams?.length) continue
    const watchLinks: WatchLink[] = []
    for (const { provider, url: raw } of extra.streams) {
      const url = stripAffiliate(raw)
      const platform = anisearchPlatform(provider)
      if (platform) {
        // Kennt unsere Plattformliste den Dienst, gehört er zu den Streams —
        // aber nur, wenn dort nicht schon ein Link steht.
        if (!title.streams.some((s) => s.platform === platform)) {
          title.streams.push({ platform, url })
        }
        continue
      }
      // Ein Anbieter genügt einmal. Zwei Amazon-Zeilen nebeneinander sind
      // keine Auswahl, sondern Rauschen — aniSearch führt dort oft mehrere
      // Ausgaben desselben Titels.
      const name = providerName(provider)
      // Leerer Name heißt: der Anbieter gehört nicht auf eine deutsche Seite.
      if (!name) continue
      if (!watchLinks.some((w) => w.name === name)) {
        watchLinks.push({ name, url, kind: providerKind(provider) })
      }
    }
    if (watchLinks.length) {
      // Ansehen vor Kaufen — wer ein Abo hat, will nicht erst zur Kasse.
      title.watchLinks = watchLinks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }

  // Angebote von TMDB (Datenbasis JustWatch) — dieselbe Quelle, aus der auch
  // werstreamt.es schöpft. Bisher behielten wir davon nur die Dienste mit
  // eigener Plattform und warfen Videobuster, maxdome, Sky Store und Apple TV
  // weg. Die Daten waren immer da.
  //
  // Einen Link je Anbieter liefert TMDB nicht, nur eine Übersichtsseite für
  // die Region. Also zeigt jede Zeile den Anbieternamen und führt dorthin —
  // besser als ein erfundener Deeplink, der ins Leere geht.
  for (const title of titles.values()) {
    const info = tmdbTitles[title.id]
    if (!info?.offers?.length || !info.justwatchUrl) continue
    const watchLinks = title.watchLinks ?? []
    for (const offer of info.offers) {
      if (providerToPlatform(offer.name)) continue
      // Denselben Weg über providerName wie die aniSearch-Angebote — sonst
      // stünden „maxdome" und „maxdome Store" als zwei Anbieter nebeneinander.
      const name = providerName(offer.name)
      if (!name) continue
      if (watchLinks.some((w) => w.name === name)) continue
      watchLinks.push({
        name,
        url: info.justwatchUrl,
        kind: offer.kind === 'flatrate' ? 'stream' : 'buy',
      })
    }
    if (watchLinks.length) {
      title.watchLinks = watchLinks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
  }

  // Von Hand gepflegte Bezugswege. Sie stehen vorn: Wer sie einträgt, hat
  // nachgesehen — das schlägt jede automatische Liste.
  for (const entry of loadWatchLinks()) {
    const title = titles.get(entry.anilistId)
    if (!title) {
      warn(`watch-links.yaml: AniList-ID ${entry.anilistId} (${entry.title ?? '?'}) ist unbekannt`)
      continue
    }
    const existing = title.watchLinks ?? []
    const curated = entry.links.filter((l) => !existing.some((e) => e.url === l.url))
    title.watchLinks = [...curated, ...existing].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1,
    )
  }

  for (const title of titles.values()) {
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
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
  /**
   * AniList-Titel über ihre Crunchyroll-Serien-ID auffindbar machen.
   *
   * Bewusst eine Liste je Serie, kein einzelner Titel: Crunchyroll führt alle
   * Staffeln und Specials einer Reihe unter derselben Serien-ID. Wer hier nur
   * den ersten Treffer behält, ordnet jede Folge willkürlich irgendeiner
   * Staffel zu — so landete „I am a hero too" bei Staffel 6.
   */
  const titlesByCrSeries = new Map<string, Title[]>()
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const id = stream.platform === 'crunchyroll' ? crunchyrollSeriesId(stream.url) : undefined
      if (!id) continue
      const list = titlesByCrSeries.get(id)
      if (list) {
        if (!list.includes(title)) list.push(title)
      } else {
        titlesByCrSeries.set(id, [title])
      }
    }
  }

  /** AniList-Titel über ihren normalisierten Namen auffindbar machen. */
  const titleByName = new Map<string, Title>()
  for (const title of titles.values()) {
    for (const name of [title.titleRomaji, title.titleEn, title.titleNative]) {
      const key = name ? normalizeTitle(name) : ''
      if (key && !titleByName.has(key)) titleByName.set(key, title)
    }
  }

  /**
   * Einen AniList-Titel zu einem Kalendernamen finden.
   *
   * Crunchyroll setzt im Kalender gern zwei Namen hintereinander — den
   * deutschen und den englischen („Elainas Reise Wandering Witch: The Journey
   * of Elaina") oder die Serie und ihren Untertitel („Fruits Basket (2019)
   * Fruits Basket: The Final Season"). Ein Vergleich auf den ganzen String
   * findet dann nichts. Deshalb wird der Name von vorne verkürzt und der
   * längste Treffer genommen; unter zwei Wörtern wird nicht mehr gesucht,
   * sonst trifft irgendwann jedes „Season 2".
   */
  function titleForCalendarName(name: string): Title | undefined {
    const words = normalizeTitle(name).split(' ').filter(Boolean)
    for (let start = 0; start <= words.length - 2; start++) {
      const hit = titleByName.get(words.slice(start).join(' '))
      if (hit) return hit
    }
    return undefined
  }

  /** Staffelnummer aus einem Namen, sofern er eine nennt. */
  function seasonNumber(name: string | undefined): number | undefined {
    const match = name ? normalizeTitle(name).match(/\bs(\d+)\b/) : null
    return match ? Number(match[1]) : undefined
  }

  /**
   * Aus allen Staffeln einer Crunchyroll-Serie die gemeinte heraussuchen.
   *
   * Der Rückfall auf die Serien-ID greift, wenn der Name nichts findet — bei
   * deutschen Kalendernamen also fast immer. Nennt der Kalender eine
   * Staffelnummer, muss der Titel sie auch tragen: „Meine Wiedergeburt als
   * Schleim … Staffel 4" hing sonst an „Slime Season 3", mitsamt deren
   * Folgenzahl, Cover und Beschreibung. Passt keine, bleibt der Titel lieber
   * leer — eine falsche Zuordnung ist schlechter als keine.
   */
  function titleFromSeries(
    seriesId: string,
    calendarName: string,
    year: number,
  ): Title | undefined {
    const candidates = titlesByCrSeries.get(seriesId) ?? []
    if (!candidates.length) return undefined
    const wanted = seasonNumber(calendarName)
    if (wanted === undefined) return candidates[0]

    const numberOf = (t: Title) => seasonNumber(t.titleEn) ?? seasonNumber(t.titleRomaji)
    const exact = candidates.find((t) => numberOf(t) === wanted)
    if (exact) return exact
    // Die erste Staffel trägt ihre Nummer meist nicht im Titel.
    if (wanted === 1) {
      const plain = candidates.find((t) => numberOf(t) === undefined)
      if (plain) return plain
    }
    // Viele Reihen nummerieren gar nicht, sondern geben jeder Staffel einen
    // eigenen Untertitel („Ascendance of a Bookworm: Adopted Daughter of an
    // Archduke"). Dann entscheidet das Ausstrahlungsjahr — und nur, wenn es
    // genau einen Kandidaten trifft. Bei zweien wäre es wieder geraten.
    const sameYear = candidates.filter((t) => t.jpYear && Math.abs(t.jpYear - year) <= 1)
    return sameYear.length === 1 ? sameYear[0] : undefined
  }

  function findCrunchyroll(entryUrl: string | undefined, name: string): CrunchyrollEntry | undefined {
    const id = crunchyrollSeriesId(entryUrl)
    return (id ? crBySeriesId.get(id) : undefined) ?? crunchyroll.german[normalizeTitle(name)]
  }

  // --- Releases aufbauen ----------------------------------------------------
  const releases: Release[] = []
  const seenSlugs = new Set<string>()
  const usedCrKeys = new Set<string>()
  // Kuratierte Termine, die der Crunchyroll-Kalender nicht bestätigt.
  const unverified: string[] = []

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

    // Angaben aus dem Crunchyroll-Kalender einsetzen. Sie kommen direkt vom
    // Anbieter und schlagen deshalb jede abgeleitete Angabe.
    const sources = [...(entry.sources ?? [])]
    if (entry.platform === 'crunchyroll') {
      const slot = findCrunchyroll(platformUrl, entry.titleDe ?? name)
      if (slot) {
        usedCrKeys.add(normalizeTitle(slot.rawTitle))
        if (!entry.schedule.time) schedule.time = slot.time

        // Der wichtigste Teil: Die deutsche Synchro startet oft Wochen NACH
        // dem Simulcast. Die kuratierten Daten stammen aus Saisonübersichten
        // und nennen nur den Simulcast-Start — real gemessen bis zu drei
        // Wochen zu früh (08.08.2026 vom Nutzer gemeldet: „Though I Am an
        // Inept Villainess" stand auf dem 12.07., Folge 1 lief am 02.08.).
        // Ist der Termin nur abgeleitet, gewinnt der beobachtete Sendeplan.
        const observed = derivedStart(slot)
        if (observed && entry.schedule.estimated) {
          schedule.firstEpisodeDate = observed.date
          schedule.estimated = observed.assumed
          if (!observed.assumed) delete schedule.estimated
        }
        // Gesehene Einzeltermine gewinnen gegen jede Hochrechnung.
        const seen = observedEpisodes(slot)
        if (Object.keys(seen).length) schedule.observed = seen
        sources.push(CR_CALENDAR_URL)
      } else if (entry.schedule.estimated && crunchyroll.window && overlapsWindow(schedule, crunchyroll.window)) {
        // Die Serie müsste im abgesuchten Zeitraum laufen, und der Kalender
        // führt dort keine deutsche Folge. Dann gibt es die Synchro nicht —
        // ein erfundener Sendeplan wäre schlimmer als gar keiner.
        warn(
          `"${entry.slug}": kein deutscher Eintrag bei Crunchyroll im Zeitraum ` +
            `${crunchyroll.window.from}…${crunchyroll.window.to} (Start ${schedule.firstEpisodeDate}) — verworfen`,
        )
        unverified.push(entry.slug)
        continue
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

    const name = slot.rawTitle.replace(/\s*\(Deutsch\)\s*$/i, '').trim()
    // Erst über den vollen Namen, dann über die Serien-ID.
    //
    // Der Kalender nennt bei Specials die Serie UND den Untertitel — „My Hero
    // Academia I am a hero too". Dafür gibt es bei AniList einen eigenen
    // Eintrag, und der normalisierte Name trifft ihn genau. Die Serien-ID
    // dagegen zeigt bei Crunchyroll für alle Staffeln und Specials auf
    // dieselbe Serie; welcher AniList-Titel dahinter landete, entschied die
    // Reihenfolge in der Map. So wurde aus dem Special die sechste Staffel.
    const title =
      titleForCalendarName(name) ??
      (slot.seriesId
        ? titleFromSeries(slot.seriesId, name, Number(slot.earliest.date.slice(0, 4)))
        : undefined)
    const slug = `cr-${slot.seriesId ?? slugify(key)}`
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    // Ein einziger Termin ist kein Beleg für einen Wochentakt.
    //
    // Im selben Kalender stehen Specials, Filmpremieren und die Anime Awards.
    // Sie sehen dort aus wie eine Serienfolge; der einzige Unterschied ist,
    // dass es bei ihnen bei einem Termin bleibt. Ohne diese Unterscheidung
    // wurde aus jedem davon eine Reihe von mindestens zwölf Folgen, und der
    // Kalender behauptete Woche für Woche eine Folge, die es nicht gibt.
    // Genau so kam „I am a hero too" zu elf erfundenen Terminen.
    //
    // Der eine Termin allein reicht als Merkmal aber nicht: Eine Serie, die
    // gerade erst anläuft, hat im Kalenderfenster ebenfalls nur einen. Deshalb
    // zählt zusätzlich, was AniList über die Folgenzahl sagt — steht dort eine
    // belegte Zahl über eins, ist es eine Reihe, egal wie viele Termine das
    // Fenster gerade zeigt.
    const seenDates = [...new Set(slot.dates ?? [])]
    const knownEpisodes =
      title?.episodes && title.jpYear
        ? Math.abs(title.jpYear - Number(slot.earliest.date.slice(0, 4))) <= 1
          ? title.episodes
          : undefined
        : undefined
    if (seenDates.length < 2 && (knownEpisodes ?? 1) === 1) {
      const date = slot.earliest.date
      releases.push({
        slug,
        titleId: title?.id ?? -1,
        name,
        platform: 'crunchyroll',
        platformUrl: slot.seriesUrl,
        releaseType: 'batch',
        fsk: title?.fsk,
        note: 'Crunchyroll führt dazu bisher genau einen deutschen Termin.',
        schedule: { firstEpisodeDate: date, time: slot.time, episodeCount: 1 },
        year: Number(date.slice(0, 4)),
        sources: [CR_CALENDAR_URL],
      })
      autoAdded++
      continue
    }

    const derived = derivedStart(slot)
    if (!derived) continue
    const firstEpisodeDate = derived.date
    const releaseYear = Number(firstEpisodeDate.slice(0, 4))

    let episodeCount = title?.episodes
    let episodeCountAssumed = false
    if (!episodeCount || !title?.jpYear || Math.abs(title.jpYear - releaseYear) > 1) {
      // Die Reihe läuft, aber wie lang sie wird, weiß hier niemand. Zwölf ist
      // die übliche Cour-Länge und trägt das ≈ im UI. Die Untergrenze bleibt
      // das, was tatsächlich gesehen wurde — sonst fielen belegte Termine
      // hinten heraus.
      episodeCount = Math.max(12, (slot.earliest.episode ?? 1) + seenDates.length)
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
        estimated: derived.assumed,
        observed: observedEpisodes(slot),
      },
      year: releaseYear,
      sources: [CR_CALENDAR_URL],
    })
    autoAdded++
  }
  log(`${autoAdded} Simuldubs automatisch aus dem Crunchyroll-Kalender ergänzt`)
  if (unverified.length) log(`${unverified.length} kuratierte Termine verworfen (unbestätigt): ${unverified.join(', ')}`)

  // Abgeleitete Termine, für die es keine maschinelle Gegenprüfung gibt.
  //
  // Für Crunchyroll und ADN lesen wir den Kalender und können eine behauptete
  // Synchro widerlegen. Für Netflix, Prime Video und Disney+ gibt es diese
  // Möglichkeit nicht — dort bleibt ein `estimated: true` für immer stehen, und
  // niemand merkt, wenn die angekündigte Fassung nie erscheint. Genau so kam
  // „Mushoku Tensei Staffel 3" in den Kalender (10.08.2026): Die Quelle war
  // eine Simulcast-Übersicht, und ein Simulcast sagt nur, wann eine Folge
  // zeitgleich mit Japan läuft — nicht, ob sie deutsch vertont ist.
  const ungeprueft = releases.filter(
    (r) => r.schedule.estimated && !['crunchyroll', 'adn'].includes(r.platform),
  )
  if (ungeprueft.length) {
    warn(
      `${ungeprueft.length} abgeleitete Termine ohne Gegenprüfung (Plattform hat keinen Kalender, den wir lesen) — ` +
        `von Hand belegen oder streichen: ${ungeprueft.map((r) => r.slug).join(', ')}`,
    )
  }

  // --- Automatisch ergänzte ADN-Titel ---------------------------------------
  // ADN nennt in seiner Schnittstelle je Folge die Sprachfassung. Was dort als
  // `vde` steht, ist eine belegte deutsche Synchro mit belegter Uhrzeit — hier
  // muss nichts abgeleitet werden. Kuratierte Einträge haben Vorrang: Wer eine
  // ADN-Adresse von Hand gepflegt hat, will keinen zweiten Eintrag daneben.
  const adn = readJson<AdnData>('data/adn.json', { scrapedAt: '', window: { from: '', to: '' }, shows: [] })
  const curatedAdnShows = new Set(
    releases
      .filter((r) => r.platform === 'adn')
      .map((r) => normalizeTitle(r.name)),
  )
  let adnAdded = 0
  for (const show of adn.shows) {
    if (!show.episodes.length) continue
    if (curatedAdnShows.has(normalizeTitle(show.title))) continue
    const slug = `adn-${show.showId}`
    if (seenSlugs.has(slug)) continue

    const title = titleByName.get(normalizeTitle(show.title)) ?? titleByName.get(normalizeTitle(show.originalTitle ?? ''))
    const first = show.episodes[0]
    seenSlugs.add(slug)
    releases.push({
      slug,
      titleId: title?.id ?? -1,
      name: show.title,
      platform: 'adn',
      platformUrl: first.url,
      releaseType: show.batch ? 'batch' : 'weekly',
      fsk: title?.fsk ?? fskFromAdnAge(show.age),
      schedule: {
        firstEpisodeDate: first.date,
        time: first.time,
        episodeCount: show.episodes.length,
        lastEpisodeDate: show.episodes.at(-1)!.date,
      },
      year: Number(first.date.slice(0, 4)),
      sources: [ADN_CALENDAR_URL],
    })
    adnAdded++
  }
  if (adn.shows.length) log(`${adnAdded} ADN-Titel mit deutscher Synchro ergänzt (${adn.shows.length} gefunden)`)

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

  // Bezugsquellen jenseits der neun bekannten Plattformen — maxdome, Apple TV,
  // Videobuster und die Prime-Video-Kanäle. Nach Häufigkeit sortiert, nicht
  // alphabetisch: Wer nach einem Anbieter filtert, sucht zuerst die großen, und
  // eine Liste von 42 Einträgen liest niemand von A bis Z durch.
  const providerCount = new Map<string, number>()
  for (const t of allTitles) {
    for (const w of t.watchLinks ?? []) providerCount.set(w.name, (providerCount.get(w.name) ?? 0) + 1)
  }
  const providers = [...providerCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([name]) => name)

  const meta: DataMeta = {
    generatedAt: new Date().toISOString(),
    titleCount: allTitles.length,
    releaseCount: releases.length,
    eventCount: events.length,
    genres,
    keywords,
    platforms,
    providers,
    years,
    attribution: [
      'Dub-Daten: MyDubList (https://mydublist.com) — CC BY 4.0',
      'Metadaten: AniList (https://anilist.co)',
      'FSK & Anbieter: TMDB (https://www.themoviedb.org), Anbieterdaten von JustWatch',
      'Deutsche Inhaltsangaben & Bezugsquellen: aniSearch (https://www.anisearch.de)',
      'ID-Zuordnung: anime-offline-database (https://github.com/manami-project/anime-offline-database) — ODbL v1.0',
      'Termine: aniSearch, Anime2You — siehe Quellenangabe je Eintrag',
    ],
  }

  // --- Schreiben ------------------------------------------------------------
  // Synopsen liegen getrennt, damit die Startseite nicht Megabytes laden muss.
  //
  // Drei Quellen, in dieser Reihenfolge: aniSearch schreibt redaktionelle
  // deutsche Texte, TMDB oft nur einen übersetzten Stummel, AniList gar kein
  // Deutsch. Vorher gewann TMDB — und bei „You and I Are Polar Opposites
  // Staffel 2" stand deshalb „The second season of …" auf der Seite, obwohl es
  // eine ausführliche deutsche Inhaltsangabe gibt.
  const synopses: Record<number, { de?: string; en?: string }> = {}
  const slim = allTitles.map((t) => {
    const de = anisearch[t.id]?.descriptionDe ?? tmdbTitles[t.id]?.overviewDe
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
