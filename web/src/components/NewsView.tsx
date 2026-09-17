import { useEffect, useMemo, useRef, useState } from 'react'
import { PLATFORMS, type NewsArt, type NewsEintrag, type NewsMeldung, type PlatformId } from '@shared/types.ts'
import { loadNews, type Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { todayIso, addDays } from '@shared/time.ts'

/**
 * **Was sich getan hat — ein Anime, ein Tag, eine Zeile.**
 *
 * Daniel am 12.09.2026: „pro tag max 1 eintrag je anime - alle infos zu diesem
 * anime (neue folgen, disc release, ankündigung zu weiteren folgen/staffeln,
 * etc.) müssen unter diesem anime gebündelt aufgelistet sein. und die übersicht
 * muss noch kompakter, damit man nicht so viel scrollen muss. interaktion für
 * mehr details, pills oder sonstige darstellungsweise für übersicht."
 *
 * ## Woher der Aufbau kommt
 *
 * Zehn Listen dieser Art gemessen (Zeilenhöhe und Schriftgrößen im Browser
 * abgelesen, nicht geschätzt): Sentry 119 px, Discourse 88 px, LiveChart
 * 80–92 px, GitHub 64–71 px, Wikipedias erweiterte Letzte Änderungen 22 px.
 * Zwei Befunde tragen diesen Entwurf:
 *
 * 1. **Keine dieser Listen mischt beliebig viele Ereignisarten in eine Zeile.**
 *    Wer feste Arten hat, nimmt Spalten (Sentry: Events/Users; Discourse:
 *    Antworten/Aufrufe); wer wechselnde hat, nimmt Chips. Unsere Arten
 *    schwanken je Tag — also Chips.
 * 2. **Der Zähler ist der Aufklapper** (Wikipedia „3 Änderungen", incident.io
 *    „6 components ⌄"). Aufgeklappt wird **inline**: Der Kontext bleibt stehen,
 *    die Scrollposition auch, und auf einem Touchgerät braucht es keinen
 *    Hover-Zustand, den es dort nicht gibt.
 *
 * Übernommen ist deshalb Sentrys Zeilenaufbau (Bild, zwei Textgrößen, Chips
 * rechts) mit Wikipedias Aufklapper. Gegenüber der ersten Fassung — eine Zeile
 * je Meldung, 58 px — kostet ein Titel mit drei Meldungen an einem Tag jetzt
 * eine Zeile statt drei.
 *
 * **Die Sätze entstehen hier und nicht im Bau**, sonst stünde die deutsche
 * Fassung fest in einer Datei. Kurz in der Übersicht, ausführlich beim
 * Aufklappen: Die Übersicht beantwortet „ist etwas passiert", das Detail
 * „was genau".
 */
const FARBE: Record<NewsArt, string> = {
  neu: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  folgen: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  angekuendigt: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  disc: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  kino: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  verspaetet: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
}

/**
 * Die Reihenfolge ist **fest**, nicht nach Häufigkeit — sonst springen die
 * Chips von Tag zu Tag an eine andere Stelle, und das Auge findet nichts
 * wieder. Sie ist zugleich die Rangfolge: Was hier vorn steht, formuliert die
 * Satzzeile der Übersicht.
 */
const ARTEN: NewsArt[] = ['neu', 'angekuendigt', 'verspaetet', 'kino', 'disc', 'folgen']

/*
  **Nur die ersten zehn Zeichen sind das Datum.** Manche Meldungen tragen einen
  vollen Zeitstempel („2026-08-30T15:00:00.000Z"); das Zerlegen an „-" machte
  daraus „30T15:00:00.000Z.08.2026" in der Tagesüberschrift und in „kam am …"
  (Daniel, 15.09.2026: „wieso so ein komisches datum format?").
*/
function datumKurz(iso: string): string {
  const [j, m, t] = iso.slice(0, 10).split('-')
  return `${t}.${m}.${j}`
}

/*
  **Wie lange ein Film zurück noch mitläuft.** Ohne belegten letzten Spieltag
  (`cinemaUntil`, aus dem Kinoprogramm) wissen wir nicht, ob er noch läuft. Vier
  Wochen nach dem Start deckt die übliche Auswertung ab; die Karte nennt dann den
  Start, nicht „läuft noch".
*/
const KINO_RUECKBLICK_TAGE = 28

/**
 * **Karussell für Kinofilme, die gerade laufen oder bald starten** (Daniel,
 * 17.09.2026: „füg oben bei news ein karussel hinzu für aktuell laufende und
 * kommende kinofilme").
 *
 * Quelle sind die Kino-Releases des Datensatzes. Laufende stehen vorn, dann die
 * kommenden nach Starttermin. Eine Karte öffnet das Detail-Panel.
 */
function KinoKarussell({
  data,
  oeffne,
}: {
  data: Dataset
  oeffne: (titelId: number) => void
}): React.JSX.Element | null {
  const { t } = useLang()
  const leiste = useRef<HTMLUListElement>(null)
  const heute = todayIso()
  const filme = useMemo(() => {
    const ab = addDays(heute, -KINO_RUECKBLICK_TAGE)
    const jeTitel = new Map<number, { titelId: number; start: string; bis?: string }>()
    for (const r of data.releases) {
      if (r.platform !== 'kino') continue
      const start = r.schedule?.firstEpisodeDate
      if (!start) continue
      if (r.cinemaUntil ? r.cinemaUntil < heute : start < ab) continue
      const bisher = jeTitel.get(r.titleId)
      /* Mehrere Kinotermine eines Titels: ein laufender vor einem kommenden, sonst der nähere. */
      if (bisher) {
        const lief = bisher.start < heute
        const laeuft = start < heute
        const besser = laeuft !== lief ? laeuft : laeuft ? start > bisher.start : start < bisher.start
        if (!besser) continue
      }
      jeTitel.set(r.titleId, { titelId: r.titleId, start, bis: r.cinemaUntil })
    }
    const laufend = [...jeTitel.values()].filter((f) => f.start < heute).sort((a, b) => b.start.localeCompare(a.start))
    const kommend = [...jeTitel.values()].filter((f) => f.start >= heute).sort((a, b) => a.start.localeCompare(b.start))
    return [...laufend, ...kommend].filter((f) => data.titleById.has(f.titelId))
  }, [data, heute])

  if (!filme.length) return null

  const blaettern = (richtung: 1 | -1) => {
    const el = leiste.current
    if (el) el.scrollBy({ left: richtung * el.clientWidth * 0.8, behavior: 'smooth' })
  }
  /* Ohne Jahr, solange es das laufende ist — „ab 26.01." im Januar 2027 wäre sonst mehrdeutig. */
  const kurz = (iso: string) => (iso.slice(0, 4) === heute.slice(0, 4) ? datumKurz(iso).slice(0, 6) : datumKurz(iso))

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('news.kino.titel')}
        </h3>
        <div className="hidden gap-1 sm:flex">
          <button
            type="button"
            onClick={() => blaettern(-1)}
            aria-label={t('news.kino.zurueck')}
            className="rounded border border-slate-300 px-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => blaettern(1)}
            aria-label={t('news.kino.weiter')}
            className="rounded border border-slate-300 px-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ›
          </button>
        </div>
      </div>
      <ul ref={leiste} data-kino="" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {filme.map((f) => {
          const titel = data.titleById.get(f.titelId)!
          const name = titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? ''
          const kommt = f.start >= heute
          /* Eine Einzelvorstellung (letzter Spieltag = Start) läuft „am", nicht „ab" (Your Name, CineAnime). */
          const zeile = kommt
            ? t(f.bis === f.start ? 'news.kino.am' : 'news.kino.ab', { d: kurz(f.start) })
            : f.bis
              ? t('news.kino.bis', { d: kurz(f.bis) })
              : t('news.kino.start', { d: kurz(f.start) })
          return (
            <li key={f.titelId} className="w-28 shrink-0 snap-start">
              <button
                type="button"
                onClick={() => oeffne(f.titelId)}
                className="group flex w-full flex-col gap-1 text-left"
              >
                <span className="relative block aspect-[2/3] w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                  {titel.coverImage && (
                    <img
                      src={titel.coverImage}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  <span
                    className={`absolute left-1 top-1 rounded px-1 py-px text-[10px] font-semibold ${
                      kommt ? 'bg-slate-900/80 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {zeile}
                  </span>
                </span>
                <span className="line-clamp-2 text-xs font-medium text-slate-800 group-hover:underline dark:text-slate-100">
                  {name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function NewsView({ data, oeffne }: { data: Dataset; oeffne: (titelId: number) => void }): React.JSX.Element {
  const { t } = useLang()
  const [meldungen, setMeldungen] = useState<NewsEintrag[] | null>(null)
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<NewsArt | null>(null)
  /*
    **Vorn stehen die letzten 14 Tage, Älteres auf Knopfdruck** (Daniel,
    15.09.2026: „news seite auf letzte 14 tage beschränken und für ältere news
    einen button ‚ältere News' anbieten"). Die Filterzähler zählen, was gerade
    gezeigt wird — sonst stünde „Disc 12" über einer Liste mit drei.
  */
  const [aeltereZeigen, setAeltereZeigen] = useState(false)
  const grenze = addDays(todayIso(), -14)

  useEffect(() => {
    let abgebrochen = false
    void loadNews().then((liste) => {
      if (!abgebrochen) setMeldungen(liste)
    })
    return () => {
      abgebrochen = true
    }
  }, [])

  const sichtbar = useMemo(
    () => (aeltereZeigen ? (meldungen ?? []) : (meldungen ?? []).filter((e) => e.am >= grenze)),
    [meldungen, aeltereZeigen, grenze],
  )
  const aeltereGibtEs = !aeltereZeigen && (meldungen ?? []).some((e) => e.am < grenze)

  /* Wie oft jede Art vorkommt — die Filterleiste zeigt nur, was es gibt. */
  const jeArt = useMemo(() => {
    const zahl = new Map<NewsArt, number>()
    for (const e of sichtbar) for (const m of e.meldungen) zahl.set(m.art, (zahl.get(m.art) ?? 0) + 1)
    return zahl
  }, [sichtbar])

  const tage = useMemo(() => {
    const jeTag = new Map<string, NewsEintrag[]>()
    for (const e of sichtbar) {
      if (filter && !e.meldungen.some((m) => m.art === filter)) continue
      /* Gruppiert wird nach dem Tag, nicht nach dem Zeitstempel — sonst bekäme jede Uhrzeit ihre eigene Überschrift. */
      const tag = e.am.slice(0, 10)
      const liste = jeTag.get(tag) ?? []
      liste.push(e)
      jeTag.set(tag, liste)
    }
    return [...jeTag.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [sichtbar, filter])

  const anbieterName = (m: NewsMeldung): string =>
    m.platform ? (PLATFORMS[m.platform as PlatformId]?.name ?? m.platform) : (m.anbieter ?? '')

  /** Die Kurzform für die Übersichtszeile — Stichworte, kein Satz. */
  const kurz = (m: NewsMeldung): string => {
    const anbieter = anbieterName(m)
    const datum = m.datum ? datumKurz(m.datum) : ''
    switch (m.art) {
      case 'neu':
        return anbieter ? t('news.kurz.neu', { anbieter }) : t('news.art.neu')
      case 'folgen':
        return m.bis !== undefined && m.bis !== m.von
          ? t('news.kurz.folgen', { von: m.von ?? '', bis: m.bis, anbieter })
          : t('news.kurz.folge', { von: m.von ?? '', anbieter })
      case 'angekuendigt':
        return t('news.kurz.angekuendigt', { datum, anbieter })
      case 'disc':
        return t('news.kurz.disc', { datum })
      case 'kino':
        return t('news.kurz.kino', { datum })
      case 'verspaetet':
        return m.nachgereichtAm
          ? t('news.kurz.nachgereicht', { von: m.von ?? '', datum: datumKurz(m.nachgereichtAm) })
          : t('news.kurz.verspaetet', { von: m.von ?? '', datum })
    }
  }

  /** Der ausführliche Satz — steht nur im aufgeklappten Bereich. */
  const satz = (m: NewsMeldung): string => {
    const anbieter = anbieterName(m)
    const datum = m.datum ? datumKurz(m.datum) : ''
    switch (m.art) {
      case 'neu':
        return anbieter ? t('news.neu', { anbieter }) : t('news.neuOhne')
      case 'folgen':
        return m.von === m.bis || m.bis === undefined
          ? t('news.folge', { von: m.von ?? '', anbieter })
          : t('news.folgen', { von: m.von ?? '', bis: m.bis, anbieter })
      case 'angekuendigt':
        return t('news.angekuendigt', { datum, anbieter })
      case 'disc':
        return t('news.disc', { datum })
      case 'kino':
        return t('news.kino', { datum })
      case 'verspaetet':
        return m.nachgereichtAm
          ? t('news.nachgereicht', { von: m.von ?? '', datum: datumKurz(m.nachgereichtAm) })
          : t('news.verspaetet', { von: m.von ?? '', datum })
    }
  }

  const tagName = (iso: string): string =>
    iso === todayIso() ? t('news.heute') : iso === addDays(todayIso(), -1) ? t('news.gestern') : datumKurz(iso)

  const schluessel = (e: NewsEintrag): string => `${e.am}|${e.titelId}`

  const umschalten = (e: NewsEintrag): void => {
    /*
      **Eine einzelne Meldung öffnet den Teil, zu dem sie gehört.**

      Der Klick führte auf den Reihenkopf — und im Panel stand die Meldung dann
      nirgends. Für „Mononoke" bündelt die Zeile auf „The Phantom in the Rain",
      der Termin am 29.09.2026 gehört aber zu „Chapter III"; wer klickte,
      landete bei einem Titel ohne diesen Termin (Daniel, 12.09.2026: „alle news
      einträge öffnen aktuell nur das jeweilige panel, aber wo genau steht diese
      info … Alle Infos in News müssen ja eig auch im panel sichtbar sein").

      Die aufgeklappten Zeilen konnten das längst (`m.teilId ?? e.titelId`) —
      nur die Kopfzeile nicht.

      **Bei mehreren Meldungen bleibt es beim Aufklappen.** Sie können zu
      verschiedenen Teilen gehören; einen davon zu wählen wäre geraten.
    */
    if (e.meldungen.length < 2) {
      oeffne(e.meldungen[0]?.teilId ?? e.titelId)
      return
    }
    setOffen((alt) => {
      const neu = new Set(alt)
      const k = schluessel(e)
      if (!neu.delete(k)) neu.add(k)
      return neu
    })
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-3 py-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">{t('news.titel')}</h2>
      <KinoKarussell data={data} oeffne={oeffne} />

      {/* Filterleiste: nur Arten, die wirklich vorkommen — ein leerer Filter ist eine Sackgasse. */}
      {meldungen && meldungen.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              filter === null
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {t('news.alle')}
          </button>
          {ARTEN.filter((a) => jeArt.get(a)).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setFilter(filter === a ? null : a)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                filter === a ? 'ring-2 ring-slate-400 dark:ring-slate-500' : 'hover:brightness-95'
              } ${FARBE[a]}`}
            >
              {t(`news.art.${a}`)} <span className="tabular-nums opacity-70">{jeArt.get(a)}</span>
            </button>
          ))}
        </div>
      )}

      {meldungen && !tage.length && <p className="text-sm text-slate-500 dark:text-slate-400">{t('news.leer')}</p>}

      {tage.map(([tag, liste]) => (
        <div key={tag} className="mb-4">
          <h3 className="sticky top-0 z-10 bg-slate-50/90 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-950/90 dark:text-slate-400">
            {tagName(tag)} <span className="font-normal normal-case opacity-60">· {liste.length}</span>
          </h3>
          {/*
            **Drei Zeilen je Eintrag, zwei Einträge nebeneinander** (Daniel,
            15.09.2026, mit Bild: „platz reicht kaum für diese news zeile - news
            3-zeilig machen. dann sollten auch 2 news nebeneinander passen").
            Titel, Teil und Kurzform standen in einer Zeile, und der Teil
            („Mononoke – The Movie: Chapter III – Der Fluch der Schlange")
            drückte den Titel zusammen. Jetzt hat jede Angabe ihre Zeile, die Chips
            stehen neben der Kurzform.
          */}
          <ul className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {liste.map((e) => {
              const auf = offen.has(schluessel(e))
              const sortiert = [...e.meldungen].sort((a, b) => ARTEN.indexOf(a.art) - ARTEN.indexOf(b.art))
              const erste = sortiert[0]!
              /* Ein Chip je Art, mit Zähler erst ab zwei — „Disc 1" sagt nichts. */
              const arten = ARTEN.map((a) => [a, sortiert.filter((m) => m.art === a).length] as const).filter(
                ([, n]) => n > 0,
              )
              return (
                <li key={schluessel(e)} className="min-w-0 border-b border-slate-100 dark:border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => umschalten(e)}
                    aria-expanded={e.meldungen.length > 1 ? auf : undefined}
                    className="flex w-full items-center gap-2.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  >
                    {e.cover ? (
                      <img src={e.cover} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="h-14 w-10 shrink-0 rounded bg-slate-200 dark:bg-slate-800" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {/* Zeile 1: der Titel, allein — er ist, wonach man die Liste überfliegt. */}
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{e.titel}</span>
                      {/*
                        Zeile 2: der Teil, falls die Meldung einen bestimmten meint.

                        **Der Teil steht am Titel, nicht hinter dem Anbieter.** „bei
                        Crunchyroll · Lord of Mysteries Specials" las sich wie eine
                        Fußnote zum Anbieter — die Meldung betrifft aber genau diesen
                        Teil und **nicht** die Hauptserie (Daniel, 12.09.2026). Ohne
                        Teil steht hier die Kurzform.
                      */}
                      {/* Heißt der Teil wie die Zeile darüber, sagt er nichts Neues (15.09.2026, Bildprüfung). */}
                      {/*
                        **`max-w-full` neben `self-start`, sonst schneidet `truncate` nichts ab.**

                        In einer Flex-Spalte heißt `self-start` „so breit wie dein Inhalt" — die
                        Plakette wuchs damit auf 474 px in einem 375 px breiten Fenster, und die
                        News-Seite bekam auf dem Handy 177 px Überbreite (gemessen 16.09.2026,
                        `check:ansichten --handy` war rot). `min-w-0` allein hilft nicht: Es senkt
                        die Untergrenze, nicht die Obergrenze.
                      */}
                      {erste.teil && erste.teil !== e.titel ? (
                        <span className="min-w-0 max-w-full self-start truncate rounded border border-slate-300 px-1 py-px text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
                          {erste.teil}
                        </span>
                      ) : (
                        <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {kurz(erste)}
                          {e.meldungen.length > 1 && (
                            <span className="opacity-70"> · {t('news.weitere', { n: e.meldungen.length - 1 })}</span>
                          )}
                        </span>
                      )}
                      {/* Zeile 3: die Arten als Chips, mit Teil davor die Kurzform. */}
                      <span className="flex min-w-0 items-center gap-1">
                        {arten.map(([a, n]) => (
                          <span key={a} className={`shrink-0 rounded px-1.5 py-px text-[11px] ${FARBE[a]}`}>
                            {t(`news.art.${a}`)}
                            {n > 1 && <span className="ml-1 tabular-nums opacity-70">{n}</span>}
                          </span>
                        ))}
                        {erste.teil && erste.teil !== e.titel && (
                          <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                            {kurz(erste)}
                            {e.meldungen.length > 1 && (
                              <span className="opacity-70"> · {t('news.weitere', { n: e.meldungen.length - 1 })}</span>
                            )}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 pr-1 text-slate-400 transition-transform ${auf ? 'rotate-90' : ''} ${
                        e.meldungen.length > 1 ? '' : 'opacity-40'
                      }`}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>

                  {auf && (
                    <ul className="mb-1.5 ml-10 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
                      {sortiert.map((m, i) => (
                        <li key={`${m.art}-${m.datum ?? ''}-${m.von ?? ''}-${i}`}>
                          <button
                            type="button"
                            onClick={() => oeffne(m.teilId ?? e.titelId)}
                            className="flex w-full items-center gap-2 rounded py-1 pr-1 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60"
                          >
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${FARBE[m.art]}`}>
                              {t(`news.art.${m.art}`)}
                            </span>
                            {m.teil && m.teil !== e.titel && (
                              <span className="min-w-0 shrink truncate rounded border border-slate-300 px-1 py-px text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
                                {m.teil}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                              {satz(m)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {aeltereGibtEs && (
        <button
          type="button"
          onClick={() => setAeltereZeigen(true)}
          className="mt-1 w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900/60"
        >
          {t('news.aeltere')}
        </button>
      )}
    </section>
  )
}
