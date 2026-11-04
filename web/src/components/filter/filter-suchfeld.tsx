import type { Dispatch, SetStateAction } from 'react'
import type { Translate } from '../../lib/i18n.tsx'

/** Das Suchfeld für **alle** Pillen — ersetzt die einzelnen Suchfelder der Gruppen. Nicht klebend (es kostete dauerhaft 40 px). */
export function FilterSuche({
  t,
  filterQuery,
  setFilterQuery,
}: {
  t: Translate
  filterQuery: string
  setFilterQuery: Dispatch<SetStateAction<string>>
}) {
  return (
    <div className="flex justify-center px-3 py-2.5">
      <input
        type="search"
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
        placeholder={t('filter.sucheAlle')}
        aria-label={t('filter.sucheAlle')}
        className="h-10 w-full min-w-0 rounded-lg md:max-w-sm border-2 border-ak-text bg-ak-flaeche px-3 text-xs text-ak-text"
      />
    </div>
  )
}
