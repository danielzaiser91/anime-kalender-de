import { log, readJson } from '../lib/util.ts'
import { ladeBewertungen } from '../lib/anisearch-bewertung.ts'
import { BANNER_DATEI, bannerAdresse, type TmdbBanner } from '../lib/tmdb-banner.ts'
import type { Title } from '../../shared/types.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'

/**
 * **Woher Bewertung, Schlagworte und Banner kommen** (Daniel, 11.10.2026): Bewertung (Klarwert) und Schlagworte aus der aniSearch-Seite
 * (`lib/anisearch-bewertung.ts`, Schlagworte nur aus der festen Liste), Banner von TMDB (`data/tmdb-banner.json`). Nichts davon kommt noch von AniList.
 */
type Bewertung = Pick<Title, 'score' | 'scoreQuelle'>

let tmdbBanner: TmdbBanner | undefined
const banner = (): TmdbBanner => (tmdbBanner ??= readJson<TmdbBanner>(BANNER_DATEI, {}))

/** Unter dieser Stimmenzahl zeigt der Titel keine Bewertung: ein Durchschnitt aus 1–4 Stimmen ist kein Beleg (Dirigent, 11.10.2026). */
export const MIN_STIMMEN_BEWERTUNG = 5

/** Bewertung eines Titels: der aniSearch-Klarwert ab `MIN_STIMMEN_BEWERTUNG` Stimmen, sonst keine. Eine TMDB-Wertung (Cartoons) bleibt. */
export function bewertungNachRegel(bisher: Bewertung, anisearchId: number | undefined): Bewertung {
  if (bisher.scoreQuelle === 'tmdb') return bisher
  const seite = anisearchId === undefined ? undefined : ladeBewertungen().get(anisearchId)
  return seite?.klarwert && seite.stimmen >= MIN_STIMMEN_BEWERTUNG ? { score: seite.klarwert } : {}
}

/** Schlagworte eines Titels: die erlaubten aniSearch-Tags seiner Seite. */
export function schlagworteNachRegel(anisearchId: number | undefined): string[] {
  return anisearchId === undefined ? [] : (ladeBewertungen().get(anisearchId)?.schlagworte ?? [])
}

/**
 * Bannerbild eines Titels: das TMDB-Hintergrundbild. ÜBERGANG: Wo TMDB keins hat (Lückenliste `daniel-zum-abarbeiten/listen/luecken/banner.md`),
 * bleibt vorerst das AniList-Banner — diese Zeile entfällt, sobald für die Lücken ein Ersatz gefunden ist.
 */
export function bannerNachRegel(id: number, anilistBanner: string | undefined): string | undefined {
  const tmdb = banner()[String(id)]?.p
  return tmdb ? bannerAdresse(tmdb) : anilistBanner
}

/** Bewertung, Schlagworte und Banner nach der Regel; auch für die Kopien in `verschoben`, die vor `setzeProduktFelder` entstanden. */
export function mitProduktFeldern<T extends Title>(t: T, anisearchId: number | undefined): T {
  const { score, scoreQuelle } = bewertungNachRegel(t, anisearchId)
  return {
    ...t,
    score,
    scoreQuelle,
    keywords: schlagworteNachRegel(anisearchId),
    bannerImage: bannerNachRegel(t.id, t.bannerImage),
  }
}

/**
 * Setzt Bewertung, Schlagworte und Banner jedes Titels nach der Regel. Läuft vor `baueMeta`, damit Hauptbestand, Verschobene, Reihen
 * und Meldungen dasselbe sehen.
 */
export function setzeProduktFelder(titles: Map<number, Title>): void {
  const kennungen = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
  let ohneKennung = 0
  for (const t of titles.values()) {
    const asId = kennungen.get(t.id)
    if (asId === undefined) ohneKennung++
    Object.assign(t, mitProduktFeldern(t, asId))
  }
  const mitBewertung = [...titles.values()].filter((t) => t.score !== undefined).length
  log(`Bewertung, Schlagworte und Banner nach Regel: ${mitBewertung} von ${titles.size} Titeln mit aniSearch-Bewertung, ${ohneKennung} ohne aniSearch-Kennung`)
}
