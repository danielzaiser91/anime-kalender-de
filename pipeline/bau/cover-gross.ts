import { log, readJson, warn, writeJson } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import type { SynopsisEintrag } from './13-1-anreichern.ts'

/**
 * Mindestbreite eines Plakats, das das AniList-Cover in der Vergrößerung ersetzt: **doppelt so breit** wie dessen 460 Pixel
 * (Daniel, 07.10.2026). Was darunter liegt, bleibt beim AniList-Cover und steht in `data/cover-klein.json` — der Monitor.
 */
export const MIN_BREITE = 920

/**
 * **Das große Plakat an die Beschreibung hängen.** Die Gruppen `synopses/<n>.json` lädt das Panel ohnehin beim Öffnen; ein Feld
 * `cg` ([TMDB-Pfad, Breite, Höhe]) kostet dort rund 40 Byte und keine zusätzliche Anfrage. Das Bild selbst holt erst die Vergrößerung
 * (`cover-max.tsx`).
 *
 * **Der Monitor:** Je Bau steht die Zahl der Titel ohne Cover ab `MIN_BREITE` im Protokoll, die Liste dazu mit Grund in
 * `data/cover-klein.json` (kein Plakat bei TMDB / zu klein / keine TMDB-Zuordnung), damit gezielt nach besseren Quellen gesucht werden kann.
 */
export function ergaenzeCoverGross(synopses: Record<number, SynopsisEintrag>, titel: Title[]): void {
  const poster = readJson<Record<string, { p: string; w: number; h: number } | null>>('data/tmdb-poster.json', {})
  const klein: { id: number; name: string; anilist: number; tmdb: number | null; grund: string }[] = []
  let groß = 0
  for (const t of titel) {
    const p = poster[String(t.id)]
    if (p && p.w >= MIN_BREITE) {
      ;(synopses[t.id] ??= {}).cg = [p.p, p.w, p.h]
      groß++
      continue
    }
    klein.push({
      id: t.id,
      name: t.titleEn ?? t.titleRomaji ?? String(t.id),
      anilist: t.coverImage?.includes('/medium/') ? 230 : 460,
      tmdb: p?.w ?? null,
      grund: p ? 'TMDB-Plakat zu klein' : t.id in poster ? 'kein Plakat bei TMDB' : 'keine TMDB-Zuordnung',
    })
  }
  writeJson('data/cover-klein.json', klein)
  log(`${groß} von ${titel.length} Titeln mit großem Cover (TMDB, ab ${MIN_BREITE} px Breite)`)
  if (klein.length) warn(`${klein.length} Titel ohne Cover ab ${MIN_BREITE} px Breite (Liste: data/cover-klein.json)`)
}
