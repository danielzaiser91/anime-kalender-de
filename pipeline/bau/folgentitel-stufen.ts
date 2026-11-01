import { resolve } from 'node:path'
import type { Title } from '../../shared/types.ts'
import { ROOT, readJson } from '../lib/util.ts'
import { crFolgentitel, ladeCrArchiv, mitCrTiteln, type CrSerie } from './folgentitel-cr.ts'
import { crFolgentitelGeteilt } from './folgentitel-cr-geteilt.ts'
import { tmdbFolgentitel, type TmdbEintrag } from './folgentitel-tmdb.ts'
import { mitKitsuTiteln, type KitsuEintrag } from './folgentitel-kitsu.ts'
import { rtlplusFolgentitel, type RtlplusEintrag } from './folgentitel-rtlplus.ts'
import { ladeHandTitel } from './folgentitel-hand.ts'

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
  datum?: string
}

/** Die Dateien, aus denen die Stufen nach aniSearch Titel holen: deutsche Crunchyroll-Serien nach Adresse, TMDB-Folgen und RTL+-Titel je Titel, Handzuordnung. */
export interface TitelQuellen {
  crSerien: Map<string, CrSerie>
  tmdbFolgen: Record<string, TmdbEintrag>
  tmdbNamen: Record<string, { nameDe?: string }>
  kitsu: Record<string, KitsuEintrag>
  rtlplus: Record<string, RtlplusEintrag>
  hand: Record<string, Map<number, string>>
}

export function ladeTitelQuellen(): TitelQuellen {
  const cr = readJson<{ serien: (CrSerie & { url: string; katalog?: string })[] }>('data/crunchyroll-dub.json', { serien: [] }).serien
  return {
    crSerien: new Map(cr.filter((s) => s.katalog === 'de').map((s) => [s.url, s])),
    tmdbFolgen: readJson('data/tmdb-folgen.json', {}),
    tmdbNamen: readJson('data/tmdb-titles.json', {}),
    kitsu: readJson('data/kitsu-folgen.json', {}),
    rtlplus: readJson<{ titel?: Record<string, RtlplusEintrag> }>('data/rtlplus-folgen.json', {}).titel ?? {},
    hand: ladeHandTitel(resolve(ROOT, 'data/folgentitel-hand.yaml')),
  }
}

/** Ein Titel hat keine Folge ohne Namen mehr — dann braucht keine weitere Stufe zu laden. */
export function luecke(f: Folge[] | undefined): boolean {
  return !f || f.length < 2 || f.some((x) => !x.de)
}

/** Nummer → Titel der Folgen, die schon einen Titel (deutsch, sonst englisch oder japanisch) tragen. */
function vorhandeneTitel(f: Folge[] | undefined): Map<number, string> {
  return new Map((f ?? []).flatMap((x) => (x.de ?? x.en ?? x.ja ? [[x.nr, (x.de ?? x.en ?? x.ja) as string] as [number, string]] : [])))
}

/**
 * Die aniSearch-Liste, wo sie Titel schuldig bleibt, nacheinander gefüllt: Crunchyroll, RTL+, TMDB, zuletzt die Handzuordnung. Ein vorhandener Titel bleibt;
 * die Archive werden nur geöffnet, wo es eine Lücke gibt.
 */
export function mitFremdTiteln(t: Title, ausAs: Folge[] | undefined, q: TitelQuellen): Folge[] | undefined {
  const kitsu = q.kitsu[String(t.id)]
  if (!luecke(ausAs)) return mitKitsuTiteln(t, ausAs, kitsu)
  const crUrl = t.streams.find((s) => s.platform === 'crunchyroll')?.url
  const crSerie = crUrl ? q.crSerien.get(crUrl) : undefined
  const archiv = ladeCrArchiv(crSerie?.seriesId)
  const mitCr = mitCrTiteln(ausAs, crFolgentitel(t, crSerie, archiv) ?? crFolgentitelGeteilt(t, crSerie, archiv, vorhandeneTitel(ausAs)))
  const mitRtl = mitCrTiteln(mitCr, rtlplusFolgentitel(vorhandeneTitel(mitCr), q.rtlplus[String(t.id)]))
  if (!luecke(mitRtl)) return mitKitsuTiteln(t, mitRtl, kitsu)
  const nummern = mitRtl?.length ? mitRtl.map((x) => x.nr) : Array.from({ length: t.episodes ?? 0 }, (_, i) => i + 1)
  const mitTmdb = mitCrTiteln(mitRtl, tmdbFolgentitel(t, q.tmdbNamen[String(t.id)]?.nameDe, q.tmdbFolgen[String(t.id)], nummern, vorhandeneTitel(mitRtl)))
  return mitKitsuTiteln(t, mitCrTiteln(mitTmdb, q.hand[String(t.id)]), kitsu)
}
