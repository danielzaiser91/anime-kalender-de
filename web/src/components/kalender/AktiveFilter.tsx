import { PLATFORMS, type PlatformId, type ReleaseStatus, type ReleaseType } from '@shared/types.ts'
import { EMPTY_FILTERS, LIST_KEYS, toggleFilter, type FilterState, type ListKey } from '../../lib/filters.ts'
import { useLang } from '../../lib/i18n.tsx'
import { STATUS_LABEL_KEY } from '../FilterDetails.tsx'
import { KreuzZeichen } from './Zeichen.tsx'

interface Eintrag {
  label: string
  weg: () => void
}

/** Solange das Filterfeld zu ist: jeder gesetzte Filter als Chip zum Entfernen. */
export function AktiveFilter({
  filters,
  onChange,
  tvAn,
  setTvAn,
}: {
  filters: FilterState
  onChange: (next: FilterState) => void
  tvAn: boolean
  setTvAn: (an: boolean) => void
}) {
  const { t } = useLang()
  const eintraege = useEintraege(filters, onChange, tvAn, setTvAn)
  if (!eintraege.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {eintraege.map((e) => (
        <button
          key={e.label}
          type="button"
          onClick={e.weg}
          aria-label={t('filter.entfernen', { name: e.label })}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-ak-rand bg-ak-flaeche-2 pr-2.5 pl-3 text-[13px] font-semibold text-ak-text hover:border-ak-leise"
        >
          {e.label}
          <KreuzZeichen groesse={14} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange({ ...EMPTY_FILTERS })
          setTvAn(true)
        }}
        className="h-8 cursor-pointer text-[13px] font-semibold text-ak-leise underline"
      >
        {t('filter.alleZuruecksetzen')}
      </button>
    </div>
  )
}

function useEintraege(filters: FilterState, onChange: (next: FilterState) => void, tvAn: boolean, setTvAn: (an: boolean) => void): Eintrag[] {
  const { t, tGenre, tKeyword, tRelease } = useLang()
  const name = (key: ListKey, wert: string | number): string => {
    if (key === 'platforms') return PLATFORMS[wert as PlatformId].name
    if (key === 'genres') return tGenre(String(wert))
    if (key === 'keywords') return tKeyword(String(wert))
    if (key === 'releaseTypes') return tRelease(wert as ReleaseType)
    if (key === 'statuses') return t(STATUS_LABEL_KEY[wert as ReleaseStatus])
    if (key === 'fsk') return t('filter.fskFrom', { n: wert })
    return String(wert)
  }
  const aus = (patch: Partial<FilterState>) => () => onChange({ ...filters, ...patch })
  const liste: Eintrag[] = []
  for (const key of LIST_KEYS) {
    for (const wert of filters[key] as (string | number)[])
      liste.push({ label: name(key, wert), weg: () => onChange(toggleFilter(filters, key, wert as never, 'include')) })
    for (const wert of filters.excluded[key] as (string | number)[])
      liste.push({ label: `⊘ ${name(key, wert)}`, weg: () => onChange(toggleFilter(filters, key, wert as never, 'exclude')) })
  }
  if (filters.search.trim()) liste.push({ label: t('filter.suche', { q: filters.search.trim() }), weg: aus({ search: '' }) })
  if (filters.favoritesOnly) liste.push({ label: t('filter.nurFavoriten'), weg: aus({ favoritesOnly: false }) })
  if (filters.kostenlosOnly) liste.push({ label: t('filter.nurKostenlos'), weg: aus({ kostenlosOnly: false }) })
  if (filters.confirmedOnly) liste.push({ label: t('filter.bestaetigt'), weg: aus({ confirmedOnly: false }) })
  if (!tvAn) liste.push({ label: t('filter.ohneTv'), weg: () => setTvAn(true) })
  return liste
}
