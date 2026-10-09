import { useMemo, useState } from 'react'
import { sortiereNachTitel } from '../lib/titel-sortierung.ts'

import type { Title } from '@shared/types.ts'
import { nachAusstrahlung, reihenVertreter } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { DbSchalter } from './db-kopfzeile.tsx'
import { DbLeer, DbRaster, DbZaehlzeile, MehrKnopf } from './db-bedienung.tsx'
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
  onGroupedChange,
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
  onGroupedChange: (next: boolean) => void
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
  const { share, copiedSlug } = useShare()
  const today = todayIso()
  const [visible, setVisible] = useState(PAGE_SIZE)
  /* Beim Suchen gilt die Treffergüte, bis jemand selbst sortiert; `?sort=relevanz` ohne Suche hätte keine Option im Menü — dann gilt die Vorgabe. */
  const relevanzMoeglich = !!suche.trim()
  const sort = (gewaehlt === 'relevanz' && !relevanzMoeglich ? undefined : gewaehlt) ?? (relevanzMoeglich ? 'relevanz' : 'titel')

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
      <DbSchalter ohneSynchro={ohneSynchro} onOhneSynchroChange={onOhneSynchroChange} laedt={ohneSynchroLaedt} grouped={grouped} onGroupedChange={onGroupedChange} />

      <DbZaehlzeile titles={titles} ergebnisse={grouped ? groups.length : titles.length} gebuendelt={grouped} suche={suche} sort={sort} onSortChange={onSortChange} relevanz={relevanzMoeglich} />

      <DbRaster
        groups={groups.slice(0, visible)}
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

      {groups.length === 0 && !ohneSynchroLaedt && <DbLeer ohneSynchro={ohneSynchro} onOhneSynchro={() => onOhneSynchroChange(true)} />}
      {visible < groups.length && <MehrKnopf schritt={PAGE_SIZE * 2} rest={groups.length - visible} onClick={() => setVisible((v) => v + PAGE_SIZE * 2)} />}
    </div>
  )
}
