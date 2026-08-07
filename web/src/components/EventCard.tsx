import type { Fsk, ReleaseEvent, Title } from '@shared/types.ts'
import { RELEASE_TYPES } from '@shared/types.ts'
import { FskBadge, PlatformBadge } from './ui.tsx'

export function EventCard({
  event,
  title,
  fsk,
  onOpen,
  dense,
}: {
  event: ReleaseEvent
  title?: Title
  fsk?: Fsk
  onOpen: () => void
  dense?: boolean
}) {
  const type = RELEASE_TYPES[event.releaseType]
  const cover = title?.coverImage

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'group relative flex w-full gap-2 overflow-hidden rounded-lg border text-left transition',
        'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md',
        'dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/25 dark:hover:bg-white/[0.08]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        dense ? 'p-1.5' : 'p-2',
      ].join(' ')}
      style={{ borderLeft: `3px solid ${type.color}` }}
    >
      {cover && !dense && (
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="h-14 w-10 shrink-0 rounded object-cover"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {event.time ? (
            <span className="tabular-nums text-slate-700 dark:text-slate-200">{event.time}</span>
          ) : event.releaseType === 'disc' ? (
            <span>im Handel</span>
          ) : (
            <span className="italic" title="Uhrzeit noch nicht belegt">
              Zeit offen
            </span>
          )}
          {event.episode && (
            <span className="rounded bg-slate-200/70 px-1 tabular-nums dark:bg-white/10">
              Ep {event.episode}
              {event.episodeCount ? `/${event.episodeCount}` : ''}
            </span>
          )}
          {event.estimated && (
            <span title="Termin abgeleitet, nicht offiziell bestätigt" className="text-amber-500">
              ≈
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-[13px] leading-snug font-medium text-slate-900 dark:text-slate-100">
          {event.name}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <PlatformBadge platform={event.platform} small />
          {fsk !== undefined && <FskBadge fsk={fsk} small />}
        </span>
      </span>
    </button>
  )
}
