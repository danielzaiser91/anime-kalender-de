import { useEffect, useMemo, useState } from 'react'
import type { Release, ReleaseEvent, Title } from '@shared/types.ts'
import { PLATFORMS, RELEASE_TYPES } from '@shared/types.ts'
import { expandEvents, lastEpisodeDate, releaseStatus, titleStatus } from '@shared/logic.ts'
import { buildIcs, googleCalendarUrl } from '@shared/ics.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { loadSynopses } from '../lib/data.ts'
import { Button, Chip, FskBadge, PlatformBadge, ReleaseTypeBadge, SectionTitle, StatusBadge } from './ui.tsx'

function downloadIcs(events: ReleaseEvent[], filename: string): void {
  const blob = new Blob([buildIcs(events, { calendarName: filename })], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function ReleaseBlock({ release, today }: { release: Release; today: string }) {
  const events = useMemo(() => expandEvents(release), [release])
  const status = releaseStatus(release, today)
  const upcoming = events.find((e) => e.date >= today) ?? events[events.length - 1]
  const last = lastEpisodeDate(release)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? events : events.slice(0, 8)

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ReleaseTypeBadge type={release.releaseType} />
        <PlatformBadge platform={release.platform} />
        <StatusBadge status={status} />
        {release.fsk !== undefined && <FskBadge fsk={release.fsk} />}
        {release.schedule.estimated && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-500 ring-1 ring-amber-500/40">
            Termin abgeleitet
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{release.name}</p>

      {(release.publisher || release.edition) && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {[release.publisher, release.edition].filter(Boolean).join(' · ')}
        </p>
      )}
      {release.note && (
        <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
          {release.note}
        </p>
      )}

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <dt className="text-slate-400">Start</dt>
        <dd className="tabular-nums">
          {weekdayName(release.schedule.firstEpisodeDate, true)},{' '}
          {formatDate(release.schedule.firstEpisodeDate)}
        </dd>
        <dt className="text-slate-400">Uhrzeit</dt>
        <dd className="tabular-nums">
          {release.schedule.time ? `${release.schedule.time} Uhr` : <em className="not-italic opacity-60">unbekannt</em>}
        </dd>
        {release.releaseType === 'weekly' && (
          <>
            <dt className="text-slate-400">Folgen</dt>
            <dd className="tabular-nums">
              {release.schedule.episodeCount ?? '—'}
              {release.schedule.episodeCountAssumed && (
                <span title="Folgenzahl noch nicht belegt — 12 angenommen" className="ml-1 text-amber-500">
                  ≈
                </span>
              )}
            </dd>
            <dt className="text-slate-400">Letzte Folge</dt>
            <dd className="tabular-nums">{last ? formatDate(last) : '—'}</dd>
          </>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {release.platformUrl && (
          <Button href={release.platformUrl} variant="primary" size="sm">
            Bei {PLATFORMS[release.platform].name} ansehen
          </Button>
        )}
        {release.buyUrl && (
          <Button href={release.buyUrl} size="sm">
            Kaufen
          </Button>
        )}
        {upcoming && (
          <Button href={googleCalendarUrl(upcoming)} size="sm" title="Nächsten Termin in Google Calendar eintragen">
            📅 Google Calendar
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => downloadIcs(events, release.name.replace(/[^\w\s-]/g, '').trim() || release.slug)}
          title="Alle Termine dieser Staffel als Kalenderdatei"
        >
          ⬇ .ics
        </Button>
      </div>

      {events.length > 1 && (
        <div className="mt-3">
          <SectionTitle>Alle Termine</SectionTitle>
          <ul className="flex flex-col gap-0.5">
            {shown.map((ev) => (
              <li
                key={ev.id}
                className={[
                  'flex items-center gap-2 rounded px-1.5 py-1 text-xs',
                  ev.date < today ? 'opacity-50' : '',
                  ev.date === today ? 'bg-sky-500/10 font-semibold text-sky-500' : '',
                ].join(' ')}
              >
                <span className="w-6 shrink-0 tabular-nums text-slate-400">{ev.episode}.</span>
                <span className="tabular-nums">
                  {weekdayName(ev.date, true)} {formatDate(ev.date)}
                </span>
                <span className="tabular-nums text-slate-400">{ev.time ?? '—:—'}</span>
                <a
                  className="ml-auto text-slate-400 hover:text-sky-400"
                  href={googleCalendarUrl(ev)}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Diesen Termin zu Google Calendar"
                >
                  +
                </a>
              </li>
            ))}
          </ul>
          {events.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-1 text-xs text-sky-500 hover:underline"
            >
              {showAll ? 'weniger anzeigen' : `alle ${events.length} Termine anzeigen`}
            </button>
          )}
        </div>
      )}

      {release.sources.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          Quelle:{' '}
          {release.sources.map((s, i) => (
            <span key={s}>
              {i > 0 && ', '}
              <a href={s} target="_blank" rel="noreferrer noopener" className="underline hover:text-sky-400">
                {new URL(s).hostname.replace('www.', '')}
              </a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

export function DetailPanel({
  data,
  titleId,
  onClose,
  onFilterBy,
}: {
  data: Dataset
  titleId: number
  onClose: () => void
  onFilterBy: (kind: 'genre' | 'keyword', value: string) => void
}) {
  const today = todayIso()
  const title: Title | undefined = data.titleById.get(titleId)
  const releases = data.releasesByTitle.get(titleId) ?? []
  const [synopsis, setSynopsis] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    loadSynopses()
      .then((all) => {
        if (alive) setSynopsis(all[titleId])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [titleId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!title) {
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
        <p className="text-sm text-slate-500">Zu diesem Eintrag liegen keine Metadaten vor.</p>
        <Button onClick={onClose} size="sm">
          Schließen
        </Button>
      </aside>
    )
  }

  const status = titleStatus(releases, today)

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
        role="dialog"
        aria-label={title.titleDe ?? title.titleEn ?? 'Details'}
      >
        <div className="relative">
          {title.bannerImage && (
            <img src={title.bannerImage} alt="" className="h-28 w-full object-cover opacity-70" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-sm text-white transition hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3 p-4">
          {title.coverImage && (
            <img
              src={title.coverImage}
              alt=""
              className="h-40 w-28 shrink-0 rounded-lg object-cover shadow-lg"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">
              {title.titleDe ?? title.titleEn ?? title.titleRomaji}
            </h2>
            {title.titleRomaji && title.titleRomaji !== (title.titleDe ?? title.titleEn) && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{title.titleRomaji}</p>
            )}
            {title.titleNative && (
              <p className="text-xs text-slate-400 dark:text-slate-500">{title.titleNative}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={status} small />
              {title.fsk !== undefined && <FskBadge fsk={title.fsk} small />}
              {title.score !== undefined && (
                <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums dark:bg-white/10">
                  ★ {(title.score / 10).toFixed(1)}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {[
                title.format,
                title.episodes ? `${title.episodes} Folgen` : undefined,
                title.jpYear ? `JP ${title.jpYear}` : undefined,
                title.studios?.[0],
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-8">
          {releases.length > 0 ? (
            <div className="flex flex-col gap-3">
              <SectionTitle>Deutsche Releases</SectionTitle>
              {releases
                .slice()
                .sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate))
                .map((r) => (
                  <ReleaseBlock key={r.slug} release={r} today={today} />
                ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">
              Für diesen Titel ist eine deutsche Synchro belegt
              {title.dubConfidence === 'low' ? ' (nur eine Quelle)' : ''}, aber noch kein deutscher
              Termin erfasst. Wer einen kennt: Quelle im Repository ergänzen.
            </div>
          )}

          {title.streams.length > 0 && (
            <div>
              <SectionTitle>Wo läuft es</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {title.streams.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition hover:opacity-80"
                  >
                    <PlatformBadge platform={s.platform} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {title.genres.length > 0 && (
            <div>
              <SectionTitle>Genres</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {title.genres.map((g) => (
                  <Chip key={g} onClick={() => onFilterBy('genre', g)}>
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {title.keywords.length > 0 && (
            <div>
              <SectionTitle>Keywords</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {title.keywords.map((k) => (
                  <Chip key={k} onClick={() => onFilterBy('keyword', k)}>
                    {k}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {synopsis && (
            <div>
              <SectionTitle>Handlung</SectionTitle>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {synopsis}
              </p>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Metadaten von AniList
            {title.malId ? ` · MAL-ID ${title.malId}` : ''} · Dub-Beleg über MyDubList (
            {title.dubConfidence === 'very-high'
              ? '≥4 Quellen'
              : title.dubConfidence === 'high'
                ? '≥3 Quellen'
                : title.dubConfidence === 'normal'
                  ? '≥2 Quellen'
                  : '1 Quelle'}
            )
          </p>
        </div>
      </aside>
    </>
  )
}

export { RELEASE_TYPES }
