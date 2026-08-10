import { useEffect, useMemo, useState } from 'react'
import type { Release, ReleaseEvent, Title } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { expandEvents, lastEpisodeDate, releaseStatus, titleStatus } from '@shared/logic.ts'
import { buildIcs, googleCalendarUrl } from '@shared/ics.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { loadSynopsis, type Synopsis } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { useShare } from '../lib/share.ts'
import { FORMAT_DE, PLATFORM_TIME_NOTE } from '@shared/mappings.ts'
import {
  Button,
  Chip,
  FavoriteStar,
  HideEye,
  FskBadge,
  PlatformBadge,
  ReleaseTypeBadge,
  SectionTitle,
  StatusBadge,
} from './ui.tsx'

const KEYWORD_PREVIEW = 8

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

function ShareButton({ release }: { release: Release }) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const copied = copiedSlug === release.slug

  return (
    <Button size="sm" onClick={() => share(release.slug, release.name)} title={t('detail.shareHint')}>
      {copied ? `✓ ${t('sub.copied').replace('✓ ', '')}` : `🔗 ${t('detail.share')}`}
    </Button>
  )
}

function ReleaseBlock({ release, today }: { release: Release; today: string }) {
  const { t } = useLang()
  const events = useMemo(() => expandEvents(release), [release])
  const status = releaseStatus(release, today)
  const upcoming = events.find((e) => e.date >= today) ?? events[events.length - 1]
  const last = lastEpisodeDate(release)
  // „11" neben einer Liste, die bei „2." beginnt, liest sich wie ein Fehler.
  // Fängt das Release mitten in der Reihe an, steht hier die Spanne.
  const episodeSpan = useMemo(() => {
    const count = release.schedule.episodeCount
    if (!count) return undefined
    const first = Math.max(1, release.schedule.firstEpisodeNumber ?? 1)
    return first === 1 ? String(count) : `${first}–${first + count - 1}`
  }, [release.schedule.episodeCount, release.schedule.firstEpisodeNumber])
  const [showAll, setShowAll] = useState(false)
  // Der Hinweis, warum keine Uhrzeit dasteht — nur bei Streaming-Terminen ohne
  // Uhrzeit. Bei Filmen und Discs erwartet niemand eine Minutenangabe.
  const timeNote =
    !release.schedule.time &&
    release.releaseType !== 'movie' &&
    release.releaseType !== 'disc'
      ? PLATFORM_TIME_NOTE[release.platform]
      : undefined
  const [showTimeNote, setShowTimeNote] = useState(false)
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
            ≈ {t('detail.estimatedDate')}
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
        <dt className="text-slate-400">
          {t(
            release.releaseType === 'movie'
              ? 'detail.startCinema'
              : release.releaseType === 'disc'
                ? 'detail.startDisc'
                : 'detail.start',
          )}
        </dt>
        <dd className="tabular-nums">
          {weekdayName(release.schedule.firstEpisodeDate, true)}, {formatDate(release.schedule.firstEpisodeDate)}
        </dd>
        {/* Uhrzeit nur, wo es überhaupt eine geben kann: Ein Kinofilm läuft je
            nach Kino, eine Disc liegt ab Ladenöffnung im Regal. „unbekannt"
            wäre dort keine fehlende Angabe, sondern eine falsche Frage. */}
        {release.releaseType !== 'movie' && release.releaseType !== 'disc' && (
          <>
            <dt className="text-slate-400">{t('detail.time')}</dt>
            <dd className="tabular-nums">
              {release.schedule.time ? (
                `${release.schedule.time} Uhr`
              ) : (
                <>
                  <span className="opacity-60">{t('detail.unknown')}</span>
                  {timeNote && (
                    <button
                      type="button"
                      onClick={() => setShowTimeNote((v) => !v)}
                      aria-expanded={showTimeNote}
                      title={t('detail.whyNoTime')}
                      className={`ml-1.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-full border align-[1px] text-[10px] leading-none font-bold transition-colors ${
                        showTimeNote
                          ? 'border-sky-400 bg-sky-400 text-slate-900'
                          : 'border-slate-400 text-slate-400 hover:border-sky-400 hover:text-sky-400 dark:border-slate-500 dark:text-slate-500'
                      }`}
                    >
                      ?
                    </button>
                  )}
                </>
              )}
            </dd>
          </>
        )}
        {/* Warum keine Uhrzeit dasteht. Ohne diesen Satz liest sich „unbekannt"
            wie ein Pflegefehler — meistens gibt es die Angabe aber schlicht
            nicht, und das ist eine Auskunft für sich.
            Seit dem 10.08.2026 hinter einem Fragezeichen: Der Absatz stand bei
            jedem Netflix- und Prime-Titel offen da und war nach dem zweiten
            Lesen nur noch Rauschen zwischen den Eckdaten. Das Grid-Zeilenmaß
            von 0fr auf 1fr animiert die Höhe, ohne sie zu kennen. */}
        {timeNote && (
          <dd
            className={`col-span-2 grid transition-all duration-200 ease-out ${
              showTimeNote ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <p className="pt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                {timeNote.de}{' '}
                {timeNote.source && (
                  <a
                    className="cursor-pointer underline decoration-dotted hover:text-slate-600 dark:hover:text-slate-300"
                    href={timeNote.source}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('detail.source')}
                  </a>
                )}
              </p>
            </div>
          </dd>
        )}
        {release.releaseType === 'weekly' && (
          <>
            <dt className="text-slate-400">{t('detail.episodes')}</dt>
            <dd className="tabular-nums">
              {/*
                Beginnt das Release mitten in der Zählung, steht hier die
                Spanne statt einer nackten Anzahl. „11" neben einer Liste, die
                bei „2." anfängt, liest sich sonst wie ein Widerspruch.
              */}
              {episodeSpan ?? '—'}
              {release.schedule.episodeCountAssumed && (
                <span
                  title={
                    release.schedule.episodeCountSource === 'anisearch'
                      ? t('detail.assumedEpisodesAnisearch')
                      : t('detail.assumedEpisodes')
                  }
                  className="ml-1 text-amber-500"
                >
                  ≈
                </span>
              )}
            </dd>
            <dt className="text-slate-400">{t('detail.lastEpisode')}</dt>
            <dd className="tabular-nums">{last ? formatDate(last) : '—'}</dd>
          </>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {release.platformUrl && (
          <Button href={release.platformUrl} variant="primary" size="sm">
            {t('detail.watchOn', { platform: PLATFORMS[release.platform].name })}
          </Button>
        )}
        {release.buyUrl && (
          <Button href={release.buyUrl} size="sm">
            {t('detail.buy')}
          </Button>
        )}
        {upcoming && (
          <Button href={googleCalendarUrl(upcoming)} size="sm">
            📅 {t('detail.addToGoogle')}
          </Button>
        )}
        <Button
          size="sm"
          title={t('detail.downloadIcsHint')}
          onClick={() => downloadIcs(events, release.name.replace(/[^\w\s-]/g, '').trim() || release.slug)}
        >
          ⬇ {t('detail.downloadIcs')}
        </Button>
        <ShareButton release={release} />
      </div>

      {events.length > 1 && (
        <div className="mt-3">
          <SectionTitle>{t('detail.allDates')}</SectionTitle>
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
                <span className="tabular-nums text-slate-400">
                  {ev.time ?? <span className="italic">{t('card.timeOpen')}</span>}
                </span>
                <a
                  className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-sky-500/10 hover:text-sky-400"
                  href={googleCalendarUrl(ev)}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={t('detail.addSingle')}
                >
                  📅 <span className="hidden sm:inline">{t('detail.addToGoogle')}</span>
                </a>
              </li>
            ))}
          </ul>
          {events.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-1 cursor-pointer text-xs text-sky-500 hover:underline"
            >
              {showAll ? t('detail.showFewer') : t('detail.showAllDates', { count: events.length })}
            </button>
          )}
        </div>
      )}

      {release.sources.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          {t('detail.source')}:{' '}
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

function DubMark({ dub }: { dub?: boolean }) {
  const { t } = useLang()
  if (dub === true) {
    return (
      <span title={t('detail.dubYes')} className="text-[11px] font-bold text-emerald-400">
        🇩🇪 ✓
      </span>
    )
  }
  if (dub === false) {
    return (
      <span title={t('detail.dubNo')} className="text-[11px] font-bold text-red-400">
        🇩🇪 ✕
      </span>
    )
  }
  return (
    <span title={t('detail.dubUnknown')} className="text-[11px] text-slate-400">
      🇩🇪 ?
    </span>
  )
}

export function DetailPanel({
  data,
  titleId,
  favorites,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onClose,
  onFilterBy,
  onOpenTitle,
}: {
  data: Dataset
  titleId: number
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  onClose: () => void
  onFilterBy: (kind: 'genre' | 'keyword', value: string) => void
  onOpenTitle: (id: number) => void
}) {
  const { t, tGenre, tKeyword } = useLang()
  const today = todayIso()
  const title: Title | undefined = data.titleById.get(titleId)
  const releases = data.releasesByTitle.get(titleId) ?? []
  const [synopsis, setSynopsis] = useState<Synopsis | undefined>()
  const [allKeywords, setAllKeywords] = useState(false)

  useEffect(() => {
    let alive = true
    setSynopsis(undefined)
    loadSynopsis(titleId)
      .then((s) => {
        if (alive) setSynopsis(s)
      })
      .catch(() => {})
    setAllKeywords(false)
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

  // Andere Staffeln derselben Reihe — nur sinnvoll, wenn AniList sie kennt.
  const siblings = useMemo(() => {
    if (!title?.franchiseId) return []
    return data.titles
      .filter((x) => x.franchiseId === title.franchiseId && x.id !== title.id)
      .sort((a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0))
  }, [data.titles, title])

  if (!title) {
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
        <p className="mb-3 text-sm text-slate-500">{t('detail.noMeta')}</p>
        <Button onClick={onClose} size="sm">
          {t('detail.close')}
        </Button>
      </aside>
    )
  }

  // Ausgeblendet: Auch das Detail bleibt zu. Über die Kacheln kommt man ohnehin
  // nicht mehr hierher, aber ein geteilter Link oder ein Lesezeichen schon —
  // und dann soll nicht doch alles zu sehen sein, was jemand weggeklickt hat.
  if (hidden.has(title.id)) {
    return (
      <>
        <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
        <aside
          className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col justify-center gap-4 border-l border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
          role="dialog"
          aria-label={title.titleDe ?? title.titleEn ?? 'Details'}
        >
          <p className="text-base font-medium italic text-slate-400 dark:text-slate-500">
            {title.titleDe ?? title.titleEn ?? title.titleRomaji}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('detail.hiddenNote')}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => onToggleHidden(title.id)} size="sm">
              {t('card.unhide')}
            </Button>
            <Button onClick={onClose} size="sm">
              {t('detail.close')}
            </Button>
          </div>
        </aside>
      </>
    )
  }

  const status = titleStatus(releases, today, title)
  // Handlung auf Deutsch; fehlt sie, lieber den englischen Text mit Hinweis
  // zeigen als gar keinen.
  //
  // Der englische Rückfall bleibt bewusst, obwohl die Oberfläche seit dem
  // 10.08.2026 einsprachig ist: Er stammt nicht aus einer Übersetzung der
  // Seite, sondern aus der Quelle. Für rund 700 der 2.750 Titel gibt es
  // nirgends eine deutsche Inhaltsangabe — dort wäre die Alternative eine
  // leere Fläche.
  const plot = (() => {
    if (synopsis?.de) return { text: synopsis.de, fallback: false }
    return synopsis?.en ? { text: synopsis.en, fallback: true } : undefined
  })()
  // Hinweis nur, wenn die Synchro ausschließlich auf Disc belegt ist, es aber
  // Streams gibt — genau der Fall, in dem ein Plattform-Logo sonst zu viel
  // verspricht.
  const dubOnlyOnDisc =
    releases.length > 0 &&
    releases.every((r) => r.releaseType === 'disc') &&
    title.streams.length > 0 &&
    title.streams.every((s) => s.dub !== true)
  const keywords = allKeywords ? title.keywords : title.keywords.slice(0, KEYWORD_PREVIEW)

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
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
            aria-label={t('detail.close')}
            className="absolute right-2 top-2 cursor-pointer rounded-full bg-black/50 px-2 py-1 text-sm text-white transition hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3 p-4">
          {title.coverImage && (
            <img src={title.coverImage} alt="" className="h-40 w-28 shrink-0 rounded-lg object-cover shadow-lg" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 text-lg font-semibold leading-tight text-slate-900 dark:text-white">
                {title.titleDe ?? title.titleEn ?? title.titleRomaji}
              </h2>
              <HideEye hidden={false} onToggle={() => onToggleHidden(title.id)} />
              <FavoriteStar active={favorites.has(title.id)} onToggle={() => onToggleFavorite(title.id)} />
            </div>
            {title.titleRomaji && title.titleRomaji !== (title.titleDe ?? title.titleEn) && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{title.titleRomaji}</p>
            )}
            {title.titleNative && <p className="text-xs text-slate-400 dark:text-slate-500">{title.titleNative}</p>}
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
                title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
                title.episodes ? t('db.episodes', { count: title.episodes }) : undefined,
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
              <SectionTitle>{t('detail.releases')}</SectionTitle>
              {releases
                .slice()
                .sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate))
                .map((r) => (
                  <ReleaseBlock key={r.slug} release={r} today={today} />
                ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">
              {/*
                Zwei sehr verschiedene Fälle, die vorher denselben Satz bekamen:
                Ein Titel von 2011 mit fertiger Synchro ist längst erschienen —
                „noch kein Termin erfasst" klang dort, als fehlte etwas am Titel,
                dabei fehlt nur ein Datum in unserem Bestand. Ein Titel, dessen
                japanische Ausstrahlung noch läuft, wartet dagegen wirklich.
              */}
              {t(status === 'erschienen' ? 'detail.releasedNoDate' : 'detail.noRelease')}
              {title.dubConfidence === 'low' && t('detail.noReleaseSingleSource')}
            </div>
          )}

          {(title.streams.length > 0 || (title.watchLinks?.length ?? 0) > 0) && (
            <div>
              <SectionTitle>{t('detail.whereToWatch')}</SectionTitle>
              <div className="flex flex-col gap-1.5">
                {title.streams.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 transition hover:border-slate-300 hover:bg-slate-100/60 dark:border-white/10 dark:hover:border-white/25 dark:hover:bg-white/5"
                  >
                    <PlatformBadge platform={s.platform} />
                    <span className="ml-auto">
                      <DubMark dub={s.dub} />
                    </span>
                  </a>
                ))}

                {/* Anbieter ohne eigene Plattform — Streams stehen zuerst,
                    weil ein Abo näher liegt als ein Kauf. */}
                {(title.watchLinks ?? []).map((w) => (
                  <a
                    key={w.url}
                    href={w.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 transition hover:border-slate-300 hover:bg-slate-100/60 dark:border-white/10 dark:hover:border-white/25 dark:hover:bg-white/5"
                  >
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{w.name}</span>
                    <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                      {t(w.kind === 'buy' ? 'detail.linkBuy' : 'detail.linkStream')}
                    </span>
                  </a>
                ))}
              </div>
              {dubOnlyOnDisc && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                  {t('detail.dubHintDisc')}
                </p>
              )}
            </div>
          )}

          {siblings.length > 0 && (
            <div>
              <SectionTitle>{t('detail.seasons')}</SectionTitle>
              <div className="flex flex-col gap-1">
                {siblings.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenTitle(s.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-100/70 dark:hover:bg-white/5"
                  >
                    {s.coverImage && (
                      <img src={s.coverImage} alt="" loading="lazy" className="h-9 w-6 rounded object-cover" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                      {s.titleDe ?? s.titleEn ?? s.titleRomaji}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-400">{s.jpYear ?? '—'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {title.genres.length > 0 && (
            <div>
              <SectionTitle>{t('detail.genres')}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {title.genres.map((g) => (
                  <Chip key={g} onClick={() => onFilterBy('genre', g)}>
                    {tGenre(g)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {title.keywords.length > 0 && (
            <div>
              <SectionTitle>{t('detail.keywords')}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <Chip key={k} onClick={() => onFilterBy('keyword', k)}>
                    {tKeyword(k)}
                  </Chip>
                ))}
                {title.keywords.length > KEYWORD_PREVIEW && (
                  <Chip onClick={() => setAllKeywords((v) => !v)}>
                    {allKeywords
                      ? t('filter.showLess')
                      : `(…) ${t('filter.showMore', { count: title.keywords.length })}`}
                  </Chip>
                )}
              </div>
            </div>
          )}

          {plot && (
            <div>
              <SectionTitle>{t('detail.plot')}</SectionTitle>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {plot.text}
              </p>
              {plot.fallback && (
                <p className="mt-1.5 text-[11px] text-slate-400">{t('detail.plotOnlyEnglish')}</p>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            {t('detail.metaFrom')}
            {title.malId ? ` · MAL ${title.malId}` : ''} ·{' '}
            {t('detail.dubProof', {
              sources:
                title.dubConfidence === 'very-high'
                  ? '≥4'
                  : title.dubConfidence === 'high'
                    ? '≥3'
                    : title.dubConfidence === 'normal'
                      ? '≥2'
                      : '1',
            })}
          </p>
        </div>
      </aside>
    </>
  )
}
