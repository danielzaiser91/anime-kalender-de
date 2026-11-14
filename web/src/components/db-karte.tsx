import type { Title } from '@shared/types.ts'
import { titleStatus } from '@shared/logic.ts'
import { anzeigeName } from '@shared/titles.ts'
import type { Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { ueberschriftSagtStatus, type RelevanzArt } from '../lib/db-relevanz.ts'
import { istOhneBelegteSynchro } from '../lib/titel-sortierung.ts'
import { teilbarerSlug } from '@shared/teilen.ts'
import { HideEye } from './ui.tsx'
import { KartenText } from './db-karte-teile.tsx'
import { KartenCover } from './db-karte-teile.tsx'

export interface DbKarteProps {
  main: Title
  members: Title[]
  data: Dataset
  today: string
  grouped: boolean
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  onOpenTitle: (id: number) => void
  share: (slug: string, title: string) => Promise<void>
  copiedSlug: string | undefined
  /** Unter welcher Gruppenüberschrift die Kachel steht (Relevanz-Ansicht), und ab wann es die deutsche Fassung gibt. */
  gruppe?: RelevanzArt
  ab?: string
  /** Die Staffel, die die Kachel meint: sie wird geöffnet (sonst `main`), `staffel` ist ihre Beschriftung („Staffel 2"). */
  titelId?: number
  staffel?: string
}

/** Eine Kachel der Datenbank (oder, ausgeblendet, ihr Platzhalter). */
export function DbKarte({ main, members, data, today, grouped, favorites, hidden, onToggleFavorite, onToggleHidden, onOpenTitle, share, copiedSlug, gruppe, ab, titelId, staffel }: DbKarteProps) {
  const { t } = useLang()
  const releases = members.flatMap((m) => data.releasesByTitle.get(m.id) ?? [])
  const status = titleStatus(releases, today, main)
  const statusZeigen = !gruppe || !ueberschriftSagtStatus(gruppe, status)
  const favorite = members.some((m) => favorites.has(m.id))
  // Eine Reihe gilt als ausgeblendet, sobald eine ihrer Staffeln es ist —
  // sonst käme das Cover über den Umweg der Fortsetzung doch wieder.
  const isHidden = members.some((m) => hidden.has(m.id))
  const platform = releases[0]?.platform ?? main.streams[0]?.platform
  /**
   * Ein Titel ohne belegte deutsche Synchro. Er sieht bewusst anders
   * aus als der gepflegte Bestand: gestrichelter Rahmen, entsättigtes
   * Cover, eigene Kennzeichnung. Wer die Liste überfliegt, soll die
   * beiden Sorten nicht verwechseln können (Daniel, 13.08.2026:
   * „prevent confusion by making it obvious through styling").
   *
   * Der Stern bleibt trotzdem da — er ist der einzige Grund, warum
   * diese Titel überhaupt angezeigt werden.
   *
   * **`every`, nicht nur `main`:** Eine Reihe kann die Grenze
   * überschreiten — Serie mit Synchro, ein Special ohne. Solange
   * irgendein Teil eine deutsche Fassung hat, ist die Kachel ein
   * normaler Eintrag; die Lücke steht dann in der Staffelliste des
   * Detail-Panels, wo sie hingehört.
   */
  const keinDub = members.every(istOhneBelegteSynchro)
  const teilbar = teilbarerSlug(main)

  if (isHidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-3 text-center dark:border-white/15 dark:bg-white/[0.02]">
        <span className="line-clamp-3 text-xs italic text-slate-400 dark:text-slate-500">{anzeigeName(main)}</span>
        <HideEye hidden onToggle={() => onToggleHidden(main.id)} />
      </div>
    )
  }

  return (
    /* Kein Knopf aus Knöpfen: wie die Kalenderkarte (EventCard, 18.09.2026). */
    <div
      onClick={() => onOpenTitle(titelId ?? main.id)}
      className={[
        'group flex cursor-pointer flex-col overflow-hidden rounded-xl text-left transition',
        keinDub ? 'border border-dashed' : 'border',
        favorite
          ? 'border-ak-favorit/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ak-favorit)_30%,transparent)]'
          : keinDub
            ? 'border-slate-400/60 hover:border-ak-leise dark:border-white/25'
            : 'border-slate-200 hover:border-ak-leise dark:border-white/10',
        keinDub ? 'bg-slate-100/70 hover:shadow-md dark:bg-white/[0.015]' : 'bg-white hover:shadow-lg dark:bg-white/[0.03]',
        'has-[.ak-oeffnen:focus-visible]:outline-2 has-[.ak-oeffnen:focus-visible]:outline-offset-2 has-[.ak-oeffnen:focus-visible]:outline-ak-fokus',
      ].join(' ')}
    >
      <button
        type="button"
        className="ak-oeffnen sr-only"
        onClick={(e) => {
          e.stopPropagation()
          onOpenTitle(titelId ?? main.id)
        }}
      >
        {t('card.details', { titel: anzeigeName(main) })}
      </button>
      <div className="relative aspect-[2/3] overflow-hidden bg-slate-200 dark:bg-white/5">
        <KartenCover
          main={main}
          keinDub={keinDub}
          members={members}
          t={t}
          today={today}
          favorite={favorite}
          onToggleFavorite={onToggleFavorite}
          onToggleHidden={onToggleHidden}
          teilbar={teilbar}
          share={share}
          copiedSlug={copiedSlug}
          grouped={grouped}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <KartenText
          main={main}
          t={t}
          keinDub={keinDub}
          favorite={favorite}
          statusZeigen={statusZeigen}
          status={status}
          gruppe={gruppe}
          ab={ab}
          staffel={staffel}
          platform={platform}
        />
      </div>
    </div>
  )
}
