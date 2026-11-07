import type { PlatformId } from './types.ts'

export interface DataMeta {
  generatedAt: string
  titleCount: number
  /** Titel mit dubConfidence high/very-high; der Rest ist wahrscheinlich oder angekündigt. Fehlt vor dem ersten Bau damit. */
  belegtCount?: number
  /** Inhalts-Kennung (sha256, 8 Zeichen) je Datendatei und Datenordner; nur in der ausgelieferten Fassung (`tools/daten-kennungen.ts`), nie im Repo. */
  dateien?: Record<string, string>
  releaseCount: number
  eventCount: number
  genres: string[]
  keywords: string[]
  platforms: PlatformId[]
  /**
   * Bezugsquellen jenseits der bekannten Plattformen — maxdome, Apple TV,
   * Videobuster, die Prime-Video-Kanäle. Nach Häufigkeit sortiert.
   */
  providers: string[]
  years: number[]; patchnotesStand?: string // Letzteres: jüngster Patch-Notes-Tag (Ungelesen-Punkt)
  attribution: string[]
  /** Vom Bestandsbau zurückgestellte Titel samt ihren Releases (`tools/quarantaene.mjs`); fehlt ohne Quarantäne. */
  quarantaene?: ZurueckgestellterTitel[]
}

/** Ein Titel, dessen Daten eine Prüfung verletzt haben: Er fehlt in diesem Datensatz, bis ein Bau ihn sauber liefert. */
export interface ZurueckgestellterTitel {
  titleId: number
  pruefung: string
  grund: string
  releases: string[]
}
