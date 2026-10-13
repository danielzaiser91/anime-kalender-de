/**
 * **ADN-Filme finden ihren AniList-Eintrag auch bei anderer Schreibweise** (12.10.2026).
 *
 * ADN schreibt „Gekijōban Bleach: Memories of Nobody" und „… - Movie 1", AniList
 * „BLEACH: MEMORIES OF NOBODY MOVIE" — der Namensabgleich über den ganzen String
 * traf nicht, der Film stand ohne Titel im Kalender (Panel „keine Metadaten").
 * Verglichen wird nur gegen Filme, nur für Shows, die ADN als Film führt, und nur
 * bei eindeutigem Treffer.
 */
import { normalizeTitle } from '../lib/crunchyroll.ts'
import { passtZuSerie, type AdnShow } from '../lib/adn.ts'
import { log } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'

/** Name ohne Akzente, ohne „Gekijōban"/„Eiga" vorn und ohne „Movie"/„Movie 1" hinten (höhere Nummern bleiben: "One Piece Movie 2" ist nicht Film 1). */
export function filmSchluessel(name: string): string {
  return normalizeTitle(name.normalize('NFD').replace(/\p{M}/gu, ''))
    .replace(/^(gekijou?ban|eiga)\s+/, '')
    .replace(/\s+(the\s+)?movie(\s+1)?$/, '')
}

/** Der einzige Film, dessen Name zu einem der Namen der Show passt; bei zwei Treffern keiner. */
export function filmZurShow(show: Pick<AdnShow, 'title' | 'originalTitle' | 'episodes'>, titles: Iterable<Title>): Title | undefined {
  if (!show.episodes.length || !show.episodes.every((e) => e.type === 'MOV')) return undefined
  const gesucht = new Set([show.title, show.originalTitle ?? ''].map(filmSchluessel).filter(Boolean))
  const treffer = new Set<Title>()
  for (const t of titles) {
    if (t.format !== 'MOVIE') continue
    if ([t.titleRomaji, t.titleEn, t.titleNative].some((n) => n && gesucht.has(filmSchluessel(n)))) treffer.add(t)
  }
  return treffer.size === 1 ? [...treffer][0] : undefined
}

/** Der Anime zu einer ADN-Show: Katalogkennung, dann Name, dann Originalname, zuletzt der Film unter anderer Schreibweise. */
export function titelZurShow(show: AdnShow, titles: Map<number, Title>, titleByName: Map<string, Title>): Title | undefined {
  return (
    (show.titleId ? titles.get(show.titleId) : undefined) ??
    titleByName.get(normalizeTitle(show.title)) ??
    titleByName.get(normalizeTitle(show.originalTitle ?? '')) ??
    filmZurShow(show, titles.values())
  )
}

/**
 * Setzt `titleId` (Titel im Datensatz) an die Serien des Katalogs; nur im Bau, nie in der Datei. Eine Zuordnung muss den Namen tragen, nicht nur ein
 * Werkwort (`WERKWOERTER` in lib/adn.ts); sonst wird sie verworfen.
 */
export function loeseAdnTitelIds(shows: AdnShow[], titles: Map<number, Title>): void {
  for (const show of shows) {
    show.titleId = show.anilistId
    const t = show.titleId ? titles.get(show.titleId) : undefined
    if (!t || passtZuSerie(show, { title: { romaji: t.titleRomaji, english: t.titleEn, native: t.titleNative } })) continue
    log(`ADN-Katalog ${show.showId} („${show.title}“) gehört nicht zu AniList ${t.id} („${t.titleRomaji}“) — Zuordnung verworfen`)
    show.titleId = undefined
  }
}
