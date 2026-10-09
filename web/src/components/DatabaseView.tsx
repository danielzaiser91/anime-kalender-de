import { Fragment, useMemo, useState } from 'react'

import type { Title } from '@shared/types.ts'
import { nachAusstrahlung, reihenVertreter } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { DbSchalter } from './db-kopfzeile.tsx'
import { DbKarte } from './db-karte.tsx'
import { DbGruppenKopf, DbLeer, DbZaehlzeile, MehrKnopf } from './db-bedienung.tsx'
import { ordneListe } from '../lib/db-liste.ts'
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
  /* Vorgabe ist „Relevanz": mit Suche die Treffergüte, ohne Suche die Gruppen „Läuft jetzt" / „Demnächst" / „Schon erschienen". */
  const sort = gewaehlt ?? 'relevanz'

  const { liste, zahlen } = useMemo(() => {
    const base: TitleGroup[] = grouped
      ? groupByFranchise(titles)
      : titles.map((tt) => ({ main: tt, members: [tt] }))
    return ordneListe(base, sort, suche, data.releasesByTitle, today)
  }, [titles, grouped, sort, suche, data.releasesByTitle, today])

  return (
    <div className="flex flex-col gap-4">
      <DbSchalter ohneSynchro={ohneSynchro} onOhneSynchroChange={onOhneSynchroChange} laedt={ohneSynchroLaedt} grouped={grouped} onGroupedChange={onGroupedChange} cartoonsAus={cartoonsAus} onCartoonsAusChange={onCartoonsAusChange} />

      <DbZaehlzeile titles={titles} ergebnisse={grouped ? liste.length : titles.length} gebuendelt={grouped} suche={suche} sort={sort} onSortChange={onSortChange} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {liste.slice(0, visible).map(({ main, members, art, ab }, i) => (
          <Fragment key={main.id}>
            {art && art !== liste[i - 1]?.art && <DbGruppenKopf art={art} zahl={zahlen[art] ?? 0} />}
            <DbKarte
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
              gruppe={art}
              ab={ab}
            />
          </Fragment>
        ))}
      </div>

      {liste.length === 0 && !ohneSynchroLaedt && <DbLeer ohneSynchro={ohneSynchro} onOhneSynchro={() => onOhneSynchroChange(true)} />}
      {visible < liste.length && <MehrKnopf schritt={PAGE_SIZE * 2} rest={liste.length - visible} onClick={() => setVisible((v) => v + PAGE_SIZE * 2)} />}
    </div>
  )
}
