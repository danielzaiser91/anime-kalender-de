import { schluesselAdresse } from './zuordnung.ts'

type MitStreams = { id: number; streams?: Array<{ url: string; seite?: string }> }

/** Adresse (Schlüssel wie `schluesselAdresse`) → alle Titel, die dort einen Verweis tragen; Staffeln teilen sich eine Adresse. */
export function baueNachUrl(liste: MitStreams[]): Map<string, number[]> {
  const nachUrl = new Map<string, number[]>()
  for (const t of liste) {
    for (const s of t.streams ?? []) {
      /* Die Prüfliste öffnet die Amazon-Seite (`seite`), nicht JustWatchs gti-Adresse (17.09.2026). */
      for (const u of new Set([s.url, s.seite])) {
        if (!u) continue
        nachUrl.set(schluesselAdresse(u), [...(nachUrl.get(schluesselAdresse(u)) ?? []), t.id])
      }
    }
  }
  return nachUrl
}
