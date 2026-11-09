/**
 * **Archiv führt eine deutsche Disc, der Titel zeigt keinen Disc-Verweis** (Daniel, 06.11.2026: Ziel 100 % der Titel mit belegter Disc).
 * Gemessen am 06.11.2026: 174 Titel verloren ihre Disc, weil `extract-disc-ausgaben.ts` sie nur über `anisearch.json` zuordnete.
 * Die Zahl darf nur sinken: `data/disc-archiv-stand.json` hält die Titelkennungen des Standes; jede Kennung außerhalb davon oder
 * über `hoechstens` ist neu. Maßstab ist die Archivseite des Titels (Kennung aus `anisearchId`), nicht die Zuordnung — so
 * fällt auch ein Rückschritt der Zuordnung auf.
 */

export interface ArchivStand {
  stand: string
  hoechstens: number
  /** Titelkennungen, die der Stand als offen kennt. */
  ids: number[]
}

export interface ArchivBilanz {
  anzahl: number
  /** Offene Titel, die der Stand nicht kennt. */
  neu: number[]
  /** Kennungen des Standes, die jetzt einen Verweis haben (Liste darf gekürzt werden). */
  erledigt: number[]
  ueberGrenze: boolean
}

interface TitelKurz {
  id: number
  watchLinks?: { kind?: string }[]
}
interface ReleaseKurz {
  titleId: number
  releaseType?: string
}

/** Ein Disc-Verweis ist ein Kauflink oder ein Disc-Termin (Anzeige: `antwort-berechnen.ts`, `DetailPanel.tsx`). */
export function titelMitDiscVerweis(titles: TitelKurz[], releases: ReleaseKurz[]): Set<number> {
  const mit = new Set<number>()
  for (const t of titles) if ((t.watchLinks ?? []).some((w) => w.kind === 'buy')) mit.add(t.id)
  for (const r of releases) if (r.releaseType === 'disc') mit.add(r.titleId)
  return mit
}

export function archivBilanz(archivTitel: Iterable<number>, mitVerweis: Set<number>, stand: ArchivStand): ArchivBilanz {
  const offen = [...new Set(archivTitel)].filter((id) => !mitVerweis.has(id))
  const bekannt = new Set(stand.ids)
  const jetzt = new Set(offen)
  return {
    anzahl: offen.length,
    neu: offen.filter((id) => !bekannt.has(id)),
    erledigt: stand.ids.filter((id) => !jetzt.has(id)),
    ueberGrenze: offen.length > stand.hoechstens,
  }
}
