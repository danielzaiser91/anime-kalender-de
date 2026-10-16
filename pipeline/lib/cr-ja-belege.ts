import type { Title } from '../../shared/types.ts'

export interface BelegQuellen {
  /** Handbelege (`data/dub-confirmed.yaml`). */
  handbelege: { platform: string; dub?: boolean; anilistId: number }[]
  /** `cr-einzelwerke.json` und `cr-filmbloecke.json`. */
  katalog: { id: number; treffer?: { audio?: string[] } | null }[]
  zuordnung: { id: number; audio?: string[] }[]
  /** `crunchyroll-offene.json`, nach Adresse. */
  offene: Record<string, { dub?: boolean }>
  titel: Title[]
}

/** Titel mit Crunchyroll-Ja aus Hand oder Katalog, die der Bau nach Titelkennung (`09-4-3`) oder Adresse (`09-6`) anwendet. */
export function crBelegKennungen({ handbelege, katalog, zuordnung, offene, titel }: BelegQuellen): Set<number> {
  const ids = new Set<number>()
  for (const c of handbelege) {
    if (c.platform === 'crunchyroll' && c.dub === true) ids.add(c.anilistId)
  }
  for (const e of katalog) {
    if (e.treffer?.audio?.includes('de-DE')) ids.add(e.id)
  }
  for (const z of zuordnung) {
    if (z.audio?.includes('de-DE')) ids.add(z.id)
  }
  for (const t of titel) {
    if (t.streams?.some((st) => st.platform === 'crunchyroll' && offene[st.url]?.dub === true)) ids.add(t.id)
  }
  return ids
}
