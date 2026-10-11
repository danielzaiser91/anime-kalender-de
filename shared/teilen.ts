/** Pfad der Teilen-Seite eines Titels: Der Knopf (Web) und der Seitenbau (Pipeline) nennen dieselbe Adresse. */
export function teilenPfad(slug: string | number): string {
  return `t/${slug}/`
}

/**
 * Der Slug, den der Teilen-Knopf nennt — oder nichts, wenn der Titel keine Teilen-Seite hat (statt eines toten Links).
 * Seiten gibt es für den Hauptbestand und die Cartoons (`pipeline/build-share-pages.ts`), nicht für den Katalog ohne Synchro.
 */
export function teilbarerSlug(titel: { slug?: string; ohneSynchro?: boolean } | undefined): string | undefined {
  return titel?.slug && !titel.ohneSynchro ? titel.slug : undefined
}

/** Cartoon mit belegter deutscher Synchro: ein Weg mit `dub: true`. „Laut JustWatch“ (`dubHinweis`) reicht für die Sitemap nicht. */
export function cartoonMitSynchroBeleg(titel: { streams?: Array<{ dub?: boolean }> }): boolean {
  return (titel.streams ?? []).some((s) => s.dub === true)
}
