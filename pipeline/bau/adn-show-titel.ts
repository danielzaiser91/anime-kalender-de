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
import { bewerteTreffer, passtZuSerie, type AdnShow } from '../lib/adn.ts'
import { normalisiere } from '../lib/anisearch-namen.ts'
import { log } from '../lib/util.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
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

/** Der Anime zu einer ADN-Show: Katalogkennung, dann Name, dann Originalname, dann der Film unter anderer Schreibweise; zuletzt der Cartoon der Handliste (`cartoon-adn.ts`). */
export function titelZurShow(show: AdnShow, titles: Map<number, Title>, titleByName: Map<string, Title>, cartoonJeAdn: Map<number, Title> = new Map()): Title | undefined {
  return (
    (show.titleId ? titles.get(show.titleId) : undefined) ??
    titleByName.get(normalizeTitle(show.title)) ??
    titleByName.get(normalizeTitle(show.originalTitle ?? '')) ??
    filmZurShow(show, titles.values()) ??
    cartoonJeAdn.get(show.showId)
  )
}

/** aniSearch-Kennung → die Titel im Datensatz, die sie tragen (meist einer; „Kennung mehrfach“ gibt es bei Doppelzeilen wie Wolf's Rain TV und OVA). */
export function titelJeAnisearch(titles: Map<number, Title>): Map<number, Title[]> {
  const kennungen = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
  const jeKennung = new Map<number, Title[]>()
  for (const [titelId, asId] of kennungen) jeKennung.set(asId, [...(jeKennung.get(asId) ?? []), titles.get(titelId)!])
  return jeKennung
}

/** Bei mehreren Titeln unter einer Kennung der mit dem besten Namen (`bewerteTreffer`); gleichauf: keiner. */
export function besterTitel(show: AdnShow, kandidaten: Title[]): Title | undefined {
  if (kandidaten.length === 1) return kandidaten[0]
  const wert = kandidaten
    .map((t) => ({ t, w: bewerteTreffer(show, { title: { romaji: t.titleRomaji, english: t.titleEn } }) }))
    .sort((a, b) => b.w - a.w)
  return wert[0] && wert[0].w > (wert[1]?.w ?? Number.NEGATIVE_INFINITY) ? wert[0].t : undefined
}

/**
 * Trägt der Titel den Namen der Serie? Ein geteiltes Wort genügt nicht (`WERKWOERTER` in lib/adn.ts); gleicher Name nach Normalisierung gilt immer —
 * „TERRAFORMARS“ und „Terra Formars“ teilen kein ganzes Wort, „DAN DA DAN“ und „Dandadan“ auch nicht.
 */
export function nameTraegt(show: AdnShow, t: Title): boolean {
  const namen = [t.titleRomaji, t.titleEn, t.titleNative].filter((n): n is string => Boolean(n))
  const unsere = [show.title, show.originalTitle].filter((n): n is string => Boolean(n)).map(normalisiere)
  return passtZuSerie(show, { title: { romaji: t.titleRomaji, english: t.titleEn, native: t.titleNative } }) || namen.some((n) => unsere.includes(normalisiere(n)))
}

/**
 * Setzt `titleId` (Titel im Datensatz) an die Serien des Katalogs; nur im Bau, nie in der Datei. Der Weg ist die aniSearch-Kennung der Serie
 * (`anisearchId`, `fetch-adn.ts`). Trägt der Titel den Namen nicht (`nameTraegt`), wird die Zuordnung verworfen.
 */
export function loeseAdnTitelIds(shows: AdnShow[], titles: Map<number, Title>): void {
  const jeAnisearch = titelJeAnisearch(titles)
  for (const show of shows) {
    const t = show.anisearchId ? besterTitel(show, jeAnisearch.get(show.anisearchId) ?? []) : undefined
    show.titleId = t?.id
    if (!t || nameTraegt(show, t)) continue
    log(`ADN-Katalog ${show.showId} („${show.title}“) gehört nicht zu ${t.titleRomaji} (Titel ${t.id}) — Zuordnung verworfen`)
    show.titleId = undefined
  }
}
