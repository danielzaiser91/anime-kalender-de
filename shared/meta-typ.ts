import type { PlatformId } from './types.ts'

export interface DataMeta {
  generatedAt: string
  titleCount: number
  /** Titel mit dubConfidence high/very-high; der Rest ist wahrscheinlich oder angekündigt. Fehlt vor dem ersten Bau damit. */
  belegtCount?: number
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
}
