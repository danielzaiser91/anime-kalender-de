import { useMemo } from 'react'
import type { FranchiseMember, Release, Title } from '@shared/types.ts'
import { addDays } from '@shared/time.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import type { Dataset } from '../../lib/data.ts'
import { Tooltip } from '../ui.tsx'
import { jpAngabe } from './kino.tsx'

/**
 * Das Bild der Bühne — seit dem 24.08.2026 das **Cover**, nicht das Banner.
 *
 * Gemessen: Alle 2.762 Titel haben ein `coverImage`, aber nur 2.111 ein
 * `bannerImage`. Bei 651 Titeln stand oben deshalb ein leerer Farbverlauf.
 * Das Cover trägt außerdem das, was ein Zuschauer wiedererkennt — es ist das
 * Bild, das auch auf einer Hülle stünde.
 *
 * Der frühere Rückfall „Banner von einem Reihenteil leihen" entfällt: Er war
 * nötig, weil der Kopf beim Umschalten auf ein Special um 112 Pixel sprang.
 * Mit dem Cover tritt der Fall nicht mehr ein.
 */
export function useBuehnenBild(title: Title | undefined, reihenTeile: FranchiseMember[], data: Dataset): string | undefined {
  return useMemo(() => {
    if (!title) return undefined
    if (title.coverImage) return title.coverImage
    // Sollte nie greifen — steht als Netz für einen künftigen Titel ohne Cover.
    for (const m of reihenTeile) {
      const t = data.titleById.get(m.id)
      if (t?.coverImage) return t.coverImage
    }
    return undefined
  }, [title, reihenTeile, data])
}

/**
 * **Der Kinostart steht im Banner, nicht als Pille** (17.09.2026). Gezeigt wird er,
 * solange er läuft (belegter letzter Spieltag) oder bevorsteht — und bis 60 Tage nach
 * dem Start, solange niemand ein Ende belegt hat.
 */
export function useKinoRelease(releases: Release[], today: string) {
  return useMemo(
    () =>
      releases
        .filter((r) => r.platform === 'kino' && r.schedule?.firstEpisodeDate)
        .filter((r) =>
          r.cinemaUntil ? r.cinemaUntil >= today : r.schedule!.firstEpisodeDate! >= addDays(today, -60),
        )
        .sort((a, b) => a.schedule!.firstEpisodeDate!.localeCompare(b.schedule!.firstEpisodeDate!))[0],
    [releases, today],
  )
}

/** Die Werkangaben der Unterzeile — leer heißt: kein Kasten. */
export function unterzeileVon(
  title: Title | undefined,
  eigenerTeil: FranchiseMember | undefined,
  folgenImKasten: boolean,
  folgenWort: string,
): (string | undefined)[] {
  if (!title) return []
  return [
    title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
    title.episodes && title.episodes > 1 && !folgenImKasten ? `${title.episodes} ${folgenWort}` : undefined,
    jpAngabe(eigenerTeil?.jpStart ?? (title.westlich ? title.jpStart : undefined), title.jpYear, title.land),
    title.studios?.[0],
  ].filter(Boolean)
}

/** Die Wertung als Pille — steht neben dem Staffelnamen; Quelle aniSearch, bei Cartoons TMDB. */
export function WertungPille({ title, hinweis }: { title: Title; hinweis: string }) {
  return (
    <Tooltip text={hinweis} seite="oben">
      <span className="inline-flex shrink-0 cursor-help items-baseline gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
        <span className="font-normal text-slate-500 dark:text-slate-400">{title.scoreQuelle === 'tmdb' ? 'TMDB' : 'aniSearch'}</span>
        {/* Der Stern macht auf einen Blick klar, dass es eine Wertung ist und
            keine Folgenzahl. */}
        <span className="text-amber-400" aria-hidden="true">
          ★
        </span>
        <span className="font-semibold tabular-nums">{((title.score ?? 0) / 10).toFixed(1)}</span>
      </span>
    </Tooltip>
  )
}
