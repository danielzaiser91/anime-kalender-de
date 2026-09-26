import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { PlatformId, ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { EMPTY_FILTERS, filterMode, toggleFilter, type FilterState } from '../../lib/filters.ts'
import { useLang } from '../../lib/i18n.tsx'
import { FilterDetailsFeld } from '../FilterDetails.tsx'
import { AniListImport } from '../AniListImport.tsx'

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
 * Das Filterfeld des Kalenders (Prototyp B, 26.09.2026): Schnellschalter, Anbieter und Genres mit
 * der Zahl ihrer Termine im gezeigten Zeitraum, dahinter die übrigen Filter. Der AniList-Import sitzt
 * unter „Nur Favoriten", seit es keinen eigenen Favoriten-Reiter mehr gibt.
 */
export function FilterFeld(p: FilterFeldProps) {
  const { t } = useLang()
  const [weitere, setWeitere] = useState(false)
  return (
    <section
      id="ak-filterfeld"
      aria-label={t('filter.button')}
      className="animate-fade-in grid gap-6 rounded-3xl border border-ak-rand bg-ak-flaeche p-5 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8"
    >
      <SchnellSchalter {...p} />
      <AnbieterChips {...p} />
      <GenreChips {...p} />
      <div className="lg:col-span-3">
        <button
          type="button"
          onClick={() => setWeitere(!weitere)}
          aria-expanded={weitere}
          className="cursor-pointer text-[13px] font-bold text-ak-akzent-text hover:underline"
        >
          {weitere ? t('filter.weitereZu') : t('filter.weitere')}
        </button>
        {weitere && (
          <div className="mt-3 rounded-2xl border border-ak-linie">
            <FilterDetailsFeld meta={p.data.meta} filters={p.filters} onChange={p.onChange} showConfidence={false} imKalender />
          </div>
        )}
      </div>
      <FilterFuss {...p} />
    </section>
  )
}

function Ueberschrift({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 text-xs font-extrabold uppercase tracking-[0.12em] text-ak-leise">{children}</h2>
}

function SchnellSchalter(p: FilterFeldProps) {
  const { t } = useLang()
  const [import_, setImport] = useState(false)
  const set = (patch: Partial<FilterState>) => p.onChange({ ...p.filters, ...patch })
  return (
    <div className="flex flex-col gap-1">
      <Ueberschrift>{t('filter.schnell')}</Ueberschrift>
      <Schalter an={p.filters.favoritesOnly} setzen={(an) => set({ favoritesOnly: an })} label={`${t('filter.nurFavoriten')}${p.favoriteCount ? ` (${p.favoriteCount})` : ''}`} hinweis={t('filter.favHinweis')} />
      <button
        type="button"
        onClick={() => setImport(!import_)}
        aria-expanded={import_}
        className="ml-[50px] cursor-pointer self-start text-left text-[13px] font-bold text-ak-akzent-text hover:underline"
      >
        {t('filter.anilist')}
      </button>
      {import_ && (
        <div className="my-1 rounded-xl border border-ak-linie p-2">
          <AniListImport data={p.data} />
        </div>
      )}
      <Schalter an={p.filters.kostenlosOnly} setzen={(an) => set({ kostenlosOnly: an })} label={t('filter.nurKostenlos')} hinweis={t('filter.kostenlosKurz')} />
      <Schalter an={p.filters.confirmedOnly} setzen={(an) => set({ confirmedOnly: an })} label={t('filter.bestaetigt')} hinweis={t('filter.bestaetigtHinweis')} />
      <Schalter an={p.tvAn} setzen={p.setTvAn} label={t('filter.tvZeigen')} hinweis={t('filter.tvHinweis')} />
    </div>
  )
}

export function Schalter({ an, setzen, label, hinweis, ariaLabel }: { an: boolean; setzen: (an: boolean) => void; label: string; hinweis?: string; ariaLabel?: string }) {
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

export function Pille({ an, aus, onClick, children, farbe }: { an: boolean; aus?: boolean; onClick: () => void; children: ReactNode; farbe?: string }) {
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
            ? 'border-ak-akzent bg-ak-akzent text-ak-auf-akzent'
            : 'border-ak-rand bg-ak-flaeche-2 text-ak-text hover:border-ak-leise',
      ].join(' ')}
    >
      {farbe && <span className="size-2 rounded-full" style={{ background: farbe }} aria-hidden="true" />}
      {children}
    </button>
  )
}

function AnbieterChips(p: FilterFeldProps) {
  const { t } = useLang()
  const zaehlung = useMemo(() => {
    const z = new Map<PlatformId, number>()
    for (const ev of p.zeitraum) z.set(ev.platform, (z.get(ev.platform) ?? 0) + 1)
    return [...z].sort((a, b) => b[1] - a[1])
  }, [p.zeitraum])
  return (
    <div className="flex flex-col gap-3">
      <Ueberschrift>{t('filter.anbieter')}</Ueberschrift>
      <div className="flex flex-wrap gap-2">
        {zaehlung.map(([pl, n]) => {
          const zustand = filterMode(p.filters, 'platforms', pl)
          return (
            <Pille key={pl} an={zustand === 'include'} aus={zustand === 'exclude'} farbe={PLATFORMS[pl].color} onClick={() => p.onChange(toggleFilter(p.filters, 'platforms', pl, zustand === 'exclude' ? 'exclude' : 'include'))}>
              {PLATFORMS[pl].name}
              <span className="font-medium opacity-65">{n}</span>
            </Pille>
          )
        })}
      </div>
    </div>
  )
}

function GenreChips(p: FilterFeldProps) {
  const { t, tGenre } = useLang()
  const zaehlung = useMemo(() => {
    const z = new Map<string, number>()
    for (const ev of p.zeitraum)
      for (const g of p.data.titleById.get(ev.titleId)?.genres ?? []) z.set(g, (z.get(g) ?? 0) + 1)
    const gewaehlt = [...p.filters.genres, ...p.filters.excluded.genres]
    return [...z].sort((a, b) => b[1] - a[1]).filter(([g], i) => i < 12 || gewaehlt.includes(g))
  }, [p.zeitraum, p.data, p.filters.genres, p.filters.excluded.genres])
  return (
    <div className="flex flex-col gap-3">
      <Ueberschrift>{t('filter.genre')}</Ueberschrift>
      <div className="flex flex-wrap gap-2">
        {zaehlung.map(([g, n]) => {
          const zustand = filterMode(p.filters, 'genres', g)
          return (
            <Pille key={g} an={zustand === 'include'} aus={zustand === 'exclude'} onClick={() => p.onChange(toggleFilter(p.filters, 'genres', g, zustand === 'exclude' ? 'exclude' : 'include'))}>
              {tGenre(g)}
              <span className="font-medium opacity-65">{n}</span>
            </Pille>
          )
        })}
      </div>
    </div>
  )
}

function FilterFuss(p: FilterFeldProps) {
  const { t } = useLang()
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-ak-linie pt-4 lg:col-span-3">
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
