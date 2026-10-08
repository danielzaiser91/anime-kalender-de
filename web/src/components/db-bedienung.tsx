import { useLang } from '../lib/i18n.tsx'
import type { DbSort } from '../lib/router.ts'

/** Die Sortierwahl über dem Raster. „Relevanz" steht zur Wahl, wenn gesucht wird oder die Vorschau `db-sortierung` sie zur Vorgabe macht. */
export function DbSortWahl({ sort, onChange, relevanz, suche }: { sort: DbSort; onChange: (next: DbSort) => void; relevanz: boolean; suche: boolean }) {
  const { t } = useLang()
  return (
    <label className="ml-auto flex cursor-pointer items-center gap-2">
      {t('db.sort')}
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as DbSort)}
        className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-white/5"
      >
        {relevanz && <option value="relevanz">{suche ? t('db.sortRelevanz') : 'Laufend & neu zuerst'}</option>}
        <option value="titel">{t('db.sortTitle')}</option>
        <option value="jahr">{t('db.sortYear')}</option>
        <option value="score">{t('db.sortScore')}</option>
      </select>
    </label>
  )
}

/** „N weitere anzeigen" unter dem Raster. */
export function MehrKnopf({ schritt, rest, onClick }: { schritt: number; rest: number; onClick: () => void }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
    >
      {t('db.more', { count: Math.min(schritt, rest) })}
      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t('db.remaining', { count: rest })}</span>
    </button>
  )
}
