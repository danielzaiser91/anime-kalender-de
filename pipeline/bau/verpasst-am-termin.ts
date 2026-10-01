/**
 * **Was der Anbieter nicht eingehalten hat, steht am Termin.**
 *
 * `pipeline/termine-pruefen.ts` schreibt die Fälle nach
 * `data/termine-verpasst.json`; hier wandern sie an den Sendeplan, damit
 * `expandEvents()` sie an das jeweilige Ereignis hängt. Ein Termin, an dem
 * nichts erschien, verschwindet damit nicht — er sagt es (Daniel, 31.08.2026:
 * „falsche infos auf der webseite sind unbedingt zu vermeiden").
 *
 * Aufsteigend nach Termin: Fällt eine Folge zweimal aus (am alten Tag und am
 * recherchierten Ersatztermin), gilt der jüngere Vermerk.
 *
 * Liegt in einer eigenen Datei, weil `baueReleases` die Längengrenze reißt.
 */
/** Nur die Felder, die am Sendeplan landen — `grundlagen.ts` liest einen schmaleren Typ. */
type Verpasst = {
  slug: string
  episode: number | null
  erwartetAm: string
  erschienenAm?: string | null
  verzugStunden?: number | null
  folgenVerfuegbar?: number | null
  neuErwartet?: string | null
  recherche?: string | null
  rechercheQuelle?: string | null
  rechercheAm?: string | null
  geprueftAm?: string | null
  newsGeprueftAm?: string | null
  hinweise?: { quelle: string; titel: string; url: string; datum: string }[]
}

export function verpasstAmTermin(slug: string, verpasst: Verpasst[]) {
  const hier = verpasst
    .filter((v) => v.slug === slug && v.episode != null)
    .sort((a, b) => a.erwartetAm.localeCompare(b.erwartetAm))
  if (!hier.length) return undefined
  return Object.fromEntries(
    hier.map((v) => [
      v.episode as number,
      {
        erwartetAm: v.erwartetAm,
        ...(v.erschienenAm ? { erschienenAm: v.erschienenAm } : {}),
        ...(v.verzugStunden != null ? { verzugStunden: v.verzugStunden } : {}),
        ...(v.folgenVerfuegbar != null ? { folgenVerfuegbar: v.folgenVerfuegbar } : {}),
        ...(v.neuErwartet ? { neuErwartet: v.neuErwartet } : {}),
        ...(v.recherche ? { recherche: v.recherche } : {}),
        ...(v.recherche && v.rechercheQuelle ? { rechercheQuelle: v.rechercheQuelle } : {}),
        ...(v.rechercheAm ? { rechercheAm: v.rechercheAm } : {}),
        ...(v.geprueftAm ? { geprueftAm: v.geprueftAm } : {}),
        ...(v.newsGeprueftAm ? { newsGeprueftAm: v.newsGeprueftAm } : {}),
        ...(v.hinweise?.length ? { hinweise: v.hinweise } : {}),
      },
    ]),
  )
}
