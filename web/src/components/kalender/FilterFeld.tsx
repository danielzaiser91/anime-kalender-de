import { useMemo } from 'react'
import type { PlatformId, ReleaseEvent } from '@shared/types.ts'
import type { ReactNode } from 'react'
import type { Dataset } from '../../lib/data.ts'
import { EMPTY_FILTERS, type FilterState } from '../../lib/filters.ts'
import { useLang } from '../../lib/i18n.tsx'
import { FilterDetailsFeld } from '../FilterDetails.tsx'

export interface FilterFeldProps {
  data: Dataset
  filters: FilterState
  onChange: (next: FilterState) => void
  tvAn: boolean
  setTvAn: (an: boolean) => void
  favoriteCount: number
  /** Alle Termine des gezeigten Zeitraums, ungefiltert — daraus die Zahlen an den Chips. */
  zeitraum: ReleaseEvent[]
  treffer: number
  zeitraumWort: string
  schliessen: () => void
}

/**
 * Das Filterfeld des Kalenders.
 *
 * **Dieselbe Ansicht wie die Datenbank** (Daniel, 01.10.2026): die Schnell-Schalter,
 * der Klick-Modus in eigener Zeile und der Kasten mit den betroffenen Filtern. Was
 * hier hinzukommt, sind nur die **Zahlen des Zeitraums** an Anbieter und Genre und
 * der Fernsehen-Schalter. Vorher versteckte „Weitere Filter" den Klick-Modus
 * mit — er greift jetzt sichtbar.
 */
export function FilterFeld(p: FilterFeldProps) {
  const { t } = useLang()
  const zaehlungen = useMemo(() => {
    const proPlattform = new Map<PlatformId, number>()
    const proGenre = new Map<string, number>()
    for (const ev of p.zeitraum) {
      proPlattform.set(ev.platform, (proPlattform.get(ev.platform) ?? 0) + 1)
      for (const g of p.data.titleById.get(ev.titleId)?.genres ?? []) proGenre.set(g, (proGenre.get(g) ?? 0) + 1)
    }
    return { proPlattform, proGenre }
  }, [p.zeitraum, p.data])
  const genreListe = useMemo(() => {
    const gewaehlt = [...p.filters.genres, ...p.filters.excluded.genres]
    return [...zaehlungen.proGenre.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g)
      .filter((g, i) => i < 12 || gewaehlt.includes(g))
  }, [zaehlungen, p.filters.genres, p.filters.excluded.genres])

  return (
    <section
      id="ak-filterfeld"
      aria-label={t('filter.button')}
      className="animate-fade-in rounded-3xl border border-ak-rand bg-ak-flaeche"
    >
      <FilterDetailsFeld
        meta={p.data.meta}
        filters={p.filters}
        onChange={p.onChange}
        showConfidence
        favoriteCount={p.favoriteCount}
        tvAn={p.tvAn}
        setTvAn={p.setTvAn}
        platformZaehlung={zaehlungen.proPlattform}
        genreListe={genreListe}
        genreZaehlung={zaehlungen.proGenre}
      />
      <FilterFuss {...p} />
    </section>
  )
}

export function Schalter({
  an,
  setzen,
  label,
  hinweis,
  ariaLabel,
}: {
  an: boolean
  setzen: (an: boolean) => void
  label: string
  hinweis?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={ariaLabel}
      onClick={() => setzen(!an)}
      className="flex min-h-11 cursor-pointer items-center gap-3 text-left text-sm text-ak-text"
    >
      <span className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition ${an ? 'bg-ak-akzent' : 'bg-ak-rand'}`}>
        <span className={`absolute top-[3px] size-4 rounded-full transition-all ${an ? 'left-[19px] bg-[#0d0f14]' : 'left-[3px] bg-white shadow'}`} />
      </span>
      {label && (
        <span className="flex flex-col">
          <span className="font-bold">{label}</span>
          {hinweis && <span className="text-xs text-ak-leise">{hinweis}</span>}
        </span>
      )}
    </button>
  )
}

export function Pille({
  an,
  aus,
  onClick,
  children,
  farbe,
}: {
  an: boolean
  aus?: boolean
  onClick: () => void
  children: ReactNode
  farbe?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={an || aus}
      onClick={onClick}
      className={[
        'inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition sm:h-9',
        aus
          ? 'border-rose-400/70 bg-rose-500/10 text-rose-600 line-through dark:text-rose-300'
          : an
            ? 'border-transparent bg-emerald-500 text-emerald-950'
            : 'border-ak-rand bg-ak-flaeche-2 text-ak-text hover:border-ak-leise',
      ].join(' ')}
    >
      {farbe && <span className="size-2 rounded-full" style={{ background: farbe }} aria-hidden="true" />}
      {children}
    </button>
  )
}

function FilterFuss(p: FilterFeldProps) {
  const { t } = useLang()
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-ak-linie px-5 pb-4 pt-3">
      <span className="text-sm text-ak-leise">
        <b className="font-extrabold text-ak-text">{p.treffer}</b> {t('filter.treffer', { gesamt: p.zeitraum.length, zeitraum: p.zeitraumWort })}
      </span>
      <button
        type="button"
        onClick={() => {
          p.onChange({ ...EMPTY_FILTERS })
          p.setTvAn(true)
        }}
        className="ml-auto h-11 cursor-pointer rounded-full border border-ak-rand px-4 text-sm font-bold text-ak-text hover:bg-ak-flaeche-2"
      >
        {t('filter.alleZuruecksetzen')}
      </button>
      <button type="button" onClick={p.schliessen} className="h-11 cursor-pointer rounded-full bg-ak-akzent px-5 text-sm font-extrabold text-ak-auf-akzent">
        {t('filter.fertig')}
      </button>
    </div>
  )
}
