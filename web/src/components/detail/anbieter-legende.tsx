import { useLang } from '../../lib/i18n.tsx'
import { useVorschau } from '../../lib/vorschau.ts'
import { DUB_HAKEN_KLASSE } from './vermerk.tsx'

/**
 * Vorschau `anbieter-legende`: sagt unter den Anbieter-Pillen, was der Haken heißt (derselbe Satz wie sein Tooltip, `detail.dubYes`).
 * Sie steht direkt hinter dem Pillen-Container und zeigt sich nur, wenn darin ein Haken sitzt (`data-dub-haken`, `DubEcke`).
 */
export function AnbieterLegende() {
  const { t } = useLang()
  if (useVorschau('anbieter-legende') !== 'an') return null
  return (
    <p className="mt-1.5 hidden items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 [div:has([data-dub-haken])+&]:flex">
      <span aria-hidden="true" className={DUB_HAKEN_KLASSE}>
        ✓
      </span>
      {t('detail.dubYes')}
    </p>
  )
}
