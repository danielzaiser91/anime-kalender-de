import type { Title } from '../../shared/types.ts'

/** Crunchyroll-Serienkennung → erster Titel, dessen Verweis sie trägt. */
export function titelNachSerienId(titles: Title[]): Map<string, Title> {
  const karte = new Map<string, Title>()
  for (const t of titles) {
    for (const s of t.streams) {
      const id = /crunchyroll\.com\/(?:[a-z-]+\/)?series\/([A-Z0-9]+)/i.exec(s.url)?.[1]
      if (id && !karte.has(id)) karte.set(id, t)
    }
  }
  return karte
}
