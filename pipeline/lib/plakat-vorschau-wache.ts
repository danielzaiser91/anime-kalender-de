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
