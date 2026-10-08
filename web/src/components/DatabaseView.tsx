import { useMemo, useState } from 'react'
import { sortiereNachTitel } from '../lib/titel-sortierung.ts'
import type { Title } from '@shared/types.ts'
import { nachAusstrahlung, reihenVertreter } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { DbKopfzeile, DbSchalter } from './db-kopfzeile.tsx'
import { DbKarte } from './db-karte.tsx'
import { useShare } from '../lib/share.ts'
import type { DbSort } from '../lib/router.ts'

const PAGE_SIZE = 60

export interface TitleGroup {
  main: Title
  members: Title[]
}

/**
 * Bündelt Staffeln derselben Reihe.
 *
 * Vertreter ist die **erste reguläre Staffel**, nicht die neueste — warum,
 * steht bei `reihenVertreter()`. Die Mitglieder stehen in
 * Ausstrahlungsreihenfolge, damit die Reihe im Detail-Panel von vorn nach
 * hinten gelesen wird.
 */
export function groupByFranchise(titles: Title[]): TitleGroup[] {
  const byFranchise = new Map<number, Title[]>()
  for (const t of titles) {
    const key = t.franchiseId ?? t.id
    const list = byFranchise.get(key)
    if (list) list.push(t)
    else byFranchise.set(key, [t])
  }
  return [...byFranchise.values()].map((members) => {
    const sorted = members.slice().sort(nachAusstrahlung)
    return { main: reihenVertreter(sorted), members: sorted }
  })
}

export function DatabaseView({
  data,
  titles,
  grouped,
  onGroupedChange, cartoonsAus, onCartoonsAusChange,
  ohneSynchro,
  onOhneSynchroChange,
  ohneSynchroLaedt,
  favorites,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onOpenTitle,
  suche,
  gewaehlt,
  onSortChange,
}: {
  data: Dataset
  titles: Title[]
  grouped: boolean
  onGroupedChange: (next: boolean) => void; cartoonsAus: boolean; onCartoonsAusChange: (next: boolean) => void
  /** Titel ohne belegte deutsche Synchro mitzeigen. */
  ohneSynchro: boolean
  onOhneSynchroChange: (next: boolean) => void
  /** Die Zusatzdatei ist unterwegs — der Schalter steht, die Titel noch nicht. */
  ohneSynchroLaedt: boolean
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  onOpenTitle: (id: number) => void
  /** Ist eine Suche aktiv, kommen die Titel nach Treffergüte sortiert (lib/search.ts). */
  suche: string
  /** Sortierung aus der Adresse (`?sort=`); ohne Wahl gilt die Vorgabe unten. */
  gewaehlt?: DbSort
  onSortChange: (next: DbSort) => void
}) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const today = todayIso()
  const [visible, setVisible] = useState(PAGE_SIZE)
  /* Beim Suchen gilt die Treffergüte, bis jemand selbst eine andere Sortierung wählt. */
  /* `?sort=relevanz` ohne Suche hätte keine Option im Menü — dann gilt die Vorgabe. */
  const sort = (gewaehlt === 'relevanz' && !suche.trim() ? undefined : gewaehlt) ?? (suche.trim() ? 'relevanz' : 'titel')


  const groups = useMemo(() => {
    const base: TitleGroup[] = grouped
      ? groupByFranchise(titles)
      : titles.map((tt) => ({ main: tt, members: [tt] }))

    if (sort === 'relevanz') return base
    if (sort === 'titel') sortiereNachTitel(base)
    else if (sort === 'jahr') base.sort((a, b) => (b.main.jpYear ?? 0) - (a.main.jpYear ?? 0))
    else base.sort((a, b) => (b.main.score ?? 0) - (a.main.score ?? 0))
    return base
  }, [titles, grouped, sort])

  return (
    <div className="flex flex-col gap-4">
      <DbSchalter ohneSynchro={ohneSynchro} onOhneSynchroChange={onOhneSynchroChange} laedt={ohneSynchroLaedt} grouped={grouped} onGroupedChange={onGroupedChange} cartoonsAus={cartoonsAus} onCartoonsAusChange={onCartoonsAusChange} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
        <DbKopfzeile titles={titles} ergebnisse={grouped ? groups.length : titles.length} gebuendelt={grouped} suche={suche} />
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          {t('db.sort')}
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as DbSort)}
            className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-white/5"
          >
            {suche.trim() && <option value="relevanz">{t('db.sortRelevanz')}</option>}
            <option value="titel">{t('db.sortTitle')}</option>
            <option value="jahr">{t('db.sortYear')}</option>
            <option value="score">{t('db.sortScore')}</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {groups.slice(0, visible).map(({ main, members }) => (
          <DbKarte
            key={main.id}
            main={main}
            members={members}
            data={data}
            today={today}
            grouped={grouped}
            favorites={favorites}
            hidden={hidden}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onOpenTitle={onOpenTitle}
            share={share}
            copiedSlug={copiedSlug}
          />
        ))}
      </div>

      {visible < groups.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE * 2)}
          className="mx-auto cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
        >
          {t('db.more', { count: Math.min(PAGE_SIZE * 2, groups.length - visible) })}
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t('db.remaining', { count: groups.length - visible })}</span>
        </button>
      )}
    </div>
  )
}
