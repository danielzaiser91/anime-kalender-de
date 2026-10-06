import type { Title } from '../../shared/types.ts'
import { readJson } from '../lib/util.ts'
import { crFolgentitel, ladeCrArchiv, mitCrTiteln, type CrSerie } from './folgentitel-cr.ts'
import { tmdbFolgentitel, type TmdbEintrag } from './folgentitel-tmdb.ts'

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
  datum?: string
}

/** Die Dateien, aus denen die Stufen nach aniSearch Titel holen: deutsche Crunchyroll-Serien nach Adresse und TMDB-Folgen je Titel. */
export interface TitelQuellen {
  crSerien: Map<string, CrSerie>
  tmdbFolgen: Record<string, TmdbEintrag>
  tmdbNamen: Record<string, { nameDe?: string }>
}

export function ladeTitelQuellen(): TitelQuellen {
  const cr = readJson<{ serien: (CrSerie & { url: string; katalog?: string })[] }>('data/crunchyroll-dub.json', { serien: [] }).serien
  return {
    crSerien: new Map(cr.filter((s) => s.katalog === 'de').map((s) => [s.url, s])),
    tmdbFolgen: readJson('data/tmdb-folgen.json', {}),
    tmdbNamen: readJson('data/tmdb-titles.json', {}),
  }
}

/** Ein Titel hat keine Folge ohne Namen mehr — dann braucht keine weitere Stufe zu laden. */
function luecke(f: Folge[] | undefined): boolean {
  return !f || f.length < 2 || f.some((x) => !(x.de ?? x.en ?? x.ja))
}

/**
 * Die aniSearch-Liste, wo sie Titel schuldig bleibt, zuerst mit Crunchyroll, dann mit TMDB gefüllt. Ein vorhandener Titel bleibt;
 * die Archive werden nur geöffnet, wo es eine Lücke gibt.
 */
export function mitFremdTiteln(t: Title, ausAs: Folge[] | undefined, q: TitelQuellen): Folge[] | undefined {
  if (!luecke(ausAs)) return ausAs
  const crUrl = t.streams.find((s) => s.platform === 'crunchyroll')?.url
  const crSerie = crUrl ? q.crSerien.get(crUrl) : undefined
  const mitCr = mitCrTiteln(ausAs, crFolgentitel(t, crSerie, ladeCrArchiv(crSerie?.seriesId)))
  if (!luecke(mitCr)) return mitCr
  const nummern = mitCr?.length ? mitCr.map((x) => x.nr) : Array.from({ length: t.episodes ?? 0 }, (_, i) => i + 1)
  return mitCrTiteln(mitCr, tmdbFolgentitel(t, q.tmdbNamen[String(t.id)]?.nameDe, q.tmdbFolgen[String(t.id)], nummern))
}
