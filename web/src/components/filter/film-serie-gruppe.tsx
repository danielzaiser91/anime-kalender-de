import { Chip } from '../ui.tsx'
import { toggleFilter, type FilterState } from '../../lib/filters.ts'
import type { Translate } from '../../lib/i18n.tsx'

/**
 * **Film / Serie** — dieselbe Unterscheidung wie die Release-Art „Film“ (`releaseTypes: movie`), kein eigenes Feld:
 * „Film“ schließt `movie` ein, „Serie“ schließt `movie` aus. Alte Adressen (`rt=movie`, `xrt=movie`) und gespeicherte
 * Zustände zeigen deshalb dasselbe wie vorher; der Chip „Film“ steht nicht mehr zusätzlich unter Release-Art.
 */
export function FilmSerieChips({ t, filters, set, labelFilm }: { t: Translate; filters: FilterState; set: (patch: Partial<FilterState>) => void; labelFilm: string }) {
  return (
    <>
      <Chip active={filters.releaseTypes.includes('movie')} onClick={() => set(toggleFilter(filters, 'releaseTypes', 'movie', 'include'))}>
        {labelFilm}
      </Chip>
      <Chip title={t('filter.serie.hint')} active={filters.excluded.releaseTypes.includes('movie')} onClick={() => set(toggleFilter(filters, 'releaseTypes', 'movie', 'exclude'))}>
        {t('filter.serie')}
      </Chip>
    </>
  )
}
