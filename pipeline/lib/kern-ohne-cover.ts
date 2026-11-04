import { istEigenerTitel } from '../../shared/eigene-titel.ts'

/**
 * Die Kern-Titel (`titles-core.json`), denen ein Cover fehlt und die das zum Fehler macht (`check-bild-bestand.ts`). Ausgenommen sind eigene Titel
 * (`data/eigene-titel.yaml`): Sie haben keinen AniList-Eintrag und keine aniSearch-Zeile, also keine Cover-Quelle; ein TMDB-Plakat kommt erst, wenn
 * jemand die Zuordnung trägt. Sie erscheinen als Warnung in `check-eigene-titel-bestand.ts`, nicht als Fehler.
 */
export function kernOhneCover(kern: { id: number; coverImage?: string }[]): number[] {
  return kern.filter((t) => !t.coverImage && !istEigenerTitel(t.id)).map((t) => t.id)
}
