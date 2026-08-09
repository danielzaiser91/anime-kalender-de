import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import type { Fsk, PlatformId, ReleaseType, Schedule } from '../../shared/types.ts'

export interface CuratedEntry {
  slug: string
  search?: string
  anilistId?: number
  malId?: number
  titleDe?: string
  platform: PlatformId
  platformUrl?: string
  buyUrl?: string
  releaseType: ReleaseType
  fsk?: Fsk
  publisher?: string
  edition?: string
  note?: string
  genres?: string[]
  keywords?: string[]
  schedule?: Schedule
  sources?: string[]
}

const CURATED_DIR = resolve(ROOT, 'data', 'curated')

export function loadCurated(): CuratedEntry[] {
  const files = readdirSync(CURATED_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  const entries: CuratedEntry[] = []
  for (const file of files) {
    const raw = yaml.load(readFileSync(resolve(CURATED_DIR, file), 'utf8'))
    if (!Array.isArray(raw)) continue
    for (const item of raw as CuratedEntry[]) {
      entries.push({ ...item, sources: item.sources ?? [] })
    }
  }
  return entries
}

/** Ein von Hand gepflegter Bezugsweg zu einem Titel. */
export interface CuratedWatch {
  anilistId: number
  title?: string
  links: { name: string; url: string; kind: 'stream' | 'buy' }[]
  sources: string[]
}

/**
 * Lädt `data/watch-links.yaml`.
 *
 * Getrennt von den Terminen, weil es etwas anderes beschreibt: nicht *wann*
 * etwas läuft, sondern *wo* es zu haben ist. Für alte Katalogtitel ist das die
 * einzige sinnvolle Auskunft — ein Datum gibt es dort nicht mehr.
 */
export function loadWatchLinks(): CuratedWatch[] {
  const file = resolve(ROOT, 'data/watch-links.yaml')
  try {
    const parsed = yaml.load(readFileSync(file, 'utf8')) as CuratedWatch[] | null
    return (parsed ?? []).filter((e) => e?.anilistId && e.links?.length)
  } catch {
    return []
  }
}
