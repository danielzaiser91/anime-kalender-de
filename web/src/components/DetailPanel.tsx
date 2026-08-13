import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Release, ReleaseEvent, Title } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { expandEvents, lastEpisodeDate, releaseStatus, titleStatus } from '@shared/logic.ts'
import { buildIcs, googleCalendarUrl } from '@shared/ics.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import type { FranchiseMember, Franchises } from '@shared/types.ts'
import { anzeigeName, eindeutschenStaffel, ohneStaffelEins, reihenVertreter } from '@shared/titles.ts'
import { loadAllTitles, loadFranchises, loadSynopsis, loadVoices, type Synopsis, type VoiceRole } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { useShare } from '../lib/share.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import {
  Button,
  Chip,
  DubMark,
  Tooltip,
  FavoriteStar,
  HideEye,
  FskBadge,
  PlatformBadge,
  ReleaseTypeBadge,
  SectionTitle,
  StatusBadge,
} from './ui.tsx'

const KEYWORD_PREVIEW = 8
/**
 * Wie viel von der Handlung ohne Klick zu sehen ist.
 *
 * 200 Zeichen sind etwa zwei Sätze — genug, um zu entscheiden, ob man
 * weiterlesen will, und kurz genug, dass alles Übrige im Bild bleibt.
 */
const PLOT_PREVIEW = 200

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
  const shown = showAll ? events : events.slice(0, 8)

  /**
   * Der Satz, der das Datum einordnet — als Hovertext, nicht als Absatz.
   *
   * „Im Angebot seit 11.06.2025" liest sich sonst wie ein Erscheinungstermin,
   * und der wäre bei Sword Art Online zwölf Jahre daneben. Als eigener Absatz
   * stand die Erklärung aber bei jedem Katalogtitel im Weg. Das gepunktete
   * Unterstreichen zeigt an, dass da noch etwas steht.
   */
  const datumErklaerung =
    release.dateMeaning === 'available-from' ? t('detail.availableFromNote') : undefined

  const naechster = events.find((e) => e.date >= today)
  const kuenftige = events.filter((e) => e.date >= today)

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

      {/*
        Der Name des Releases stand hier bis zum 12.08.2026 und wiederholte nur
        den Eintrag, der drei Zeilen darüber im Umschalter gewählt ist. Zwei
        Zeilen für dieselbe Auskunft sind eine zu viel.
      */}
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
            release.dateMeaning === 'available-from'
              ? 'detail.availableFrom'
              : release.releaseType === 'movie'
                ? 'detail.startCinema'
                : release.releaseType === 'disc'
                  ? 'detail.startDisc'
                  : 'detail.start',
          )}
        </dt>
        <dd className="tabular-nums">
          {/*
            Datum und Uhrzeit in einer Zeile.

            Vorher standen sie als zwei Einträge untereinander, und fehlte die
            Uhrzeit, stand dort „unbekannt" samt Erklärknopf daneben. Das war
            eine ganze Zeile für die Auskunft, dass wir nichts wissen — bei
            Netflix und Prime also fast immer. Jetzt steht die Uhrzeit hinter
            dem Datum, wenn es eine gibt, und sonst gar nichts (Daniel,
            12.08.2026).
          */}
          {datumErklaerung ? (
            <Tooltip text={datumErklaerung} unterstrichen>
              {weekdayName(release.schedule.firstEpisodeDate, true)},{' '}
              {formatDate(release.schedule.firstEpisodeDate)}
            </Tooltip>
          ) : (
            <>
              {weekdayName(release.schedule.firstEpisodeDate, true)},{' '}
              {formatDate(release.schedule.firstEpisodeDate)}
            </>
          )}
          {release.schedule.time && (
            <span className="text-slate-400"> · {release.schedule.time} Uhr</span>
          )}
        </dd>
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
                <span className="ml-1 text-amber-500">
                  <Tooltip
                    text={
                      release.schedule.episodeCountSource === 'anisearch'
                        ? t('detail.assumedEpisodesAnisearch')
                        : t('detail.assumedEpisodes')
                    }
                    unterstrichen
                  >
                    ≈
                  </Tooltip>
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
        {/*
          Eintragen kann man nur, was noch kommt.

          Bei einem Katalogtitel, der seit einem Jahr im Angebot ist, führte
          „Zu Google Calendar" zu einem Termin in der Vergangenheit, und die
          ICS-Datei enthielt lauter abgelaufene Einträge. Beide Knöpfe standen
          also überall, halfen aber nur bei einem Bruchteil der Titel (Daniel,
          12.08.2026).
        */}
        {naechster && (
          <Button href={googleCalendarUrl(naechster)} size="sm">
            📅 {t('detail.addToGoogle')}
          </Button>
        )}
        {kuenftige.length > 0 && (
          <Button
            size="sm"
            onClick={() => downloadIcs(kuenftige, release.name.replace(/[^\w\s-]/g, '').trim() || release.slug)}
          >
            ⬇ {t('detail.downloadIcs')}
            {/*
              Was eine ICS-Datei ist, weiß nicht jeder — das Kürzel steht für
              nichts, was man erraten könnte. Der Hinweis erklärt es an Ort und
              Stelle, statt ihn im Kopf des Lesers vorauszusetzen.
            */}
            <Tooltip text={t('detail.downloadIcsHint')} seite="oben">
              <span className="ml-1.5 inline-flex size-4 cursor-help items-center justify-center rounded-full border border-current align-[1px] text-[10px] leading-none font-bold opacity-60">
                ?
              </span>
            </Tooltip>
          </Button>
        )}
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
                  aria-label={t('detail.addSingle')}
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

/**
 * Deutsche Sprechrollen — zugeklappt, und erst der Klick holt die Daten.
 *
 * Bewusst nicht im Hauptdatensatz: Über alle Titel wären das mehr als 50.000
 * Einträge für eine Angabe, die die meisten nie aufschlagen. Wer sie sehen
 * will, lädt zwei Kilobyte; alle anderen zahlen nichts. Siehe ARCHITEKTUR.md.
 */
function VoiceCast({ titleId }: { titleId: number }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState<VoiceRole[] | undefined>()

  // Titelwechsel: zuklappen und vergessen. Sonst stünde beim nächsten Anime
  // kurz die Besetzung des vorherigen da.
  useEffect(() => {
    setOpen(false)
    setRoles(undefined)
  }, [titleId])

  useEffect(() => {
    if (!open || roles) return
    let alive = true
    loadVoices(titleId)
      .then((r) => {
        if (alive) setRoles(r)
      })
      .catch(() => {
        if (alive) setRoles([])
      })
    return () => {
      alive = false
    }
  }, [open, roles, titleId])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
        {t('detail.voices')}
      </button>

      {open && (
        <div className="mt-2">
          {roles === undefined ? (
            <p className="text-sm text-slate-400">{t('detail.voicesLoading')}</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-slate-400">{t('detail.voicesNone')}</p>
          ) : (
            <>
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 text-sm">
                {roles.map((r) => (
                  <Fragment key={`${r.character}-${r.actor}`}>
                    <dt className="truncate text-slate-500 dark:text-slate-400" title={r.character}>
                      {r.character}
                    </dt>
                    <dd className="truncate text-slate-700 dark:text-slate-200" title={r.actor}>
                      {r.actor}
                    </dd>
                  </Fragment>
                ))}
              </dl>
              <p className="mt-2 text-[11px] text-slate-400">{t('detail.voicesSource')}</p>
            </>
          )}
        </div>
      )}
    </div>
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
  const [plotOffen, setPlotOffen] = useState(false)

  useEffect(() => {
    let alive = true
    setSynopsis(undefined)
    loadSynopsis(titleId)
      .then((s) => {
        if (alive) setSynopsis(s)
      })
      .catch(() => {})
    setAllKeywords(false)
    setPlotOffen(false)
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

  /**
   * Die ganze Reihe — Staffeln, Filme und Specials.
   *
   * Kommt aus `franchises.json`, nicht aus `data.titles`. Dort stehen im
   * Kalender nur die 133 Titel **mit Termin**; „That Time I Got Reincarnated as
   * a Slime" zeigte deshalb allein Staffel 4 als verwandten Eintrag, „I've Been
   * Killing Slimes" gar nichts, obwohl es eine zweite Staffel gibt (gemeldet
   * von Daniel, 12.08.2026).
   */
  const [franchises, setFranchises] = useState<Franchises>({})
  useEffect(() => {
    let alive = true
    loadFranchises().then((f) => {
      if (alive) setFranchises(f)
    })
    return () => {
      alive = false
    }
  }, [])

  const reihe: FranchiseMember[] = useMemo(() => {
    if (!title) return []
    return franchises[title.franchiseId ?? title.id] ?? []
  }, [franchises, title])

  /**
   * Wie die Reihe heißt — nicht, wie die gerade gewählte Staffel heißt.
   *
   * Im Kopf stand vorher „That Time I Got Reincarnated as a Slime Season 4",
   * während vier Zeilen darunter „… Staffel 4" stand: dasselbe zweimal, einmal
   * auf Englisch. Der Kopf nennt jetzt die Reihe, die Staffel steht im
   * Umschalter darunter.
   */
  const reihenName = useMemo(() => {
    if (!title) return ''
    if (reihe.length < 2) return anzeigeName(title)
    return ohneStaffelEins(reihenVertreter(reihe.map((m) => ({ ...m, id: m.id }))).name)
  }, [reihe, title])

  /**
   * Beim Wechsel auf eine Staffel ohne Termin fehlen die Metadaten — die liegen
   * in `titles.json`, das im Kalender nicht geladen ist. Erst holen, dann
   * öffnen, sonst zeigt das Panel „keine Metadaten".
   */
  const [wechselt, setWechselt] = useState(false)
  const wechsleZu = (id: number) => {
    if (id === titleId) return
    if (data.titleById.has(id)) {
      onOpenTitle(id)
      return
    }
    setWechselt(true)
    loadAllTitles(data)
      .catch(() => {})
      .finally(() => {
        setWechselt(false)
        onOpenTitle(id)
      })
  }

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
          aria-label={anzeigeName(title)}
        >
          <p className="text-base font-medium italic text-slate-400 dark:text-slate-500">
            {anzeigeName(title)}
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
    if (synopsis?.de) {
      return {
        text: synopsis.de,
        fallback: false,
        quelle: synopsis.deSource ?? { name: 'anisearch.de', url: 'https://www.anisearch.de/' },
      }
    }
    if (!synopsis?.en) return undefined
    // Die englische Fassung kommt immer von AniList — dort steht auch der Titel.
    return {
      text: synopsis.en,
      fallback: true,
      quelle: { name: 'anilist.co', url: `https://anilist.co/anime/${titleId}` },
    }
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
        aria-label={anzeigeName(title)}
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
                {reihenName}
              </h2>
              <HideEye hidden={false} onToggle={() => onToggleHidden(title.id)} />
              <FavoriteStar active={favorites.has(title.id)} onToggle={() => onToggleFavorite(title.id)} />
            </div>
            {/*
              Auch die Umschrift bekommt „Staffel" statt „Season".

              Die Zeile zeigt den japanischen Titel in lateinischer Schrift und
              ist damit ohnehin schon eine Mischung — „Tensei Shitara Slime
              Datta Ken 4th Season" ist weder ganz japanisch noch ganz englisch.
              Ein zweites „Season" drei Zeilen unter dem deutschen „Staffel 4"
              stehen zu lassen, wäre genau der Widerspruch, um den es ging.
              Die Originalschrift darunter bleibt unangetastet.
            */}
            {title.titleRomaji && title.titleRomaji !== (title.titleDe ?? title.titleEn) && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {eindeutschenStaffel(title.titleRomaji)}
              </p>
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
            {/*
              Genres stehen seit dem 12.08.2026 hier oben statt weit unten
              (Daniel): Sie beantworten die erste Frage, die jemand an einen
              unbekannten Titel hat — „ist das überhaupt meins?". Die Keywords
              dagegen sind die feinste Unterteilung und stehen deshalb ganz am
              Ende.
            */}
            {title.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {title.genres.map((g) => (
                  <Chip key={g} onClick={() => onFilterBy('genre', g)}>
                    {tGenre(g)}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-8">
          {/*
            Der Umschalter über die Reihe.

            Vorher gab es je Staffel eine eigene Kachel und ganz unten eine
            Liste „Staffeln dieser Reihe" — die im Kalender fast immer leer war,
            weil sie nur Staffeln mit Termin kannte. Wer von Staffel 4 zu
            Staffel 2 wollte, fand keinen Weg dorthin, und „Alle Termine" gab es
            nur bei der einen Staffel, die man gerade offen hatte (Daniel,
            12.08.2026).

            Jetzt trägt der Kopf den Reihennamen, und hier wird gewählt, worauf
            sich alles darunter bezieht. Ein `select` statt einer Liste, weil
            eine Reihe zehn Einträge haben kann und die Termine darunter der
            eigentliche Inhalt bleiben sollen.
          */}
          {reihe.length > 1 && (
            <label className="flex flex-col gap-1">
              <SectionTitle>{t('detail.pickSeason')}</SectionTitle>
              <select
                value={title.id}
                disabled={wechselt}
                onChange={(e) => wechsleZu(Number(e.target.value))}
                className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60 dark:border-white/15 dark:bg-white/5"
              >
                {reihe.map((m) => (
                  <option key={m.id} value={m.id}>
                    {[
                      eindeutschenStaffel(m.name),
                      m.format && m.format !== 'TV' ? `(${FORMAT_DE[m.format] ?? m.format})` : '',
                      m.jpYear ? `· ${m.jpYear}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </option>
                ))}
              </select>
              {wechselt && (
                <span className="text-[11px] text-slate-400">{t('detail.seasonLoading')}</span>
              )}
            </label>
          )}

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
            /*
              Dieselbe Form wie ein echter Termin, nur mit „unbekannt".

              Vorher stand hier ein Kasten mit zwei Sätzen: „Die deutsche
              Fassung ist erschienen. Ein genaues Datum führen wir dazu nicht —
              die Verweise unten führen hin." Das war viel Text für eine
              einzige Auskunft, und es sah anders aus als jeder andere Titel.
              „Im Angebot seit: unbekannt" sagt dasselbe in einer Zeile und an
              derselben Stelle wie sonst auch (Daniel, 12.08.2026).
            */
            <div className="flex flex-col gap-3">
              <SectionTitle>{t('detail.releases')}</SectionTitle>
              <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={status} />
                  {title.fsk !== undefined && <FskBadge fsk={title.fsk} />}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <dt className="text-slate-400">{t('detail.availableFrom')}</dt>
                  <dd>
                    <Tooltip
                      text={t(status === 'erschienen' ? 'detail.releasedNoDate' : 'detail.noRelease')}
                      unterstrichen
                    >
                      <span className="opacity-70">{t('detail.unknown')}</span>
                    </Tooltip>
                  </dd>
                </dl>
                {title.dubConfidence === 'low' && (
                  <p className="mt-2 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                    {t('detail.noReleaseSingleSource')}
                  </p>
                )}
              </section>
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
                    {/*
                      Der Hinweis, dass der Anbieter anders zählt als wir.

                      Bei „The Café Terrace and Its Goddesses" zeigen unsere
                      Staffel 1 und Staffel 2 auf dieselbe Crunchyroll-Seite,
                      und dort steht das Ganze als **eine** Staffel mit 24
                      Folgen. Ohne diesen Hinweis hält man eine der beiden
                      Angaben für falsch — dabei zählen bloß beide anders
                      (Daniel, 12.08.2026).
                    */}
                    {(s.sharedWith ?? 0) > 1 && (
                      <Tooltip text={t('detail.sharedUrlNote', { count: s.sharedWith! })} seite="oben">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {t('detail.sharedUrl', { count: s.sharedWith! })}
                        </span>
                      </Tooltip>
                    )}
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

          {/*
            Hier stand „Alles aus dieser Reihe" — dieselben Einträge, die zwei
            Handbreit darüber schon im Umschalter stehen. Zwei Listen mit
            identischem Inhalt sind keine doppelte Auskunft, sondern doppelte
            Länge (Daniel, 12.08.2026).
          */}
          {plot && (
            <div>
              <SectionTitle>{t('detail.plot')}</SectionTitle>
              {/*
                Zuerst zwei Sätze, den Rest auf Wunsch.

                Eine Inhaltsangabe von tausend Zeichen schob alles darunter aus
                dem Bild — die deutschen Stimmen, die Keywords, die
                Quellenangabe. Wer die Handlung lesen will, klickt; wer sie nur
                einordnen will, sieht den Anfang und bleibt im Überblick
                (Daniel, 12.08.2026).
              */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {plotOffen || plot.text.length <= PLOT_PREVIEW
                  ? plot.text
                  : `${plot.text.slice(0, PLOT_PREVIEW).trimEnd()} …`}
              </p>
              {plot.text.length > PLOT_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setPlotOffen((v) => !v)}
                  aria-expanded={plotOffen}
                  className="mt-1 cursor-pointer text-xs text-sky-500 hover:underline"
                >
                  {t(plotOffen ? 'detail.plotLess' : 'detail.plotMore')}
                </button>
              )}
              {plot.fallback && (
                <p className="mt-1.5 text-[11px] text-slate-400">{t('detail.plotOnlyEnglish')}</p>
              )}
              {/*
                Die Quelle im selben Stil wie unter einem Termin: „Quelle:
                anisearch.de". Vorher stand sie nur als Fließtext ganz unten in
                der Metazeile und war weder als Quelle erkennbar noch anklickbar.
              */}
              {/*
                Die Quelle steht jetzt an genau einer Stelle und nennt die
                richtige. Vorher stand sie zweimal da: einmal als Fließtext am
                Ende der aniSearch-Beschreibung und einmal als Zeile darunter,
                die pauschal „themoviedb.org" behauptete — auch bei den 2.385
                Texten, die von aniSearch stammen (Daniel, 12.08.2026).
              */}
              <p className="mt-2 text-[11px] text-slate-400">
                {t('detail.source')}:{' '}
                <a
                  href={plot.quelle.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-sky-400"
                >
                  {plot.quelle.name}
                </a>
              </p>
            </div>
          )}

          {title.hasVoices && <VoiceCast titleId={title.id} />}

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

          <p className="text-[11px] text-slate-400">
            {t('detail.metaFrom')}
            {title.malId ? (
              <>
                {' · '}
                <Tooltip text={t('detail.malMeaning')} unterstrichen>
                  MAL
                </Tooltip>{' '}
                {title.malId}
              </>
            ) : (
              ''
            )}{' '}
            ·{' '}
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
