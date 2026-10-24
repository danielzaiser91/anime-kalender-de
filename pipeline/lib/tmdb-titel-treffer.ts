import { keineAnimation } from './tmdb-genre.ts'

/** Vergleichsform: Kleinschreibung, ohne Satzzeichen, ohne Füllwörter. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[:!?,.'"„“”–—_-]/g, ' ')
    .replace(/\b(the|a|an|der|die|das|season|staffel|part|cour)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ähnlichkeit über gemeinsame Wörter. Reicht hier: Es geht nur darum, einen
 * offensichtlich falschen Treffer zu erkennen, nicht um Feinabstufungen.
 */
export function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter((w) => w.length > 2))
  const wordsB = new Set(normalize(b).split(' ').filter((w) => w.length > 2))
  if (!wordsA.size || !wordsB.size) return 0
  let shared = 0
  for (const word of wordsA) if (wordsB.has(word)) shared++
  /*
    **Geteilt wird durch den längeren Titel** (17.09.2026). Vorher stand hier
    `Math.min`, und damit passte jeder kurze Titel zu 100 % in einen längeren
    fremden: „Your Name." bekam die Kennung von „Call Me by Your Name" (Daniel,
    mit Bild — die Apple-TV-Pille führte auf den falschen Film, die Handlung war
    die falsche, und JustWatch fand den Titel nicht mehr, weil die Kennung nicht
    passte). Ein Titel muss den anderen **ausfüllen**, nicht nur in ihm vorkommen.
  */
  return shared / Math.max(wordsA.size, wordsB.size)
}

export interface SearchHit {
  id: number
  name?: string
  title?: string
  original_name?: string
  original_title?: string
  first_air_date?: string
  release_date?: string
  genre_ids?: number[]
  /** Wie bekannt der Eintrag ist — der Unterschied zwischen dem Werk und einer leeren Karteileiche. */
  popularity?: number
  vote_count?: number
}

export interface Bester {
  hit: SearchHit
  score: number
  gewicht: number
}

/**
 * Der bessere von bisherigem Besten und den ersten fünf Treffen einer Suche.
 * Jahr: höchstens um eins daneben (dieselbe Serie in einem anderen Jahr ist eine andere Staffel); Name: Ähnlichkeit ab 0,75.
 *
 * **Bei gleichem Namen entscheidet, welcher Eintrag das Werk ist** (17.09.2026).
 * TMDB führt zu „Your Name" einen leeren Eintrag ohne Datum und ohne eine einzige
 * Stimme (553301) neben dem Film mit 12.992 Stimmen (372058); bei gleichem Namen gewinnt der bekanntere.
 */
export function waehleBesten(bisher: Bester | undefined, query: string, results: SearchHit[], jpYear: number | undefined): Bester | undefined {
  let best = bisher
  for (const hit of results.slice(0, 5)) {
    const hitYear = Number((hit.first_air_date ?? hit.release_date ?? '').slice(0, 4))
    if (jpYear && hitYear && Math.abs(hitYear - jpYear) > 1) continue
    const names = [hit.name, hit.title, hit.original_name, hit.original_title].filter(Boolean) as string[]
    const score = Math.max(...names.map((n) => similarity(query, n)), 0)
    const gewicht = (hit.vote_count ?? 0) + (hit.popularity ?? 0)
    if (score < 0.75) continue
    /* Realserie gleichen Namens (Kakegurui 2018 neben dem Anime 2017): zählt nur mit Genre Animation. */
    if (keineAnimation(hit.genre_ids)) continue
    if (!best || score > best.score || (score === best.score && gewicht > best.gewicht)) best = { hit, score, gewicht }
  }
  return best
}
