/** Bausteine der News-Seite: Eintragszeile mit aufklappbaren Meldungen und die Filterknöpfe je Art. */
import { type NewsMeldung } from '@shared/types.ts'
import { istLink, hostVon } from '@shared/quelle.ts'
import { QuellenKnopf } from './beleg-dialog.tsx'
import { type NewsArt } from '@shared/types.ts'
import { type Stand } from '../lib/news-verlauf.ts'
import { NEWS_FARBE } from './news-farben.ts'
import { artLabel, newsSatz } from '../lib/news-text.ts'
import { AbgeloestHinweis } from './news-abgeloest.tsx'
import { NachtragText } from './news-nachtrag.tsx'
import { Klapptext } from './klapptext.tsx'
import { VerlaufZeilen } from './news-verlauf.tsx'
import type { Dispatch, SetStateAction } from 'react'
import type { Translate } from '../lib/i18n.tsx'
import { NewsCover } from './news-kachel.tsx'
import { newsKurz } from '../lib/news-text.ts'
import { type NewsEintrag } from '@shared/types.ts'
import type { Verlaeufe } from '../lib/news-verlauf.ts'

export function NewsEintragInhalt({ umschalten, e, auf, erste, t, arten, sortiert, oeffne, verlaeufe }: {
  umschalten: (e: NewsEintrag) => void
  e: NewsEintrag
  auf: boolean
  erste: NewsMeldung
  t: Translate
  arten: (readonly [NewsArt, number])[]
  sortiert: NewsMeldung[]
  oeffne: (titelId: number) => void
  verlaeufe: Verlaeufe
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => umschalten(e)}
        aria-expanded={e.meldungen.length > 1 ? auf : undefined}
        className="flex w-full items-center gap-2.5 py-1.5 text-left hover:bg-ak-flaeche-2"
      >
        <NewsCover e={e} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Zeile 1: der Titel, allein — er ist, wonach man die Liste überfliegt. */}
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{e.titel}</span>
          {/*
            Zeile 2: der Teil, falls die Meldung einen bestimmten meint.

            **Der Teil steht am Titel, nicht hinter dem Anbieter.** „bei
            Crunchyroll · Lord of Mysteries Specials" las sich wie eine
            Fußnote zum Anbieter — die Meldung betrifft aber genau diesen
            Teil und **nicht** die Hauptserie. Ohne
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
              {newsKurz(erste)}
              {e.meldungen.length > 1 && (
                <span> · {t('news.weitere', { n: e.meldungen.length - 1 })}</span>
              )}
            </span>
          )}
          {/* Zeile 3: die Arten als Chips, mit Teil davor die Kurzform. */}
          <span className="flex min-w-0 items-center gap-1">
            {arten.map(([a, n]) => (
              <span key={a} className={`shrink-0 rounded px-1.5 py-px text-[11px] ${NEWS_FARBE[a]}`}>
                {t(`news.art.${a}`)}
                {n > 1 && <span className="ml-1 tabular-nums">{n}</span>}
              </span>
            ))}
            {erste.teil && erste.teil !== e.titel && (
              <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                {newsKurz(erste)}
                {e.meldungen.length > 1 && (
                  <span> · {t('news.weitere', { n: e.meldungen.length - 1 })}</span>
                )}
              </span>
            )}
          </span>
        </span>
        <span
          className={`shrink-0 pr-1 text-slate-400 transition-transform ${auf ? 'rotate-90' : ''} ${
            e.meldungen.length > 1 ? '' : 'opacity-45'
          }`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      {auf && (
        <ul className="mb-1.5 ml-10 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          {sortiert.map((m, i) => (
            <MeldungZeile
              key={`${m.art}-${m.datum ?? ''}-${m.von ?? ''}-${i}`}
              m={m}
              reihe={e.titel}
              am={e.am}
              oeffne={() => oeffne(m.teilId ?? e.titelId)}
              staende={verlaeufe.vorgaenger.get(m)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

export function NewsFilterKnoepfe({ setFilter, filter, t, jeArt }: {
  setFilter: Dispatch<SetStateAction<NewsArt | null>>
  filter: NewsArt | null
  t: Translate
  jeArt: Map<NewsArt, number>
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => setFilter(null)}
        aria-pressed={filter === null}
        className={`ak-tz shrink-0 rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition ${
          filter === null
            ? GEWAEHLT
            : 'bg-ak-flaeche-2 text-ak-leise hover:text-ak-text'
        }`}
      >
        {t('news.alle')}
      </button>
      {ARTEN.filter((a) => jeArt.get(a)).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => setFilter(filter === a ? null : a)}
          aria-pressed={filter === a}
          className={`ak-tz shrink-0 rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition ${
            filter === a ? GEWAEHLT : `hover:ring-1 hover:ring-inset hover:ring-ak-leise ${NEWS_FARBE[a]}`
          }`}
        >
          {t(`news.art.${a}`)} <span className="tabular-nums">{jeArt.get(a)}</span>
        </button>
      ))}
    </>
  )
}

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
/** Gewählter Filter (eins von n), einheitlich mit Reitern und Segmenten (design-regeln.md). */
const GEWAEHLT = 'bg-ak-gewaehlt font-bold text-ak-auf-gewaehlt'

/**
 * Die Reihenfolge ist **fest**, nicht nach Häufigkeit — sonst springen die
 * Chips von Tag zu Tag an eine andere Stelle, und das Auge findet nichts
 * wieder. Sie ist zugleich die Rangfolge: Was hier vorn steht, formuliert die
 * Satzzeile der Übersicht.
 */
export const ARTEN = ['neu', 'angekuendigt', 'nachgetragen', 'verspaetet', 'nachgereicht', 'rhythmus', 'takt', 'offiziell', 'kino', 'disc', 'folgen'] as const satisfies readonly NewsArt[]

/* Fehlt eine `NewsArt` in `ARTEN`, ist diese Zuweisung ein Typfehler (sonst ohne Chip und mit Rang -1). */
export const _artenVollstaendig: Exclude<NewsArt, (typeof ARTEN)[number]> extends never ? true : never = true

/**
 * **Eine Meldungszeile** — Art-Pille, Teil-Nennung, Satz und Quelle (29.09.2026 herausgelöst: Die
 * Quellenangabe ließ die Listenfunktion über die Längengrenze wachsen).
 *
 * Die Quelle steht **neben** dem Knopf, nicht darin: Der Knopf öffnet das Detail-Panel, ein Link in
 * ihm wäre ungültiges HTML und ein zweites Ziel im selben Klick.
 */
function MeldungZeile({
  m,
  reihe,
  am,
  oeffne,
  staende,
}: {
  m: NewsMeldung
  reihe: string
  /** Tag des Eintrags — der Satz nennt damit das ältere Quelldatum. */
  am: string
  oeffne: () => void
  staende?: Stand[]
}) {
  return (
    <li>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={oeffne}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 rounded py-1 pr-1 text-left hover:bg-ak-flaeche-2"
        >
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${NEWS_FARBE[m.art]}`}>
            {artLabel(m)}
          </span>
          {m.teil && m.teil !== reihe && (
            <span className="min-w-0 shrink truncate rounded border border-slate-300 px-1 py-px text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
              {m.teil}
            </span>
          )}
          <span
            className={`min-w-0 flex-1 basis-40 text-xs ${
              m.ersetzt || m.zurueckgezogen
                ? 'text-slate-400 line-through dark:text-slate-500'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {newsSatz(m, am)}
          </span>
        </button>
        <AbgeloestHinweis m={m} />
        {/* Eine geschätzte Meldung zeigt keine Quelle — die Seite dahinter nennt den Termin nicht. */}
        {!m.geschaetzt && <QuelleKurz m={m} />}
      </div>
      {/* Der Vermerk erscheint **beim Aufklappen** unter der Meldung — in der Übersicht bleibt der
          Satz kurz. */}
      {m.hinweis && <p className="pb-1 pl-2 pr-2 text-[10px] text-slate-400 dark:text-slate-500">{m.abschnitte?.length ? <NachtragText kurz={m.hinweis} abschnitte={m.abschnitte} /> : <Klapptext text={m.hinweis} />}</p>}
      {staende && <VerlaufZeilen staende={staende} />}
    </li>
  )
}

/**
 * Die Quellen in der einzeiligen Liste: ein Knopf, der das Beleg-Fenster mit allen Quellen öffnet (Hostnamen füllten die Zeile).
 */
function QuelleKurz({ m }: { m: NewsMeldung }) {
  const belege = m.belege?.length ? m.belege : istLink(m.quelle) ? [{ url: m.quelle, name: hostVon(m.quelle) }] : []
  if (!belege.length) return null
  return <QuellenKnopf belege={belege} />
}
