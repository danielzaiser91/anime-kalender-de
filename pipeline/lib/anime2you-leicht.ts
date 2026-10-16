/**
 * Leichter Anime2You-Abruf (`--leicht`, stündlich): nur die jeweils erste Feed-Seite, Volltexte nur für Adressen, die der Bestand noch nicht kennt,
 * keine Nachhol-Abrufe, und die Datei wird nur bei neuem Inhalt geschrieben (sonst entstünde stündlich ein Pull Request nur wegen `scrapedAt`).
 */

/** Feeds des leichten Abrufs: ohne Blätterseiten (`?paged=2` und weiter). */
export function leichteFeeds<T extends { url: string }>(feeds: T[]): T[] {
  return feeds.filter((f) => !f.url.includes('?paged='))
}

/** Volltext holen? Im leichten Abruf nur bei neuer Adresse; im vollen Abruf wie bisher immer. */
export function volltextNoetig(leicht: boolean, bekannt: ReadonlyMap<string, unknown>, adresse: string): boolean {
  return !leicht || !bekannt.has(adresse)
}

/** Ändert der Lauf die Vorschlagsliste? Ohne Änderung bleibt die Datei unberührt. */
export function vorschlaegeGeaendert(alt: unknown[], neu: unknown[]): boolean {
  return JSON.stringify(alt) !== JSON.stringify(neu)
}
