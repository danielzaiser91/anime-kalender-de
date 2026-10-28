import { useMemo } from 'react'
import type { PlatformId, ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { EMPTY_FILTERS, isFilterActive, type FilterState } from '../../lib/filters.ts'
import { useLang } from '../../lib/i18n.tsx'
import { nachZahlGeordnet } from '../../lib/filter-liste.ts'
import { zaehleHerkunft } from '../../lib/herkunft.ts'
import { HerkunftZaehlungContext } from '../../lib/herkunft-zaehlung.ts'
import { FilterDetailsFeld } from '../FilterDetails.tsx'
import { AktiveFilter } from './AktiveFilter.tsx'

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
 * **Dieselbe Ansicht wie die Datenbank**: die Schnell-Schalter,
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
  const herkunftZaehlung = useMemo(() => zaehleHerkunft(p.zeitraum.map((ev) => p.data.titleById.get(ev.titleId))), [p.zeitraum, p.data])
  /* Alle Genres, die häufigsten des Zeitraums zuerst — gekürzt wird erst im Filter (Vorschau, Suche, „alle anzeigen"). */
  const genreListe = useMemo(() => nachZahlGeordnet(p.data.meta.genres, zaehlungen.proGenre), [zaehlungen, p.data.meta.genres])
  /* Der Streifen bringt nur etwas, wenn er etwas zu zeigen hat — sonst bliebe eine leere Zeile. */
  const etwasGewaehlt = isFilterActive(p.filters) || p.filters.search.trim() !== '' || p.tvAn === false

  return (
    <section
      id="ak-filterfeld"
      aria-label={t('filter.button')}
      className="flex min-h-0 flex-1 flex-col animate-fade-in border-ak-rand bg-ak-flaeche md:overflow-hidden md:rounded-3xl md:border"
    >
      {/* **Die gewählten Filter stehen im Filterfeld** — dieselbe Stelle wie im Datenbank-Reiter
          (`FilterBar`), unter dem festen Klick-Modus (`zwischen`). */}
      <HerkunftZaehlungContext.Provider value={herkunftZaehlung}>
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
          zwischen={
            etwasGewaehlt && (
              <div className="border-b border-ak-linie px-3 py-2.5">
                <AktiveFilter filters={p.filters} onChange={p.onChange} tvAn={p.tvAn} setTvAn={p.setTvAn} />
              </div>
            )
          }
        />
      </HerkunftZaehlungContext.Provider>
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

function FilterFuss(p: FilterFeldProps) {
  const { t } = useLang()
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-ak-linie bg-ak-flaeche px-4 py-3">
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
      <button type="button" onClick={p.schliessen} className="h-11 cursor-pointer rounded-full bg-ak-akzent px-5 text-sm font-extrabold text-ak-auf-akzent hover:bg-ak-akzent-hover">
        {t('filter.fertig')}
      </button>
    </div>
  )
}
