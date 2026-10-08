import { useMemo, useState } from 'react'
import { sortiereNachTitel } from '../lib/titel-sortierung.ts'
import type { Title } from '@shared/types.ts'
import { nachAusstrahlung, reihenVertreter } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { DbKopfzeile, DbSchalter } from './db-kopfzeile.tsx'
import { DbKarte } from './db-karte.tsx'
import { DbSortWahl, MehrKnopf } from './db-bedienung.tsx'
import { OhneSynchroZeile } from './db-vorschau.tsx'
import { sortiereNachRelevanz } from '../lib/db-relevanz.ts'
import { useVorschau } from '../lib/vorschau.ts'
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
  const { share, copiedSlug } = useShare()
  const today = todayIso()
  const [visible, setVisible] = useState(PAGE_SIZE)
  /* Beim Suchen gilt die Treffergüte, bis jemand selbst eine andere Sortierung wählt. */
  /* `?sort=relevanz` ohne Suche hätte keine Option im Menü — dann gilt die Vorgabe. */
  /* Vorschau `db-sortierung`: auch ohne Suche gilt „Relevanz" (laufend und bald neu zuerst) als Vorgabe. */
  const relevanzStandard = useVorschau('db-sortierung') === 'relevanz'
  const relevanzMoeglich = relevanzStandard || !!suche.trim()
  const sort = (gewaehlt === 'relevanz' && !relevanzMoeglich ? undefined : gewaehlt) ?? (relevanzMoeglich ? 'relevanz' : 'titel')
  const ruhigOhne = useVorschau('db-ohne-synchro') === 'ruhig'
  const reserve = useVorschau('db-reserve') === 'ruhig'

  const groups = useMemo(() => {
    const base: TitleGroup[] = grouped
      ? groupByFranchise(titles)
      : titles.map((tt) => ({ main: tt, members: [tt] }))

    if (sort === 'relevanz') {
      if (!suche.trim()) sortiereNachRelevanz(base, data, today)
      return base
    }
    if (sort === 'titel') sortiereNachTitel(base)
    else if (sort === 'jahr') base.sort((a, b) => (b.main.jpYear ?? 0) - (a.main.jpYear ?? 0))
    else base.sort((a, b) => (b.main.score ?? 0) - (a.main.score ?? 0))
    return base
  }, [titles, grouped, sort, suche, data, today])

  return (
    <div className="flex flex-col gap-4">
      <DbSchalter ohneSynchro={ohneSynchro} onOhneSynchroChange={onOhneSynchroChange} laedt={ohneSynchroLaedt} grouped={grouped} onGroupedChange={onGroupedChange} cartoonsAus={cartoonsAus} onCartoonsAusChange={onCartoonsAusChange} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
        {ruhigOhne && ohneSynchro ? (
          <OhneSynchroZeile titles={titles} ergebnisse={grouped ? groups.length : titles.length} gebuendelt={grouped} suche={suche} />
        ) : (
          <DbKopfzeile titles={titles} ergebnisse={grouped ? groups.length : titles.length} gebuendelt={grouped} suche={suche} />
        )}
        <DbSortWahl sort={sort} onChange={onSortChange} relevanz={relevanzMoeglich} suche={!!suche.trim()} />
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
            ruhigOhne={ruhigOhne}
            platzhalter={reserve}
          />
        ))}
      </div>

      {visible < groups.length && <MehrKnopf schritt={PAGE_SIZE * 2} rest={groups.length - visible} onClick={() => setVisible((v) => v + PAGE_SIZE * 2)} />}
    </div>
  )
}
