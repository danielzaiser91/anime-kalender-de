import type { Fsk, ReleaseEvent, Title } from '@shared/types.ts'
import { RELEASE_TYPES } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { useShare } from '../lib/share.ts'
import { FavoriteStar, FskBadge, HideEye, PlatformBadge, ShareIcon } from './ui.tsx'

export function EventCard({
  event,
  title,
  fsk,
  favorite,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onOpen,
  dense,
}: {
  event: ReleaseEvent
  title?: Title
  fsk?: Fsk
  favorite?: boolean
  hidden?: boolean
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onOpen: () => void
  dense?: boolean
}) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const type = RELEASE_TYPES[event.releaseType]
  const cover = title?.coverImage

  /**
   * Ausgeblendet: Der Termin bleibt an seinem Platz, aber nur als Name.
   *
   * Kein Bild, keine Schlagworte, keine Plattform, kein Öffnen — sonst wäre
   * das Ausblenden eine Attrappe. Genau darum ist die ganze Karte hier auch
   * kein Knopf mehr: Ein versehentlicher Klick soll nicht zeigen, was jemand
   * bewusst nicht sehen wollte.
   */
  if (hidden) {
    return (
      <div
        className={[
          'flex w-full items-center gap-2 overflow-hidden rounded-lg border border-dashed',
          'border-slate-300 bg-slate-100/60 text-left dark:border-white/15 dark:bg-white/[0.02]',
          dense ? 'p-1.5' : 'p-2',
        ].join(' ')}
      >
        <span className="line-clamp-1 min-w-0 flex-1 text-[13px] italic text-slate-400 dark:text-slate-500">
          {event.name}
        </span>
        {onToggleHidden && <HideEye hidden onToggle={onToggleHidden} size="sm" />}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={[
        'group relative flex w-full cursor-pointer gap-2 overflow-hidden rounded-lg border text-left transition',
        favorite
          ? 'border-amber-400/70 bg-amber-400/[0.07] shadow-[0_0_0_1px_rgba(251,191,36,.25)] hover:border-amber-300'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/25 dark:hover:bg-white/[0.08]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        dense ? 'p-1.5' : 'p-2',
      ].join(' ')}
      style={{ borderLeft: `3px solid ${type.color}` }}
    >
      {cover && !dense && (
        <img src={cover} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Umbrechend, weil die Reihe je nach Titel bis zu sechs Dinge trägt:
            Uhrzeit, Folgennummer, das ≈, Teilen, Auge, Stern. In einer schmalen
            Tagesspalte passte das nicht mehr nebeneinander, und der Stern stand
            am Ende außerhalb der Kachel (10.08.2026). Bricht die Reihe um,
            schiebt `ml-auto` die Icons in der zweiten Zeile nach rechts. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {event.time ? (
            <span className="tabular-nums text-slate-700 dark:text-slate-200">{event.time}</span>
          ) : event.releaseType === 'disc' ? (
            <span>{t('card.inStores')}</span>
          ) : (
            <span className="italic">{t('card.timeOpen')}</span>
          )}
          {event.episode && (
            <span className="rounded bg-slate-200/70 px-1 tabular-nums dark:bg-white/10">
              {t('card.episode', { n: event.episode })}
              {event.episodeCount ? `/${event.episodeCount}` : ''}
            </span>
          )}
          {event.estimated && (
            <span title={t('legend.estimated')} className="text-amber-500">
              ≈
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            <ShareIcon
              onShare={() => share(event.releaseSlug, event.name)}
              copied={copiedSlug === event.releaseSlug}
              size="sm"
            />
            {onToggleHidden && <HideEye hidden={false} onToggle={onToggleHidden} size="sm" />}
            {onToggleFavorite && (
              <FavoriteStar active={!!favorite} onToggle={onToggleFavorite} size="sm" />
            )}
          </span>
        </div>
        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
          {event.name}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <PlatformBadge platform={event.platform} small />
          {fsk !== undefined && <FskBadge fsk={fsk} small />}
        </span>
      </div>
    </div>
  )
}
