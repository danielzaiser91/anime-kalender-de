import { useCallback, type ReactNode } from 'react'
import { anzeigeName } from '@shared/titles.ts'
import type { Dataset } from '../lib/data.ts'
import type { FilterState } from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import { TitelNamenContext, useSprecherAuswahl } from '../lib/sprecher.ts'

/**
 * Umhüllt das Filterfeld der Datenbank: stellt dem Sprecher-Filter die Titelnamen bereit (nur dadurch erscheint er)
 * und meldet unter dem Feld, wenn die Titel der gewählten Sprecher nicht geladen werden konnten — auch bei zugeklapptem Filter.
 */
export function SprecherLeiste({ data, filters, children }: { data: Dataset; filters: FilterState; children: ReactNode }) {
  const { t } = useLang()
  const { fehler, nochmal } = useSprecherAuswahl(filters)
  const titelName = useCallback(
    (id: number) => {
      const titel = data.titleById.get(id)
      return titel ? `${anzeigeName(titel)}${titel.jpYear ? ` (${titel.jpYear})` : ''}` : undefined
    },
    [data],
  )
  return (
    <TitelNamenContext.Provider value={titelName}>
      {children}
      {fehler && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
          {t('filter.sprecher.datenFehler')}{' '}
          <button type="button" className="cursor-pointer font-semibold underline" onClick={nochmal}>
            {t('filter.sprecher.nochmal')}
          </button>
        </p>
      )}
    </TitelNamenContext.Provider>
  )
}
