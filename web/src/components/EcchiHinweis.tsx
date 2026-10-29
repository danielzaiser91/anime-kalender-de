import { useMemo } from 'react'
import type { Title } from '@shared/types.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { zaehleVersteckteEcchiTreffer } from '../lib/ecchi-hinweis.ts'
import { EINSTELLUNGEN_EREIGNIS } from '../lib/einstellungen-offen.ts'
import type { FilterState } from '../lib/filters.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'

/** Satz und Sprung zu den Einstellungen, wenn die Suche Ecchi-Titel trifft, die gerade ausgeblendet sind; sonst nichts. */
export function EcchiHinweis({ data, filters, favorites, ohneSynchro, titles }: {
  data: Dataset
  filters: FilterState
  favorites: Set<number>
  ohneSynchro: boolean
  /** Die Liste der Datenbank: ändert sich, wenn nachgeladen wurde, und stößt die Zählung neu an. */
  titles: Title[]
}) {
  const { t } = useLang()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anzahl = useMemo(() => zaehleVersteckteEcchiTreffer(data, filters, todayIso(), favorites, ohneSynchro), [data, filters, favorites, ohneSynchro, titles])
  if (anzahl === 0) return null
  const satz = anzahl === 1 ? t('db.ecchi1' as TranslationKey) : t('db.ecchiN' as TranslationKey, { count: anzahl.toLocaleString('de-DE') })
  return (
    <p role="status" data-ecchi-hinweis className="text-sm text-ak-leise">
      {satz} ·{' '}
      <button type="button" onClick={() => window.dispatchEvent(new Event(EINSTELLUNGEN_EREIGNIS))} className="cursor-pointer font-semibold text-ak-akzent-text underline-offset-2 hover:underline">
        {t('db.ecchiEinstellungen' as TranslationKey)}
      </button>
    </p>
  )
}
