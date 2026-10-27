/**
 * Wache für den Auftakt einer laufenden Crunchyroll-Staffel (Psyren, 26.10.2026): Eine Serie, die in diesem Jahr in Japan gestartet ist und
 * deren Block mehr Folgen führt als die eine deutsche, ist kein Katalogtitel — sie steht nicht als „Neu bei Crunchyroll“ (`available-from`) im Bestand,
 * sondern als wöchentlicher Staffelstart. Die Saison belegt `Title.jpYear` (AniList); ein älterer Titel mit einer deutschen Folge ist Katalognachschub.
 */
import type { Release, Title } from '../../shared/types.ts'
import type { CrSerie } from './crunchyroll-dub.ts'

/** Das Jahr, in dem der Termin liegt, ist das Startjahr der Serie: laufende oder gerade begonnene Saison. */
export function startetImTerminjahr(title: Pick<Title, 'jpYear'> | undefined, terminTag: string): boolean {
  return title?.jpYear !== undefined && title.jpYear >= Number(terminTag.slice(0, 4))
}

const TAG_MS = 86_400_000

/** Katalogtermine einer Serie aus dem Terminjahr, deren Block erst teilweise deutsch ist und an diesem Tag begann. */
export function auftaktAlsKatalog(releases: Release[], titles: Map<number, Title>, serien: CrSerie[]): Release[] {
  return releases.filter((r) => {
    if (r.platform !== 'crunchyroll' || r.dateMeaning !== 'available-from') return false
    const tag = r.schedule?.firstEpisodeDate
    if (!tag || !startetImTerminjahr(titles.get(r.titleId), tag)) return false
    const kennung = /series\/([A-Z0-9]+)/.exec(r.platformUrl ?? '')?.[1]
    const serie = serien.find((s) => s.seriesId === kennung)
    return (serie?.staffeln ?? []).some((b) => {
      const tage = (b.deutscheFolgen ?? []).map((f) => f.verfuegbarAb?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort()
      return tage.length === 1 && b.folgen > 1 && Math.abs(Date.parse(tage[0]!) - Date.parse(tag)) <= TAG_MS
    })
  })
}
