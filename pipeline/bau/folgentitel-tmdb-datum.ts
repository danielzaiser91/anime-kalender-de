import { echterTitel, tmdbName, type TmdbEintrag } from './folgentitel-tmdb.ts'

interface Folge {
  nr: number
  de?: string
  en?: string
  datum?: string
}

/**
 * **Deutsche Folgentitel aus TMDB über Sendetag und englischen Titel** — für Serien, die TMDB nicht als eine Staffel mit unserer Folgenzahl führt
 * (Pokémon Reisen: unsere Folgen 1–136 liegen bei TMDB in der Staffel 23–25 des Franchise „Pokémon“, 02.11.2026: 46 Folgen ohne deutschen Titel).
 * Eine Folge bekommt den Titel nur, wenn genau eine TMDB-Folge denselben Sendetag **und** denselben englischen Titel trägt; Namen der Serie und Staffelzählung
 * spielen keine Rolle. Sonst nichts — keine Nummer wird geraten.
 */
export function tmdbTitelNachDatum(folgen: Folge[] | undefined, eintrag: TmdbEintrag | undefined): Map<number, string> | undefined {
  if (!folgen || !eintrag?.folgen) return undefined
  const aus = new Map<number, string>()
  for (const x of folgen) {
    if (x.de || !x.datum || !x.en) continue
    const treffer = eintrag.folgen.filter((f) => f.s >= 1 && f.datum === x.datum && Boolean(f.en) && tmdbName(f.en as string) === tmdbName(x.en as string))
    const titel = treffer.length === 1 ? echterTitel(treffer[0]) : undefined
    if (titel) aus.set(x.nr, titel)
  }
  return aus.size ? aus : undefined
}
