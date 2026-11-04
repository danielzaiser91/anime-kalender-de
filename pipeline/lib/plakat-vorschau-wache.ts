/**
 * Wächter für die Plakat-Vorschau der Titelseiten: Jede Seite eines Titels, dessen TMDB-Plakat (w500) mit Maßen
 * bekannt ist und der kein TMDB-Banner hat, führt das Plakat als `og:image`. Das Standardbild an dieser Stelle
 * heißt: Die Maße kamen im Seitenbau nicht an. Seiten mit eigenem Terminbild (andere Adresse der eigenen Domain)
 * zählen nicht als Mangel.
 */
export interface SeitenBild {
  slug: string
  /** `og:image` der erzeugten Seite. */
  bild: string | undefined
}

export function plakatVorschauMaengel(seiten: SeitenBild[], site: string): string[] {
  return seiten
    .filter((s) => s.bild?.startsWith(`${site}og/default.jpg`))
    .map((s) => `${s.slug}: Standardbild statt TMDB-Plakat (Maße kamen im Seitenbau nicht an)`)
}

/**
 * Ratsche „Cover vorhanden, Link-Vorschau trotzdem Standardbild“ (04.11.2026): Titel, deren Seite das Standardbild führt, obwohl der Titel ein Cover hat
 * (AniList-Cover und aniSearch-Kopie ohne belegte Maße, TMDB-Treffer fehlt). Die Zahl darf nur sinken; sinkt sie, wird die Grenze im selben PR nachgezogen.
 */
export interface CoverSeite extends SeitenBild {
  coverImage: string | undefined
}

export function standardTrotzCover(seiten: CoverSeite[], site: string): string[] {
  return seiten.filter((s) => s.coverImage && s.bild?.startsWith(`${site}og/default.jpg`)).map((s) => s.slug)
}

export function standardTrotzCoverMaengel(seiten: CoverSeite[], site: string, hoechstens: number): string[] {
  const slugs = standardTrotzCover(seiten, site)
  return slugs.length > hoechstens ? [`${slugs.length} Titel mit Cover zeigen das Standardbild als Link-Vorschau, erlaubt höchstens ${hoechstens}`] : []
}
