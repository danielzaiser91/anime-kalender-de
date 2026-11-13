import type { Title } from '../../shared/types.ts'
import { FORMATE, echterTitel, tmdbName, type TmdbEintrag } from './folgentitel-tmdb.ts'

/**
 * **TMDB-Folgentitel für Container-Staffeln** („… Staffel 2–4"): TMDB führt alle Staffeln unter der Serie der ersten
 * (`tmdb-folgen.json` hat nur deren Kennung als Schlüssel). Unser Titel „… Staffel N" nimmt TMDB-Staffel N derselben
 * Franchise, aber nur bei gleichem Namen und gleicher Folgenzahl. Das Jahr zählt hier nicht: unsere Jahre stammen vom
 * deutschen Start und weichen von TMDB ab (Miraculous Staffel 4: 2022 bei uns, 2021 bei TMDB; das Jahr führte zu Staffel 5).
 */
export function tmdbStaffelFolgentitel(titel: Title, franchise: TmdbEintrag | undefined, nummern: number[]): Map<number, string> | undefined {
  const n = Number(/\bStaffel (\d+)$/.exec(titel.titleDe ?? '')?.[1])
  if (!(n >= 2) || !franchise?.folgen || !FORMATE.has(titel.format ?? '') || (titel.episodes ?? 0) < 6) return undefined
  if (!franchise.nameDe || tmdbName(titel.titleDe) !== tmdbName(franchise.nameDe)) return undefined
  const folgen = franchise.folgen.filter((f) => f.s === n).sort((a, b) => a.e - b.e)
  if (folgen.length !== titel.episodes || folgen.some((f, i) => f.e !== i + 1)) return undefined
  const aus = new Map<number, string>()
  for (const f of folgen) {
    const t = echterTitel(f)
    if (t && nummern.includes(f.e)) aus.set(f.e, t)
  }
  return aus.size ? aus : undefined
}
