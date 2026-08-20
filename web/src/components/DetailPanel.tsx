import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Meldung, Quelle, Release, ReleaseEvent, Title, WatchLink } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { expandEvents, lastEpisodeDate, releaseStatus, titleStatus } from '@shared/logic.ts'
import { buildIcs, googleCalendarUrl } from '@shared/ics.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import type { FranchiseMember, Franchises } from '@shared/types.ts'
import { anzeigeName, eindeutschenStaffel, ohneStaffelEins, reihenVertreter } from '@shared/titles.ts'
import {
  loadAllTitles,
  loadFranchises,
  loadMeldungen,
  loadSynopsis,
  loadVoices,
  type Synopsis,
  type Voices,
} from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { useShare } from '../lib/share.ts'
import { useNewsletterVerbindung } from '../lib/newsletterSync.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import {
  Button,
  Chip,
  DubMark,
  Fragezeichen,
  ReihenStern,
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

/**
 * Teilen — als Symbol im Kopf, nicht als Knopf neben dem Anbieter.
 *
 * Vorher stand er in der Knopfzeile direkt neben „Bei ADN ansehen", und dort
 * las er sich, als teile er den ADN-Link (Daniel, 15.08.2026: „es lässt
 * vermuten das der teilen link sich auf adn bezieht, dabei bezieht er sich auf
 * dieses panel"). Geteilt wird der Titel, also gehört er zu Auge und Stern —
 * den anderen beiden Handlungen, die dem Titel gelten.
 */
function ShareIcon({ slug, name }: { slug: string; name: string }) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const copied = copiedSlug === slug

  return (
    <Tooltip text={t('detail.shareHint')} seite="unten">
      <button
        type="button"
        onClick={() => share(slug, name)}
        aria-label={t('detail.share')}
        className="cursor-pointer rounded p-1 text-lg leading-none text-slate-400 transition hover:bg-slate-500/10 hover:text-sky-400"
      >
        {copied ? '✓' : '🔗'}
      </button>
    </Tooltip>
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
  /** Die volle Terminliste erscheint erst auf Wunsch. */
  const [alleTermine, setAlleTermine] = useState(false)
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

  /**
   * Die eine Hauptaktion dieses Termins — Beschriftung samt Zielort.
   *
   * Drei Fälle, und sie unterscheiden sich in dem, was der Leser tun **kann**:
   *
   * - **Disc, Termin liegt noch vor uns:** Vorbestellen. „Ansehen" wäre hier
   *   schlicht falsch — es gibt noch nichts zu sehen.
   * - **Disc, Termin ist durch:** Kaufen.
   * - **Stream:** Ansehen, mit dem Namen des Anbieters.
   *
   * Der Zielort steht in jedem Fall dabei. Ein Knopf, der nicht verrät, wohin er
   * führt, ist eine Zumutung — man klickt und landet irgendwo (Daniel,
   * 15.08.2026: „da sollte ein amazon logo sein, wenn der link zu amazon führt,
   * sodass man vorher bescheid weiß, bevor man draufklickt").
   */
  const hauptAktion = useMemo(() => {
    const kauf = release.buyUrl
    if (release.releaseType === 'disc' && kauf) {
      const kuenftig = release.schedule.firstEpisodeDate > today
      return {
        url: kauf,
        label: t(kuenftig ? 'detail.preorderAt' : 'detail.buyAt', { shop: shopName(kauf) }),
      }
    }
    if (release.platformUrl) {
      return {
        url: release.platformUrl,
        label: t('detail.watchOn', { platform: PLATFORMS[release.platform].name }),
      }
    }
    return kauf ? { url: kauf, label: t('detail.buyAt', { shop: shopName(kauf) }) } : undefined
  }, [release, today, t])

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
      {/*
        Zwei Termine, keiner belegbar — dann stehen beide da.

        Nicht heimlich einen wählen: Wenn zwei Quellen verschiedene Tage nennen
        und keine sich belegen lässt, bekommt der Leser beide samt Quelle und
        entscheidet selbst (Daniels Regel, 13.08.2026). Der Kalender führt
        weiterhin nur einen Termin — zwei Einträge würden behaupten, es gebe
        zwei Veröffentlichungen, und das wäre die schlimmere Falschaussage.
      */}
      {release.disputedDates?.length ? (
        <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
          {t('detail.disputedDate')}{' '}
          {release.disputedDates.map((d, i) => (
            <span key={d.date}>
              {i > 0 && ', '}
              <a
                href={d.source}
                target="_blank"
                rel="noreferrer noopener"
                className="cursor-pointer font-semibold underline decoration-dotted underline-offset-2 hover:text-amber-500"
              >
                {formatDate(d.date)}
              </a>
            </span>
          ))}
          {/*
            Kein Gedankenstrich. Er stand hier im Bauteil statt im Text und
            überlebte deshalb den Durchgang durch alle Oberflächentexte
            (Daniel, 15.08.2026: „das ist eindeutig ki, kein mensch macht das").
            Wo ein Satz endet, steht ein Punkt.
          */}
          {'. '}
          {t('detail.disputedDateHint')}
        </p>
      ) : null}
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
        {/*
          Eine Zeile, die sagt, was gerade zählt.

          Vorher standen „Start" und „Letzte Folge" nebeneinander, und bei einer
          laufenden Serie war beides die Vergangenheit — die Frage „wann kommt
          die nächste?" beantwortete keine der beiden (Daniel, 15.08.2026).
          Jetzt richtet sich die Zeile nach dem Stand: kommt noch etwas, steht
          hier die nächste Folge; ist alles durch, die letzte.
        */}
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
            {(naechster || last) && (
              <>
                <dt className="text-slate-400">
                  {t(naechster ? 'detail.nextEpisode' : 'detail.lastEpisode')}
                </dt>
                <dd className="tabular-nums">
                  {formatDate(naechster ? naechster.date : (last as string))}
                </dd>
              </>
            )}
          </>
        )}
      </dl>

      {/*
        Die Hauptaktion nimmt die ganze Zeile, der Rest teilt sich die nächste.

        Vorher standen alle Knöpfe in einer umbrechenden Reihe, und der
        wichtigste — „Bei ADN ansehen" — war genauso breit wie „Teilen" daneben
        (Daniel, 15.08.2026). Jetzt liegt er allein oben über die volle Breite,
        und die übrigen teilen die Zeile darunter zu gleichen Teilen: bei zweien
        je die Hälfte, bei dreien je ein Drittel. Das übernimmt `grid` mit
        `auto-cols-fr`, ohne dass die Zahl im Code stehen muss.
      */}
      <div className="mt-3 flex flex-col gap-2">
        {/*
          **Eine** Hauptaktion, und sie sagt, was passiert und wo.

          Vorher standen hier zwei Knöpfe nebeneinander — „Bei DVD / Blu-ray
          ansehen" und „Kaufen" —, die bei Disc-Terminen auf **dieselbe** Adresse
          zeigten (Daniel, 15.08.2026: „was bringt der kaufen button wenn er auf
          genau das gleiche verlinkt"). Dazu passte „ansehen" nicht: Der Termin
          liegt in der Zukunft, man kann dort nichts ansehen, man kann
          vorbestellen.

          Die Beschriftung richtet sich deshalb nach beidem — Art des Releases
          **und** Lage des Termins —, und der Zielort steht dabei. Das ist das
          Muster von JustWatch und aniSearch: Handlung plus Anbieter in einem
          Feld, statt eines Knopfes, der nicht verrät, wohin er führt.
        */}
        {hauptAktion && (
          <Button href={hauptAktion.url} variant="primary" size="sm" breit>
            {hauptAktion.label}
          </Button>
        )}
        <div className="grid grid-flow-col auto-cols-fr gap-2 empty:hidden">
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
        </div>
      </div>

      {/*
        Die Terminliste ist zugeklappt. Bei einer Zwölfteiler-Serie standen dort
        zwölf Zeilen, die fast immer schon vorbei sind — sie füllten das halbe
        Panel für eine Auskunft, die die wenigsten suchen (Daniel, 15.08.2026).
      */}
      {events.length > 1 && !alleTermine && (
        <button
          type="button"
          onClick={() => {
            // Ein Klick, alle Termine. Vorher klappte er die Liste auf, zeigte
            // acht davon und verlangte denselben Klick ein zweites Mal (Daniel,
            // 15.08.2026).
            setAlleTermine(true)
            setShowAll(true)
          }}
          className="mt-2 cursor-pointer text-xs text-sky-500 hover:underline"
        >
          {t('detail.showAllDates', { count: events.length })}
        </button>
      )}
      {events.length > 1 && alleTermine && (
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
                {/*
                  Eintragen lässt sich nur, was noch kommt. Bei einer Serie, die
                  2024 gelaufen ist, stand hinter jeder Folge ein Knopf, der
                  einen Termin in der Vergangenheit anlegt — sinnlos, und bei
                  zwölf Folgen zwölfmal (Daniel, 15.08.2026).
                */}
                {ev.date >= today && (
                  <a
                    className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-sky-500/10 hover:text-sky-400"
                    href={googleCalendarUrl(ev)}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t('detail.addSingle')}
                  >
                    📅 <span className="hidden sm:inline">{t('detail.addToGoogle')}</span>
                  </a>
                )}
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

      <Quellenliste release={release} />
    </section>
  )
}

/**
 * Die Belegkette eines Termins — aktuelle Quellen offen, überholte auf Klick.
 *
 * Zwei Anforderungen stehen sich hier gegenüber, und beide sind berechtigt:
 * Eine überholte Quelle darf **nie verloren gehen** (sonst ist später nicht
 * mehr zu klären, woher ein alter Termin kam), aber fünf Adressen unter einem
 * Termin sind Quellen-Spam und niemand liest sie.
 *
 * Die Auflösung ist dieselbe, die Wikipedia für Einzelnachweise wählt: sichtbar
 * bleibt, was den geltenden Stand trägt; alles Ältere steht **eingeklappt mit
 * Anzahl** dahinter und ist einen Klick entfernt.
 */
function Quellenliste({ release }: { release: Release }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)

  // Rückfall auf `sources`: ältere Datensätze haben noch keine `quellen`.
  const alle: Quelle[] =
    release.quellen ??
    release.sources.map((url) => ({ url, name: hostname(url), gesehenAm: '', stand: 'aktuell' as const }))
  if (!alle.length) return null

  const aktuell = alle.filter((q) => q.stand !== 'ueberholt' && q.stand !== 'vermutlich-ueberholt')
  const alt = alle.filter((q) => q.stand === 'ueberholt' || q.stand === 'vermutlich-ueberholt')

  return (
    <div className="mt-3 text-[11px] text-slate-400">
      <p>
        {t('detail.source')}:{' '}
        {(aktuell.length ? aktuell : alle).map((q, i) => (
          <span key={q.url}>
            {i > 0 && ', '}
            {istMaschinenquelle(q.url) ? (
              /*
                Der Name kommt aus unserer eigenen Plattformliste, nicht aus der
                Adresse. Ein erster Versuch zerlegte den Hostnamen und machte aus
                `gw.api.animationdigitalnetwork.com` ein „Api" — geraten statt
                nachgesehen, und prompt falsch (15.08.2026).
              */
              t('detail.sourceProvider', { anbieter: PLATFORMS[release.platform].name })
            ) : (
              <a
                href={q.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-sky-400"
              >
                {q.name || hostname(q.url)}
              </a>
            )}
          </span>
        ))}
        {release.automatisch && (
          <>
            {' · '}
            <Tooltip text={t('detail.autoSourceHint')}>
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {t('detail.autoSource')}
              </span>
            </Tooltip>
          </>
        )}
      </p>

      {alt.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            className="mt-1 cursor-pointer underline decoration-dotted underline-offset-2 hover:text-sky-400"
          >
            {offen
              ? t('detail.olderSourcesHide')
              : t(alt.length === 1 ? 'detail.olderSource' : 'detail.olderSources', { count: alt.length })}
          </button>
          {offen && (
            <ul className="mt-1 space-y-0.5 border-l border-slate-300 pl-2 dark:border-slate-700">
              {alt.map((q) => (
                <li key={q.url} className="text-slate-400/70 dark:text-slate-500">
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="line-through underline hover:text-sky-400"
                  >
                    {q.name || hostname(q.url)}
                  </a>{' '}
                  <span className="italic">
                    {q.stand === 'ueberholt' ? t('detail.sourceStale') : t('detail.sourceMaybeStale')}
                  </span>
                  {q.grund && <span className="block">{q.grund}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Was Meldungen über einen Titel sagen, ohne einen Tag zu nennen.
 *
 * Der Grund, dass es diesen Block gibt: Von 29 Meldungen, die der Bot am
 * 14.08.2026 gefunden hatte, nannten zehn nur einen Monat. Bis dahin
 * verschwanden sie in einer Datei, auf die ein Mensch hätte reagieren müssen —
 * für Besucher waren sie schlicht nicht vorhanden, obwohl die Information da
 * war.
 *
 * Jetzt steht sie da, wie sie ist: mit Zitat, mit Datum, mit Link. Ein Termin
 * wird daraus **nicht** — aus „im September" einen Ersten zu machen wäre genau
 * die Falschangabe, gegen die dieses Projekt gebaut ist.
 */
function Meldungen({ titleId }: { titleId: number }) {
  const { t } = useLang()
  const [liste, setListe] = useState<Meldung[]>([])
  const [offen, setOffen] = useState(false)

  useEffect(() => {
    let aktuell = true
    loadMeldungen().then((nachTitel) => {
      if (aktuell) setListe(nachTitel.get(titleId) ?? [])
    })
    return () => {
      aktuell = false
    }
  }, [titleId])

  if (!liste.length) return null

  return (
    <div className="mt-2">
      {/*
        Ein Aufklapper statt eines eigenen Abschnitts, und er sitzt beim Termin.

        Vorher stand der Block weit unten zwischen „Wo läuft es" und „Handlung",
        mit eigener Überschrift und einer wiederholten Quellenzeile — dieselbe
        Adresse, die drei Zeilen weiter oben schon unter dem Termin steht
        (Daniel, 15.08.2026). Was eine Zusatzangabe zum Termin ist, gehört zum
        Termin und bleibt bis zum Klick zusammengefaltet.
      */}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="cursor-pointer text-xs text-sky-500 hover:underline"
      >
        {offen ? t('detail.newsHide') : t('detail.newsShow', { count: liste.length })}
      </button>
      {!offen ? null : (
      <>
      <p className="mb-2 mt-2 text-xs text-slate-500 dark:text-slate-400">{t('detail.newsHint')}</p>
      <ul className="space-y-2">
        {liste.map((m) => (
          <li
            key={m.quelle.url}
            className="rounded border-l-2 border-sky-500/50 bg-slate-500/5 py-1.5 pl-2 pr-2 text-xs"
          >
            <a
              href={m.quelle.url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold underline hover:text-sky-400"
            >
              {m.titel}
            </a>
            {m.zitat && (
              <p className="mt-1 italic leading-relaxed text-slate-500 dark:text-slate-400">
                „… {m.zitat} …"
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              {m.quelle.name} · {formatDate(m.datum)}
            </p>
          </li>
        ))}
      </ul>
      </>
      )}
    </div>
  )
}

/**
 * Bündelt Ausgaben, die im Grunde dasselbe sind.
 *
 * „Banana Fish – Vol. 1" und „Vol. 2" standen als zwei fast identische Kästen
 * untereinander: gleiche Plakette, gleicher Verlag, gleiche Knöpfe, und der
 * einzige Unterschied — Volume und Datum — ging darin unter (Daniel,
 * 15.08.2026: „unnötige dopplung von infos … man kann sowas gut zusammenfassen").
 *
 * Zusammengefasst wird nach **Anbieter, Art und Verlag**. Das ist eng genug,
 * dass keine ungleichen Dinge zusammenfallen: Eine Disc von peppermint und ein
 * Crunchyroll-Stream bleiben getrennt, ebenso eine Disc von AniMoon neben einer
 * von peppermint. Und es ist weit genug, dass eine Volume-Reihe eine Karte
 * ergibt statt vier.
 *
 * Das Muster stammt von aniSearch, das seine deutschen Ausgaben ebenfalls je
 * Zeile führt, aber nur mit dem, was sie **unterscheidet** — der Serientitel
 * steht dort ausschließlich im Seitenkopf.
 */
/**
 * Ein Shop in einer Zeile — mit allen Ausgaben nebeneinander.
 *
 * Bei einem einzigen Eintrag ist die ganze Zeile der Verweis, wie bisher. Bei
 * mehreren steht der Shop links und daneben die Ausgaben als kleine Knöpfe: vier
 * Ausgaben bei AniMoon sind eine Auskunft, keine vier Zeilen.
 */
function ShopZeile({
  gruppe,
  hinweis,
}: {
  gruppe: { shop: string; eintraege: { label?: string; url: string }[] }
  hinweis: string
}) {
  const rahmen =
    'flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-white/10'

  if (gruppe.eintraege.length === 1) {
    return (
      <a
        href={gruppe.eintraege[0].url}
        target="_blank"
        rel="noreferrer noopener"
        className={`${rahmen} cursor-pointer transition hover:border-slate-300 hover:bg-slate-100/60 dark:hover:border-white/25 dark:hover:bg-white/5`}
      >
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{gruppe.shop}</span>
        <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{hinweis}</span>
      </a>
    )
  }

  return (
    <div className={`${rahmen} flex-wrap`}>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{gruppe.shop}</span>
      <span className="flex flex-wrap items-center gap-1">
        {gruppe.eintraege.map((e) => (
          <a
            key={e.url}
            href={e.url}
            target="_blank"
            rel="noreferrer noopener"
            className="cursor-pointer rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 transition hover:border-slate-400 hover:bg-slate-100/60 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:bg-white/5"
          >
            {e.label}
          </a>
        ))}
      </span>
      <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">{hinweis}</span>
    </div>
  )
}

/**
 * Fasst die Bezugswege eines Shops zu einer Zeile zusammen.
 *
 * Vorher stand jede Ausgabe in einer eigenen Zeile: „AniMoon — Vol. 1",
 * „AniMoon — Vol. 2", „AniMoon — Vol. 3", „AniMoon — Vol. 4" untereinander. Das
 * sind vier Zeilen für eine Auskunft — nämlich, dass es die Serie bei AniMoon in
 * vier Ausgaben gibt (Daniel, 20.08.2026).
 *
 * Gruppiert wird nach **Hostnamen**, nicht nach Anzeigenamen: Derselbe Shop
 * schreibt sich in unseren Daten mal so, mal anders, die Adresse nicht. Der
 * Anzeigename kommt aus dem gemeinsamen Teil vor dem Gedankenstrich; steht dort
 * nichts Gemeinsames, bleibt der volle Name stehen.
 */
function gruppiereKaufwege(links: WatchLink[]): { shop: string; eintraege: { label?: string; url: string }[] }[] {
  const nachHost = new Map<string, WatchLink[]>()
  for (const l of links) {
    let host = l.url
    try {
      host = new URL(l.url).hostname.replace(/^www\./, '')
    } catch {
      // Keine gültige Adresse — dann steht der Eintrag eben für sich allein.
    }
    const liste = nachHost.get(host) ?? []
    liste.push(l)
    nachHost.set(host, liste)
  }

  return [...nachHost.values()].map((liste) => {
    const geteilt = liste.map((l) => l.name.split(/\s+—\s+/))
    const gemeinsam = geteilt.every((t) => t.length > 1 && t[0] === geteilt[0][0])
    if (liste.length === 1 || !gemeinsam) {
      return { shop: liste[0].name, eintraege: liste.map((l) => ({ url: l.url })) }
    }
    return {
      shop: geteilt[0][0],
      eintraege: liste.map((l, i) => ({ label: geteilt[i].slice(1).join(' — '), url: l.url })),
    }
  })
}

function gruppiereReleases(releases: Release[]): Release[][] {
  const nachSchluessel = new Map<string, Release[]>()
  for (const r of releases) {
    const key = `${r.platform}|${r.releaseType}|${r.publisher ?? ''}`
    nachSchluessel.set(key, [...(nachSchluessel.get(key) ?? []), r])
  }
  return [...nachSchluessel.values()]
    .map((g) => g.sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate)))
    .sort((a, b) => a[0].schedule.firstEpisodeDate.localeCompare(b[0].schedule.firstEpisodeDate))
}

/**
 * Was eine einzelne Ausgabe von den übrigen der Gruppe unterscheidet.
 *
 * Der gemeinsame Anfang aller Namen fällt weg — bei „Banana Fish – Vol. 1" und
 * „Banana Fish – Vol. 2" bleibt „Vol. 1" und „Vol. 2". Genau das ist die
 * Auskunft, die der Leser sucht; der Serientitel steht drei Zeilen weiter oben.
 */
function unterscheidung(name: string, alle: string[]): string {
  if (alle.length < 2) return name
  let gemeinsam = 0
  while (gemeinsam < name.length && alle.every((n) => n[gemeinsam] === name[gemeinsam])) gemeinsam++
  /**
   * **Auf die letzte Wortgrenze zurück.** Ein Abzug Zeichen für Zeichen
   * schneidet mitten im Wort: Bei „Banana Fish – Vol. 1" und „… Vol. 2" ist der
   * gemeinsame Anfang „Banana Fish – Vol. ", übrig bliebe die nackte Ziffer
   * „1". Genau so stand es am 15.08.2026 im Panel, und „1" allein sagt nichts.
   * Zurück bis zum letzten Leerzeichen bleibt „Vol. 1" — die Auskunft, die
   * gemeint war.
   */
  const saeubern = (ab: number) => name.slice(ab).replace(/^[\s:–—-]+/, '').trim()
  let rest = saeubern(gemeinsam)
  /**
   * Solange der Rest kein einziges Buchstabenzeichen trägt, ist er noch kein
   * Wort — dann wird ein Wort weiter zurückgegangen. „1" wird so zu „Vol. 1".
   * Die Schleife endet spätestens am Anfang des Namens.
   */
  while (!/\p{L}/u.test(rest) && gemeinsam > 0) {
    const vorheriges = name.lastIndexOf(' ', gemeinsam - 1)
    if (vorheriges < 0) break
    gemeinsam = vorheriges
    rest = saeubern(gemeinsam)
  }
  return rest || name
}

/**
 * Mehrere Ausgaben derselben Sache in **einer** Karte.
 *
 * Die Plaketten, der Verlag und die Quellen stehen einmal oben; darunter je
 * Ausgabe genau eine Zeile mit dem, was sie ausmacht: Datum, Unterscheidung,
 * Medium und die eine Aktion, die dort möglich ist. Das ist dieselbe Aufteilung,
 * die JustWatch für seinen Angebotsblock benutzt — ein Rahmen, wechselnder
 * Inhalt — nur ohne Reiter, weil zwei bis vier Zeilen keinen Umschalter
 * brauchen.
 */
function ReleaseGruppe({ releases, today }: { releases: Release[]; today: string }) {
  const { t } = useLang()
  const erste = releases[0]
  const namen = releases.map((r) => r.name)
  /**
   * Je Seite ein Eintrag, auch wenn mehrere Artikel von dort stammen.
   *
   * Bei Banana Fish standen zwei verschiedene Anime2You-Artikel hinter den zwei
   * Ausgaben — angezeigt wurde „Quelle: anime2you.de, anime2you.de", und das
   * las sich wie ein Fehler statt wie zwei Belege (15.08.2026). Gezeigt wird
   * jetzt jede Seite einmal, verlinkt auf den ersten Artikel; die übrigen sind
   * über die Quellenhistorie weiterhin vollständig im Datensatz.
   */
  const alleQuellen = [...new Map(releases.flatMap((r) => r.sources).map((s) => [hostname(s), s])).values()]

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ReleaseTypeBadge type={erste.releaseType} />
        <PlatformBadge platform={erste.platform} />
        {erste.fsk !== undefined && <FskBadge fsk={erste.fsk} />}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('detail.editionCount', { count: releases.length })}
        </span>
      </div>
      {erste.publisher && (
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{erste.publisher}</p>
      )}

      <ul className="divide-y divide-slate-200 dark:divide-white/10">
        {releases.map((r) => {
          const kuenftig = r.schedule.firstEpisodeDate > today
          return (
            <li key={r.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
              <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatDate(r.schedule.firstEpisodeDate)}
              </span>
              <span className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">{unterscheidung(r.name, namen)}</span>
                {r.edition && (
                  <span className="block text-slate-400 dark:text-slate-500">{r.edition}</span>
                )}
              </span>
              {r.buyUrl && (
                <Button href={r.buyUrl} variant={kuenftig ? 'primary' : undefined} size="sm">
                  {t(kuenftig ? 'detail.preorderAt' : 'detail.buyAt', { shop: shopName(r.buyUrl) })}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {alleQuellen.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400">
          {t('detail.source')}:{' '}
          {alleQuellen.map((s, i) => (
            <span key={s}>
              {i > 0 && ', '}
              <a href={s} target="_blank" rel="noreferrer noopener" className="underline hover:text-sky-400">
                {hostname(s)}
              </a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/**
 * Alle weiteren Schreibweisen eines Titels — eingeklappt, an einer Stelle.
 *
 * Nach dem Muster von MyAnimeLists „Alternative Titles": ein Aufklapper statt
 * dauerhaft sichtbarer Zeilen. Wer die Umschrift oder die Originalschrift sucht,
 * findet sie in einem Klick; alle anderen bekommen zwei Zeilen weniger, die sie
 * nie gelesen hätten.
 *
 * Die Regel „infos nie verstecken" (Daniel, 15.08.2026) ist damit nicht
 * verletzt, sondern befolgt: Verstecken hieße weglassen oder hinter ein Symbol
 * ohne Beschriftung packen. Hier steht ausgeschrieben, was drin ist, samt
 * Anzahl — genau das, was MAL mit „More titles" tut.
 */
function WeitereTitel({ title }: { title: Title }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)

  const gezeigt = title.titleDe ?? title.titleEn ?? title.titleRomaji
  const weitere: { label: string; wert: string }[] = []
  if (title.titleRomaji && title.titleRomaji !== gezeigt) {
    weitere.push({ label: t('detail.titleRomaji'), wert: eindeutschenStaffel(title.titleRomaji) })
  }
  if (title.titleEn && title.titleEn !== gezeigt) {
    weitere.push({ label: t('detail.titleEn'), wert: title.titleEn })
  }
  if (title.titleNative) weitere.push({ label: t('detail.titleNative'), wert: title.titleNative })
  if (!weitere.length) return null

  return (
    <div className="mt-0.5 text-xs">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="cursor-pointer text-slate-400 underline decoration-dotted underline-offset-2 hover:text-sky-400 dark:text-slate-500"
      >
        {offen ? t('detail.otherTitlesHide') : t('detail.otherTitles', { count: weitere.length })}
      </button>
      {offen && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-500 dark:text-slate-400">
          {weitere.map((w) => (
            <Fragment key={w.label}>
              <dt className="text-slate-400 dark:text-slate-500">{w.label}</dt>
              <dd className="min-w-0 break-words">{w.wert}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * Quellen, die ein Mensch nicht aufschlagen kann.
 *
 * Manche Termine kommen aus einer Programmschnittstelle statt von einer Seite —
 * bei ADN etwa aus `gw.api.animationdigitalnetwork.com`. Diese Adresse als Link
 * anzubieten wäre eine Zumutung: Wer darauf klickt, landet bei JSON oder einer
 * Fehlermeldung. Vorher stand dort ersatzweise die Startseite des Anbieters,
 * und die war schlicht falsch — dort steht keiner dieser Termine (Daniel,
 * 15.08.2026: „das ist keine quelle").
 *
 * Also wird gesagt, was zutrifft: Die Termine kommen vom Anbieter selbst.
 */
function istMaschinenquelle(url: string): boolean {
  const host = hostname(url)
  return host.startsWith('api.') || host.startsWith('gw.api.')
}



/**
 * Der Shop, wie ihn ein Mensch nennt — „Amazon", nicht „www.amazon.de".
 *
 * aniSearch schreibt bei seinen Kaufverweisen die Domain aus, und das ist die
 * belegte, funktionierende Lösung für dieselbe Frage: Vor dem Klick wissen,
 * wohin es geht. Wir kürzen sie noch auf den Namen, weil „amazon.de" in einem
 * Knopf mehr nach Adresszeile aussieht als nach Ziel.
 */
function shopName(url: string): string {
  const host = hostname(url)
  const kern = host.replace(/\.(de|com|net|org|co\.uk|fr)$/, '')
  return kern.charAt(0).toUpperCase() + kern.slice(1)
}

/** Hostname ohne „www." — der Rest der Adresse sagt dem Leser nichts. */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
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
  const [stimmen, setStimmen] = useState<Voices | undefined>()

  // Titelwechsel: zuklappen und vergessen. Sonst stünde beim nächsten Anime
  // kurz die Besetzung des vorherigen da.
  useEffect(() => {
    setOpen(false)
    setStimmen(undefined)
  }, [titleId])

  useEffect(() => {
    if (!open || stimmen) return
    let alive = true
    loadVoices(titleId)
      .then((v) => {
        if (alive) setStimmen(v)
      })
      .catch(() => {
        if (alive) setStimmen({ roles: [] })
      })
    return () => {
      alive = false
    }
  }, [open, stimmen, titleId])

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
          {stimmen === undefined ? (
            <p className="text-sm text-slate-400">{t('detail.voicesLoading')}</p>
          ) : stimmen.roles.length === 0 ? (
            <p className="text-sm text-slate-400">{t('detail.voicesNone')}</p>
          ) : (
            <>
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 text-sm">
                {stimmen.roles.map((r) => (
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
              {/*
                Quellennennung, und bei ANN ist sie eine Auflage, keine Geste.

                Anime News Network verlangt fuer die Nutzung der
                Encyclopedia-Daten ausdruecklich eine Quellenangabe **und** einen
                Link zum jeweiligen Eintrag auf jeder Seite, die die Angaben
                zeigt. Der Link steht deshalb hier und nicht auf der
                Quellenseite: Er gehoert dorthin, wo die Daten stehen.
              */}
              <p className="mt-2 text-[11px] text-slate-400">
                {t('detail.voicesSource')}
                {stimmen.annUrl && (
                  <>
                    {', '}
                    <a
                      href={stimmen.annUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline hover:text-sky-400"
                    >
                      Anime News Network
                    </a>
                  </>
                )}
              </p>
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
  const verbindung = useNewsletterVerbindung()
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
   * Alle Kennungen der Reihe — aus zwei Quellen zusammengeführt.
   *
   * `franchises.json` deckt nur den gepflegten Bestand ab. Titel **ohne**
   * deutsche Synchro stehen dort nicht, gehören aber zur selben Reihe: „Link
   * Click" hat sieben Teile und keinen einzigen mit Synchro. Der zweite Weg
   * geht deshalb über das, was die Anwendung ohnehin geladen hat — wer im
   * Detail-Panel steht, hat die passende Liste vorher geöffnet.
   */
  /**
   * Alle Teile der Reihe als Karten — aus **beiden** Beständen.
   *
   * `franchises.json` deckt nur den gepflegten Bestand ab. Titel ohne deutsche
   * Synchro stehen dort nicht, gehören aber zur selben Reihe: „Link Click" hat
   * sieben Teile und keinen einzigen mit Synchro — der Umschalter fehlte dort
   * deshalb ganz, obwohl die Kachel korrekt gebündelt war (Daniel, 13.08.2026).
   *
   * Die zweite Quelle ist das, was die Anwendung ohnehin geladen hat. Wer im
   * Detail-Panel steht, hat die passende Liste vorher geöffnet; im Kalender
   * fehlen die Cover mancher Teile, dafür trägt `franchises.json` sie bei.
   */
  const reihenTeile: FranchiseMember[] = useMemo(() => {
    if (!title) return []
    const wurzel = title.franchiseId ?? title.id
    const teile = new Map<number, FranchiseMember>()
    for (const m of reihe) teile.set(m.id, m)
    for (const t of data.titleById.values()) {
      if ((t.franchiseId ?? t.id) !== wurzel) continue
      const bisher = teile.get(t.id)
      teile.set(t.id, {
        id: t.id,
        name: bisher?.name ?? t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`,
        format: bisher?.format ?? t.format,
        jpYear: bisher?.jpYear ?? t.jpYear,
        episodes: bisher?.episodes ?? t.episodes,
        cover: bisher?.cover ?? t.coverImage,
      })
    }
    if (!teile.has(title.id)) {
      teile.set(title.id, {
        id: title.id,
        name: anzeigeName(title),
        format: title.format,
        jpYear: title.jpYear,
        episodes: title.episodes,
        cover: title.coverImage,
      })
    }
    // Nach Ausstrahlung: erst das Jahr, dann die Kennung als stabiler Zweitschlüssel.
    return [...teile.values()].sort((a, b) => (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id)
  }, [title, reihe, data])

  const reihenIds: number[] = useMemo(() => reihenTeile.map((m) => m.id), [reihenTeile])

  /**
   * Das Banner des Titels — oder geliehen von einem Teil der Reihe, der eines hat.
   *
   * Ohne den Rückfall verschwindet der Kopf beim Umschalten auf ein Special und
   * kommt beim Zurückschalten wieder; das Panel springt dabei um 112 Pixel.
   */
  const banner: string | undefined = useMemo(() => {
    if (!title) return undefined
    if (title.bannerImage) return title.bannerImage
    for (const m of reihenTeile) {
      const t = data.titleById.get(m.id)
      if (t?.bannerImage) return t.bannerImage
    }
    return undefined
  }, [title, reihenTeile, data])

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
   * Was diesen Teil von der Reihe unterscheidet — „Staffel 3", „Der Film".
   *
   * Steht unter dem Karussell an der Stelle, an der vorher noch einmal der
   * Reihenname stand. Der Grund: Welcher Teil gerade offen ist, war allein am
   * blauen Rahmen einer von acht Vorschaukarten zu erkennen, und das ging unter
   * (Daniel, 15.08.2026). Der Unterschied ist die wichtigste Auskunft im Kopf,
   * also steht er im Klartext und am größten.
   *
   * Ermittelt wird er durch Abzug: Was am Namen des Teils über den Reihennamen
   * hinausgeht, ist das Unterscheidende. Bleibt nichts übrig — der Teil heißt
   * genau wie die Reihe, typisch für die erste Staffel —, treten Format und
   * Jahr an seine Stelle, denn „2023" unterscheidet immer noch.
   *
   * **Nur innerhalb einer Reihe.** Bei einem Titel, der allein steht, gibt es
   * nichts zu unterscheiden, und der Rückfall auf das Jahr wird zur Absurdität:
   * Über „Banana Fish" stand am 15.08.2026 in großer, fetter Schrift „2018".
   * Deshalb prüft die Ausgabestelle zusätzlich, ob die Reihe überhaupt mehr als
   * einen Teil hat.
   */
  const teilName = useMemo(() => {
    if (!title) return ''
    const voll = eindeutschenStaffel(anzeigeName(title))
    const rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
      ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
      : voll
    /**
     * Bleibt nichts übrig, heißt der Teil wie die Reihe — dann steht auch der
     * volle Name hier, und die Ausgabestelle unterdrückt die Zeile als
     * Wiederholung.
     *
     * Vorher trat hier Format und Jahr an die Stelle des Namens, und über
     * „Fairy Tail" stand in großer Schrift „2009" (Daniel, 15.08.2026 — schon
     * das zweite Mal, nachdem bei Banana Fish „2018" dort stand). Eine nackte
     * Jahreszahl als Überschrift beantwortet keine Frage; welcher Teil gewählt
     * ist, zeigt das Karussell.
     */
    return rest || voll
  }, [title, reihenName])

  /**
   * Beim Wechsel auf eine Staffel ohne Termin fehlen die Metadaten — die liegen
   * in `titles.json`, das im Kalender nicht geladen ist. Erst holen, dann
   * öffnen, sonst zeigt das Panel „keine Metadaten".
   */
  const [wechselt, setWechselt] = useState(false)

  /**
   * Kaufwege getrennt und nach Shop gebündelt.
   *
   * Getrennt, weil „Ansehen" und „Kaufen" zwei verschiedene Fragen sind.
   * Gebündelt, weil vier Ausgaben desselben Verlags eine Auskunft sind.
   */
  const kaufwege = useMemo(
    () => gruppiereKaufwege((title?.watchLinks ?? []).filter((w) => w.kind === 'buy')),
    [title],
  )
  /** Alles, was man ansehen kann — Plattformen und Anbieter ohne eigene. */
  const ansehen = useMemo(
    () => [...(title?.streams ?? []), ...(title?.watchLinks ?? []).filter((w) => w.kind === 'stream')],
    [title],
  )
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
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0d1220]">
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
          className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col justify-center gap-4 border-l border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
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
  const keywords = allKeywords ? title.keywords : title.keywords.slice(0, KEYWORD_PREVIEW)

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        /*
          Von `max-w-md` (28 rem) auf `max-w-lg` (32 rem) — vier Rem mehr
          (Daniel, 15.08.2026: „evtl die gesamte card paar pixel breiter").

          Der Gewinn ist kein Selbstzweck: Die Terminzeilen tragen jetzt Datum,
          Ausgabe und Aktion **nebeneinander**. Bei 28 rem brach die Aktion in
          eine eigene Zeile um, und aus einer Zeile je Ausgabe wurden zwei —
          genau die Platzverschwendung, die verschwinden sollte. Auf schmalen
          Schirmen greift weiterhin `w-full`, dort ändert sich nichts.
        */
        className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1220]"
        role="dialog"
        aria-label={anzeigeName(title)}
      >
        {/*
          Ohne Banner braucht das ✕ trotzdem seinen eigenen Streifen.

          Der Knopf liegt absolut in diesem Kasten. Fehlt das Bild, fällt der
          Kasten auf Höhe null zusammen, und das ✕ landet auf dem Inhalt
          darunter — genau auf dem Favoritenstern, der oben rechts in der
          Titelzeile sitzt (Daniel, 13.08.2026, mit Bild). Aufgefallen ist es
          bei den Titeln ohne deutsche Synchro, weil die grundsätzlich kein
          Banner haben; betroffen war aber jeder Titel ohne Bannerbild.

          **`shrink-0` ist der eigentliche Fix, nicht `h-9`.** Der erste Versuch
          setzte nur die Höhe — und die blieb wirkungslos: Das Panel ist eine
          Flex-Spalte mit Rollbereich, und darin schrumpft ein Element ohne
          `shrink-0` auf null zurück, ganz gleich welche Höhe daransteht.
          Gemessen wurde genau das: Klasse `relative h-9` gesetzt, Höhe 0
          (Daniel, 13.08.2026: „ich hab grad geguckt, ist immer noch über dem
          Stern"). Merksatz: In einer scrollenden Flex-Spalte ist eine Höhe
          ohne `shrink-0` ein Vorschlag, keine Angabe.
        */}
        {/*
          Das Banner bleibt beim Wechsel des Reihenteils stehen.

          Vorher hing es allein an `title.bannerImage` — und weil längst nicht
          jeder Teil einer Reihe eines hat, verschwand es beim Umschalten und
          kam beim Zurückschalten wieder. Der Kopf sprang dabei um 112 Pixel
          (Daniel, 13.08.2026). Jetzt gilt: eigenes Banner, sonst das des
          ersten Teils der Reihe, der eines hat. Ein Banner ist Schmuck für die
          Reihe, kein Beleg für den einzelnen Titel — es darf geliehen werden.
        */}
        <div className={`relative shrink-0 ${banner ? '' : 'h-9'}`}>
          {banner && <img src={banner} alt="" className="h-28 w-full object-cover opacity-70" />}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail.close')}
            className="absolute right-2 top-2 cursor-pointer rounded-full bg-black/50 px-2 py-1 text-sm text-white transition hover:bg-black/70"
          >
            ✕
          </button>
        </div>

        {/*
          Das Karussell der Reihenteile — es ersetzt Cover **und** Auswahlliste.

          Vorher stand links ein einzelnes Cover, rechts daneben alle Angaben,
          und weiter unten eine Auswahlliste mit der Überschrift „Staffel, Film
          oder Special". Drei Bausteine für eine Sache. Jetzt zeigt das
          Karussell alle Teile als Vorschaukarten, der gewählte ist darin
          hervorgehoben, und die Angaben stehen darunter über die volle Breite
          (Daniel, 13.08.2026). Die Überschrift entfällt: Ein Karussell aus
          Covern erklärt sich selbst.

          Auch bei einem Einzeltitel bleibt es stehen — dann als eine Karte.
          Sonst verschwände beim Umschalten auf einen Titel ohne Geschwister
          das Cover, und der Kopf sähe plötzlich anders aus.
        */}
        <div className="flex flex-col gap-3 p-4">
          {/*
            Der Reihenname steht **über** dem Karussell, der gewählte Teil
            darunter (Daniel, 15.08.2026: „ich hab s3 ausgewählt, es ist kaum
            erkennbar… das ist der wichtigste teil").

            Vorher trugen beide Zeilen denselben Reihennamen, und welcher Teil
            gerade offen war, stand nur als blauer Rahmen an einer der
            Vorschaukarten — bei acht Karten nebeneinander ein Rahmen zu viel,
            um ihn zu bemerken. Jetzt beantwortet die Zeile unter dem Karussell
            die Frage im Klartext: „Staffel 3".

            Die beiden Bedienelemente teilen sich entsprechend auf: Der
            Reihen-Stern gehört zur Reihe und steht oben, Stern und Auge
            gehören zum gewählten Teil und stehen unten. Das ersetzt zugleich
            die frühere absolute Positionierung — zwei Sterne übereinander
            brauchte es nur, solange beide in derselben Zeile hingen.
          */}
          <div className="flex items-start gap-2">
            <h2 className="flex-1 text-lg font-semibold leading-tight text-slate-900 dark:text-white">
              {reihenName}
            </h2>
            {/*
              Auge und Stern stehen hier oben, nicht mehr unter dem Karussell.

              Sie sind die einzigen Bedienelemente des Kopfbereichs und gehören
              damit an dessen Anfang — zusammen mit dem Reihen-Stern, der
              dieselbe Sache für die ganze Reihe tut. Vorher hingen sie an der
              Titelzeile unter dem Karussell und brauchten dort bei einem
              Einzeltitel, dessen Titelzeile jetzt entfällt, eine eigene Zeile
              für nichts weiter als zwei Symbole.
            */}
            <div className="flex shrink-0 items-center gap-2">
              <ShareIcon slug={title.slug} name={anzeigeName(title)} />
              <HideEye hidden={false} onToggle={() => onToggleHidden(title.id)} />
              <FavoriteStar active={favorites.has(title.id)} onToggle={() => onToggleFavorite(title.id)} />
            </div>
            {reihenIds.length > 1 && (
              <div className="flex shrink-0 items-center gap-1">
                <ReihenStern
                  alleGemerkt={reihenIds.every((id) => favorites.has(id))}
                  anzahl={reihenIds.length}
                  onMerken={() => {
                    for (const id of reihenIds) if (!favorites.has(id)) onToggleFavorite(id)
                  }}
                />
                <Fragezeichen text={t('detail.seriesStarHelp', { count: reihenIds.length })} />
              </div>
            )}
          </div>

          <div
            className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
            role="tablist"
            aria-label={t('detail.seriesParts')}
          >
            {reihenTeile.map((m) => {
              const gewaehlt = m.id === title.id
              const gemerkt = favorites.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={gewaehlt}
                  disabled={wechselt}
                  onClick={() => !gewaehlt && wechsleZu(m.id)}
                  className={[
                    'group/karte relative w-24 shrink-0 snap-start overflow-hidden rounded-lg border text-left transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60',
                    /*
                      Zwei Zustände, zwei Farben, und sie dürfen sich nicht ins
                      Gehege kommen: Blau heißt „das siehst du gerade", Bernstein
                      „das hast du gemerkt". Ein gemerkter Teil, der zugleich der
                      gewählte ist, behält den blauen Ring — die Auswahl ist die
                      dringlichere Auskunft — und trägt den Stern trotzdem.
                      Gemerkte Karten sind außerdem nie blass: Was man sich
                      gemerkt hat, soll man im Karussell sofort finden.
                    */
                    gewaehlt
                      ? 'border-sky-400 ring-2 ring-sky-400/60'
                      : gemerkt
                        ? 'cursor-pointer border-amber-400/70 hover:border-amber-400 dark:border-amber-400/60'
                        : 'cursor-pointer border-slate-200 opacity-70 hover:opacity-100 dark:border-white/10',
                  ].join(' ')}
                >
                  <span className="block aspect-[2/3] w-full bg-slate-200 dark:bg-white/5">
                    {m.cover && (
                      <img src={m.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  {gemerkt && (
                    <span
                      className="absolute left-1 top-1 rounded-full bg-black/60 px-1 text-[11px] leading-tight text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,.6)]"
                      aria-label={t('card.unfavourite')}
                    >
                      ★
                    </span>
                  )}
                  <span className="block px-1.5 py-1 text-[10px] leading-tight text-slate-600 dark:text-slate-300">
                    <span className="line-clamp-2 font-medium">{eindeutschenStaffel(m.name)}</span>
                    <span className="mt-0.5 block text-slate-400 dark:text-slate-500">
                      {[m.format && m.format !== 'TV' ? (FORMAT_DE[m.format] ?? m.format) : '', m.jpYear]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          {wechselt && <span className="text-[11px] text-slate-400">{t('detail.seasonLoading')}</span>}

          <div className="min-w-0 flex-1">
            {/*
              Die zweite Titelzeile entfällt, wenn sie nur die erste wiederholt.

              Bei „Banana Fish" stand der Name viermal untereinander: als
              Reihenname über dem Karussell, hier noch einmal, und darunter als
              Umschrift und in Originalschrift — dreimal davon identisch
              (Daniel, 15.08.2026: „banana fish steht dort 3x"). Ein Titel ohne
              weitere Reihenteile hat schlicht keinen unterscheidenden Zusatz;
              dann trägt ihn die Zeile über dem Karussell allein.
            */}
            {reihenTeile.length > 1 && teilName !== reihenName && (
              <div className="flex items-start gap-2">
                <h3 className="flex-1 text-xl font-bold leading-tight text-slate-900 dark:text-white">
                  {teilName}
                </h3>
              </div>
            )}
            {/*
              Alle weiteren Schreibweisen an **einer** Stelle und eingeklappt.

              Vorbild ist MyAnimeLists „Alternative Titles" mit seinem
              „More titles"-Aufklapper: Der Titel steht genau einmal groß, alle
              Varianten gebündelt daneben. Vorher standen Umschrift und
              Originalschrift als zwei eigene Zeilen dauerhaft im Weg — für eine
              Auskunft, die die wenigsten suchen und niemand zweimal braucht.

              Die Umschrift bekommt dabei „Staffel" statt „Season": Sie ist
              ohnehin eine Mischform („Tensei Shitara Slime Datta Ken 4th
              Season"), und ein zweites „Season" unter einem deutschen
              „Staffel 4" wäre genau der Widerspruch, um den es ging. Die
              Originalschrift bleibt unangetastet.
            */}
            <WeitereTitel title={title} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {/*
                Status und FSK standen hier **und** in jedem Terminblock
                darunter — bei einem Titel mit genau einem Release war das
                zweimal dieselbe Auskunft im selben Bild (Daniel, 13.08.2026:
                „erschienen und fsk label werden im panel doppelt angezeigt").

                Weg ist die Angabe hier oben, nicht die unten: Der Terminblock
                nennt sie **je Release**, und das ist die genauere Aussage —
                eine Disc kann eine andere Freigabe tragen als der Stream, und
                „erschienen" gilt für einen Termin, nicht für einen Anime. Die
                Bewertung bleibt, die gibt es je Titel nur einmal.
              */}
              {/*
                Die Wertung nennt ihre Quelle — sonst sieht es aus, als wäre es
                unsere.

                „★ 8.4" ohne Herkunft las sich, als hätten wir diesen Anime
                selbst mit 8,4 bewertet (Daniel, 15.08.2026). Wir bewerten
                nichts; die Zahl ist der Nutzerdurchschnitt von AniList. Wie man
                das löst, ist ein gelöstes Problem: JustWatch stellt das Logo der
                Quelle vor den Wert, MyAnimeList schreibt „scored by 418,623
                users" dazu, TMDB beschriftet die eigene Wertung wörtlich als
                „Benutzerbewertung". Gemeinsam ist allen, dass **neben der Zahl
                steht, wer sie vergeben hat**.

                Hier steht der Name ausgeschrieben statt eines Logos: AniList
                liefert keine Bildmarke zur freien Verwendung, und ein
                nachgebautes Logo wäre schlechter als ein Wort.
              */}
              {title.score !== undefined && (
                <Tooltip text={t('detail.scoreHint')} seite="oben">
                  <span className="inline-flex cursor-help items-baseline gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                    <span className="font-normal text-slate-500 dark:text-slate-400">AniList</span>
                    {/* Der Stern macht auf einen Blick klar, dass es eine
                        Wertung ist und keine Folgenzahl (Daniel, 15.08.2026). */}
                    <span className="text-amber-400" aria-hidden="true">
                      ★
                    </span>
                    <span className="font-semibold tabular-nums">{(title.score / 10).toFixed(1)}</span>
                  </span>
                </Tooltip>
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
          {releases.length > 0 ? (
            <div className="flex flex-col gap-3">
              <SectionTitle>{t('detail.releases')}</SectionTitle>
              {gruppiereReleases(releases).map((gruppe) =>
                gruppe.length > 1 ? (
                  <ReleaseGruppe key={gruppe[0].slug} releases={gruppe} today={today} />
                ) : (
                  <ReleaseBlock key={gruppe[0].slug} release={gruppe[0]} today={today} />
                ),
              )}
              {/* Zusatzangaben zum Termin gehören zum Termin, nicht in einen
                  eigenen Abschnitt weiter unten (Daniel, 15.08.2026). */}
              <Meldungen titleId={title.id} />
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
              {title.ohneSynchro ? (
                /*
                  Für einen Titel ohne belegte Synchro wäre „Termin unbekannt"
                  die falsche Auskunft: Unbekannt ist nicht der Termin, sondern
                  ob es überhaupt je eine deutsche Fassung gibt. Hier steht
                  deshalb, was wir wirklich wissen — und was der Stern bringt.
                */
                <section className="rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-3 dark:border-white/20 dark:bg-white/[0.02]">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('detail.noDubTitle')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {t('detail.noDubBody')}
                  </p>
                  {/*
                    Der Hinweis sagt, was der Stern **bewirkt**, und das hängt
                    davon ab, ob ein Newsletter hinterlegt ist.

                    Vorher stand hier „☆ Merken — du bekommst eine Mail, sobald
                    sich das ändert." Das versprach eine Mail an jemanden, der
                    womöglich gar nicht abonniert hat (Daniel, 15.08.2026:
                    „schwammig formuliert und nutzer können es leicht falsch
                    verstehen"). Jetzt steht bei einem verbundenen Browser die
                    Adresse da, an die wir tatsächlich schreiben, und bei einem
                    unverbundenen der zweite nötige Schritt.
                  */}
                  <p className="mt-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                    {verbindung.verbunden
                      ? t('detail.noDubWatchConnected', { mail: verbindung.mail ?? '' })
                      : t('detail.noDubWatchOpen')}
                  </p>
                  {favorites.has(title.id) && (
                    <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      {t('detail.noDubWatched')}
                    </p>
                  )}
                </section>
              ) : (
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
              )}
            </div>
          )}

          {(title.streams.length > 0 || (title.watchLinks?.length ?? 0) > 0) && (
            <div>
              <SectionTitle>{t('detail.whereToWatch')}</SectionTitle>
              <div className="flex flex-col gap-1.5">
                {/*
                  Die Überschrift steht nur da, wenn es auch etwas zu kaufen
                  gibt. Sonst wäre sie eine Trennung ohne zweite Seite — und
                  eine Zeile, die nichts sagt.
                */}
                {kaufwege.length > 0 && ansehen.length > 0 && (
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('where.stream')}
                  </div>
                )}
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

                {/*
                  Anbieter ohne eigene Plattform, nach Shop gebündelt.

                  Vier Ausgaben einer Serie bei demselben Verlag sind **eine**
                  Auskunft, keine vier — deshalb steht der Shop einmal da und die
                  Ausgaben nebeneinander (Daniel, 20.08.2026).
                */}
                {gruppiereKaufwege((title.watchLinks ?? []).filter((w) => w.kind === 'stream')).map((g) => (
                  <ShopZeile key={g.shop + g.eintraege[0].url} gruppe={g} hinweis={t('detail.linkStream')} />
                ))}

                {kaufwege.length > 0 && (
                  <>
                    {/*
                      Eigene Überschrift, sobald es etwas zu kaufen gibt.

                      „Ansehen" und „Kaufen" sind zwei verschiedene Fragen: Wer
                      ein Abo hat, will nicht zur Kasse, und wer die Disc sucht,
                      interessiert sich nicht für Streams. In einer Liste musste
                      man jede Zeile einzeln lesen, um sie zu trennen.
                    */}
                    <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('where.buy')}
                    </div>
                    {kaufwege.map((g) => (
                      <ShopZeile key={g.shop + g.eintraege[0].url} gruppe={g} hinweis={t('detail.linkBuy')} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/*
            Kein Anbieter? Dann steht das da — statt gar nichts.

            Bis zum 20.08.2026 wurde der ganze Abschnitt weggelassen, sobald wir
            keine Bezugsquelle kannten. Das betraf **665 von 2.760 Titeln**, und
            für einen Besucher waren zwei sehr verschiedene Dinge nicht zu
            unterscheiden: „läuft nirgends" und „wissen wir nicht". Bei
            „.hack//SIGN" etwa ist die deutsche Synchro über Sprechrollen belegt,
            nur weiß niemand, wo man sie heute noch sehen kann.

            Das ist genau der Fall, für den der Projektgrundsatz „Unsicheres
            kennzeichnen statt weglassen" gemacht ist. Ein Satz, kein Absatz: Er
            hat die eine Aufgabe, das Suchen auf dieser Seite zu beenden.
          */}
          {title.streams.length === 0 && (title.watchLinks?.length ?? 0) === 0 && (
            <div>
              <SectionTitle>{t('detail.whereToWatch')}</SectionTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('detail.whereUnknown')}</p>
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
