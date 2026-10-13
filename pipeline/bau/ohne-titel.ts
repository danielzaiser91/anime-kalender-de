import { warn } from '../lib/util.ts'

type Eintrag = { titleId: number; name: string; platform: string; slug?: string; releaseSlug?: string }

/**
 * Kein Release und kein Termin ohne Titel im Kalender (`titleId -1`, Daniel 12.10.2026).
 *
 * Die Karte öffnete das Panel mit „Zu diesem Eintrag liegen keine Metadaten vor" (ADN „Bleach: Memories of
 * Nobody", Crunchyroll Anime Awards). Der Eintrag wird aus den Listen genommen und mit Namen gemeldet, damit
 * eine fehlende Zuordnung im Bau-Protokoll auffällt, statt als tote Kachel beim Besucher. Negative Kennungen
 * ab -2 sind TMDB-Cartoons mit eigener Datei und bleiben.
 */
export function entferneOhneTitel(...listen: Eintrag[][]): void {
  const gemeldet = new Set<string>()
  for (const liste of listen) {
    for (let i = liste.length - 1; i >= 0; i--) {
      const e = liste[i]!
      if (e.titleId !== -1) continue
      liste.splice(i, 1)
      const kennung = e.slug ?? e.releaseSlug ?? e.name
      if (gemeldet.has(kennung)) continue
      gemeldet.add(kennung)
      warn(`"${kennung}" (${e.platform}: ${e.name}) hat keinen Titel — nicht im Kalender, Zuordnung fehlt`)
    }
  }
}
