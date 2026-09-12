import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type NewsArt, type NewsEintrag, type NewsMeldung, type PlatformId } from '@shared/types.ts'
import { loadNews } from '../lib/data.ts'
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

function datumKurz(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

export function NewsView({ oeffne }: { oeffne: (titelId: number) => void }): React.JSX.Element {
  const { t } = useLang()
  const [meldungen, setMeldungen] = useState<NewsEintrag[] | null>(null)
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<NewsArt | null>(null)

  useEffect(() => {
    let abgebrochen = false
    void loadNews().then((liste) => {
      if (!abgebrochen) setMeldungen(liste)
    })
    return () => {
      abgebrochen = true
    }
  }, [])

  /* Wie oft jede Art insgesamt vorkommt — die Filterleiste zeigt nur, was es gibt. */
  const jeArt = useMemo(() => {
    const zahl = new Map<NewsArt, number>()
    for (const e of meldungen ?? []) for (const m of e.meldungen) zahl.set(m.art, (zahl.get(m.art) ?? 0) + 1)
    return zahl
  }, [meldungen])

  const tage = useMemo(() => {
    const jeTag = new Map<string, NewsEintrag[]>()
    for (const e of meldungen ?? []) {
      if (filter && !e.meldungen.some((m) => m.art === filter)) continue
      const liste = jeTag.get(e.am) ?? []
      liste.push(e)
      jeTag.set(e.am, liste)
    }
    return [...jeTag.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [meldungen, filter])

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
    /* Eine einzelne Meldung hat nichts aufzuklappen — dann führt der Klick zum Titel. */
    if (e.meldungen.length < 2) {
      oeffne(e.titelId)
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
    <section className="mx-auto w-full max-w-3xl px-3 py-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">{t('news.titel')}</h2>

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
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/70">
            {liste.map((e) => {
              const auf = offen.has(schluessel(e))
              const sortiert = [...e.meldungen].sort((a, b) => ARTEN.indexOf(a.art) - ARTEN.indexOf(b.art))
              const erste = sortiert[0]!
              /* Ein Chip je Art, mit Zähler erst ab zwei — „Disc 1" sagt nichts. */
              const arten = ARTEN.map((a) => [a, sortiert.filter((m) => m.art === a).length] as const).filter(
                ([, n]) => n > 0,
              )
              return (
                <li key={schluessel(e)}>
                  <button
                    type="button"
                    onClick={() => umschalten(e)}
                    aria-expanded={e.meldungen.length > 1 ? auf : undefined}
                    className="flex w-full items-center gap-2.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  >
                    {e.cover ? (
                      <img src={e.cover} alt="" loading="lazy" className="h-11 w-8 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="h-11 w-8 shrink-0 rounded bg-slate-200 dark:bg-slate-800" />
                    )}
                    <span className="min-w-0 flex-1">
                      {/*
                        **Der Teil steht am Titel, nicht hinter dem Anbieter.**

                        „bei Crunchyroll · Lord of Mysteries Specials" las sich
                        wie eine Fußnote zum Anbieter — die Meldung betrifft aber
                        genau diesen Teil und **nicht** die Hauptserie (Daniel,
                        12.09.2026). Ein Rahmen am Titel beantwortet die Frage
                        beim Überfliegen; blasse Schrift am Zeilenende tut es
                        nicht.
                      */}
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {e.titel}
                        </span>
                        {erste.teil && (
                          <span className="min-w-0 shrink truncate rounded border border-slate-300 px-1 py-px text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
                            {erste.teil}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {kurz(erste)}
                        {e.meldungen.length > 1 && (
                          <span className="opacity-70"> · {t('news.weitere', { n: e.meldungen.length - 1 })}</span>
                        )}
                      </span>
                    </span>
                    {/*
                      Auf einem schmalen Schirm ist nur für **einen** Chip Platz — dann steht
                      dort die wichtigste Art und daneben, wie viele weitere es gibt. Die Chips
                      ganz auszublenden hieße, auf dem Handy die Art zu verschweigen, und genau
                      die beantwortet die Frage „muss ich hinsehen".
                    */}
                    <span className="flex shrink-0 items-center gap-1">
                      {arten.map(([a, n], i) => (
                        <span
                          key={a}
                          className={`rounded px-1.5 py-0.5 text-[11px] ${i > 0 ? 'hidden sm:inline' : ''} ${FARBE[a]}`}
                        >
                          {t(`news.art.${a}`)}
                          {n > 1 && <span className="ml-1 tabular-nums opacity-70">{n}</span>}
                        </span>
                      ))}
                      {arten.length > 1 && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-500 sm:hidden dark:bg-slate-800 dark:text-slate-400">
                          +{arten.length - 1}
                        </span>
                      )}
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
                            {m.teil && (
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
    </section>
  )
}
