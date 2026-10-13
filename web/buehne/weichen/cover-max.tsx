/* Alles aus `cover-max.tsx` wie es ist (neue Exporte der Seite bauen die Bühne so nie wieder kaputt) — bis auf das Vorwärmen. */
export * from '../../src/components/detail/cover-max.tsx'

/** Die Bühne baut keine Verbindung zum Bildserver auf (das echte Bauteil setzt beim Überfahren ein `preconnect` auf image.tmdb.org). */
export function coverVorwaermen(): void {}
