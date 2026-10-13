/**
 * **„Zuletzt im Kino: April 2026“ — eine kleine Datei für das Detail-Panel (Filme mit TMDB-Kinostart).**
 *
 * Nicht in `titles.json`: Das Feld betrifft nur Filme mit deutschem Kinostart (254 von 716 Filmen mit TMDB-Kennung, 13.10.2026),
 * also eine Minderheit (`ARCHITEKTUR.md`, Punkt 2). Das Panel lädt `kino-zuletzt.json` erst, wenn ein Film offen ist.
 * Quelle ist `kinoDe` in `data/tmdb-titles.json` (`fetch-tmdb-titles.ts`); die Datei trägt nur den Monat des jüngsten Starts bis heute.
 */
import { writeJson, log } from '../lib/util.ts'
import { zuletztImKino } from '../lib/tmdb-kino-zuletzt.ts'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { OUT } from './grundlagen.ts'

type TmdbKino = { kind?: 'tv' | 'movie'; kinoDe?: string[] }

/** AniList-Kennung → Monat des letzten deutschen Kinostarts (`JJJJ-MM`). Nur Filme, deren TMDB-Zuordnung ein Film ist. */
export function kinoZuletztVon(titles: Iterable<Pick<Title, 'id' | 'format'>>, tmdb: Record<string, TmdbKino>, heute: string): Record<number, string> {
  const monate: Record<number, string> = {}
  for (const t of titles) {
    const e = tmdb[t.id]
    if (t.format !== 'MOVIE' || e?.kind !== 'movie') continue
    const monat = zuletztImKino(e.kinoDe, heute)
    if (monat) monate[t.id] = monat
  }
  return monate
}

export function schreibeKinoZuletzt(titles: Map<number, Title>, tmdb: Record<string, TmdbKino>): void {
  const monate = kinoZuletztVon(titles.values(), tmdb, todayIso())
  writeJson(`${OUT}/kino-zuletzt.json`, monate)
  log(`${Object.keys(monate).length} Filme mit „Zuletzt im Kino“`)
}
