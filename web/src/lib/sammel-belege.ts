import type { NewsEintrag } from '@shared/types.ts'

/** Adressen, die Belege für mehr als einen Titel sind (Sammelartikel): nur dort zeigt das Bild einen Ausschnitt um den Titel. */
const geteilt = new Set<string>()

/** Merkt sich nach dem Laden der Meldungen, welche Beleg-Adressen von mehreren Titeln genannt werden. */
export function merkeSammelartikel(liste: NewsEintrag[]): void {
  const titel = new Map<string, Set<number>>()
  for (const e of liste) {
    for (const m of e.meldungen) {
      for (const b of m.belege ?? []) titel.set(b.url, (titel.get(b.url) ?? new Set<number>()).add(e.titelId))
    }
  }
  geteilt.clear()
  for (const [url, ids] of titel) if (ids.size > 1) geteilt.add(url)
}

export function istSammelartikel(url: string): boolean {
  return geteilt.has(url)
}
