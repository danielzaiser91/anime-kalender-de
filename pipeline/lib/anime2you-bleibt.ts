/**
 * Welche Anime2You-Vorschläge bleiben in `data/proposals/anime2you.json`?
 *
 * Ein schon eingearbeiteter Artikel (`alreadyCurated`) fliegt raus, sobald sein Datum vergangen ist — außer er trägt noch etwas,
 * das der Bau liest: Sammeleinträge (auch vergangene, „verfügbar ab 03.11.“) ergeben dort die Termine aller Titel des Artikels.
 * Ein einzelner Beleg (Handbeleg oder Automatik) mit der Artikel-Adresse darf sie nicht verdrängen
 * (08.11.2026: 25 Joyn-Termine aus Artikel 1066831, neun davon mit Automatik-Beleg).
 */
import { addDays } from '../../shared/time.ts'

export interface VorratKandidat {
  alreadyCurated: boolean
  dates: { iso?: string; month?: string | number }[]
  verschiebungen?: unknown[]
  sammel?: unknown[]
}

export function bleibtImVorrat(p: VorratKandidat, heute: string): boolean {
  if (!p.alreadyCurated) return true
  if (p.dates.some((d) => (d.iso ?? `${d.month}-31`) >= heute)) return true
  if (p.verschiebungen?.length) return true
  return Boolean(p.sammel?.length)
}

export interface VorratEintrag extends VorratKandidat {
  articleUrl: string
  publishedAt: string
  hinweis?: 'sprache'
}

/** Bewertet Kuratiertes neu, wirft veraltete Sprachhinweise (`verwirf` zählt sie) und alles, was nicht im Vorrat bleibt. */
export function waehleVorrat<T extends VorratEintrag>(
  liste: T[],
  curatedSources: Set<string>,
  heute: string,
  hinweisTage: number,
  verwirf: (grund: string) => void,
): T[] {
  return liste
    .map((p) => ({ ...p, alreadyCurated: curatedSources.has(p.articleUrl.replace(/\/$/, '')) }))
    .filter((p) => {
      const veraltet = p.hinweis === 'sprache' && p.publishedAt < addDays(heute, -hinweisTage)
      if (veraltet) verwirf(`Sprachhinweis älter als ${hinweisTage} Tage`)
      return !veraltet
    })
    .filter((p) => bleibtImVorrat(p, heute))
}
