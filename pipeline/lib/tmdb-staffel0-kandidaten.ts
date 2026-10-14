import type { Staffel0Titel } from './tmdb-staffel0.ts'

/** Was ein Titel aus `public/data/titles.json` hier braucht. */
export interface TitelQuelle {
  id: number
  format?: string
  episodes?: number
  runtimeMin?: number
  titleEn?: string
  titleRomaji?: string
  titleNative?: string
  titleDe?: string
}

/** Mitglied einer Reihe in `public/data/franchises.json`; dort steht der japanische Start. */
export interface ReiheMitglied {
  id: number
  jpStart?: string
  episodes?: number
}

type Zuordnung = Record<string, { tmdbId?: number; kind?: string }>

export interface Staffel0Kandidat {
  id: number
  titel: Staffel0Titel
  /** TMDB-Serien (Kennungen) der Reihe, in deren Staffel 0 der Titel stehen kann. */
  serien: number[]
}

/** Serien sind TV-Staffeln, nicht Specials; sie haben bei TMDB eine Staffel, nie eine Folge der Staffel 0. */
const SERIENFORMEN = new Set(['TV', 'TV_SHORT'])

/**
 * Titel ohne TMDB-Kennung, die kein TV sind, aber in einer Reihe stehen, deren anderer Titel eine TMDB-Serie trägt (`tmdb-titles.json`, wie
 * `staffelPlakate` in `fetch-tmdb-poster.ts`). Titel ohne japanischen Start fallen heraus: ohne Datum gibt es keinen Beleg.
 */
export function staffel0Kandidaten(titel: TitelQuelle[], reihen: Record<string, ReiheMitglied[]>, zuordnung: Zuordnung): Staffel0Kandidat[] {
  const mitglied = new Map<number, { reihe: ReiheMitglied[]; m: ReiheMitglied }>()
  for (const reihe of Object.values(reihen)) for (const m of reihe) mitglied.set(m.id, { reihe, m })
  const serienDer = (reihe: ReiheMitglied[]): number[] => [
    ...new Set(reihe.map((m) => zuordnung[String(m.id)]).filter((z) => z?.kind === 'tv' && z.tmdbId).map((z) => z!.tmdbId!)),
  ]
  const kandidaten: Staffel0Kandidat[] = []
  for (const t of titel) {
    const eintrag = mitglied.get(t.id)
    if (!eintrag?.m.jpStart || SERIENFORMEN.has(t.format ?? '') || zuordnung[String(t.id)]?.tmdbId) continue
    const serien = serienDer(eintrag.reihe)
    if (!serien.length) continue
    const namen = [t.titleEn, t.titleRomaji, t.titleNative, t.titleDe]
    kandidaten.push({ id: t.id, serien, titel: { start: eintrag.m.jpStart, folgen: eintrag.m.episodes ?? t.episodes, minuten: t.runtimeMin, namen } })
  }
  return kandidaten
}
