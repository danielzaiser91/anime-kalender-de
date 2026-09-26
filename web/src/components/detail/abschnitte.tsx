import { Meldungen } from './vermerk.tsx'
import { type Release, type Title } from '@shared/types.ts'
import { SectionTitle } from '../ui.tsx'
import { PLOT_PREVIEW } from './hilfen.tsx'
import { type FranchiseMember } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'
import { Chip } from '../ui.tsx'

export function EckdatenAbschnitt({ title, t, genresOffen, onFilterBy, tGenre, setGenresOffen, faktenImKasten }: {
  title: Title
  t: Translate
  genresOffen: boolean
  onFilterBy: (kind: 'genre' | 'keyword', value: string) => void
  tGenre: (name: string) => string
  setGenresOffen: Dispatch<SetStateAction<boolean>>
  faktenImKasten: boolean
}) {
  return (
    <>
      {(title.genres.length > 0 || title.score !== undefined || title.studios?.[0]) && (
        <div>
          <SectionTitle>{t('detail.werkangaben')}</SectionTitle>
          {title.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(genresOffen ? title.genres : title.genres.slice(0, 3)).map((g) => (
                <Chip key={g} onClick={() => onFilterBy('genre', g)}>
                  {tGenre(g)}
                </Chip>
              ))}
              {!genresOffen && title.genres.length > 3 && (
                <button
                  type="button"
                  onClick={() => setGenresOffen(true)}
                  className="cursor-pointer rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-slate-400 dark:border-white/10 dark:text-slate-400"
                >
                  +{title.genres.length - 3}
                </button>
              )}
            </div>
          )}
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {/*
              **Die Bewertung steht oben, nicht hier.**

              Beide Stellen zeigten „★ 8.8 AniList" — einmal als Pille neben
              dem Staffelnamen, einmal als Zeile hier. Gemessen am
              03.09.2026: dieselbe Zahl zweimal auf einem Bildschirm, und
              oben ist sie sichtbarer und trägt ihren Tooltip mit der
              Herkunft. Die Zeile hier war die Wiederholung.
            */}
            {!faktenImKasten && title.studios?.[0] && (
              <>
                <dt className="text-slate-400 dark:text-slate-500">{t('detail.studio')}</dt>
                <dd className="text-slate-600 dark:text-slate-300">{title.studios.join(', ')}</dd>
              </>
            )}
            {/* Die Altersfreigabe stand hier bis zum 04.09.2026 ein zweites
                Mal — sie ist jetzt ausschließlich eine Marke am Cover. */}
          </dl>
        </div>
      )}
    </>
  )
}

export function HandlungAbschnitt({ plot, t, plotOffen, setPlotOffen }: {
  plot: { text: string; fallback: boolean; quelle: { name: string; url: string; }; vonTeil?: undefined; } | { text: string; fallback: boolean; vonTeil: FranchiseMember; quelle: { name: string; url: string; }; } | undefined
  t: Translate
  plotOffen: boolean
  setPlotOffen: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <>
      {plot && (
        <div>
          <SectionTitle>{t('detail.plot')}</SectionTitle>
          {/*
            **Der Hinweis steht über dem Text, nicht darunter.**

            Er ändert, wie der Absatz zu lesen ist — wer ihn erst am Ende
            findet, hat die Handlung schon dem falschen Titel zugeschrieben.
          */}
          {plot.vonTeil && (
            <p className="mb-1 text-[11px] text-amber-600 dark:text-amber-400/90">
              {t('detail.plotVonTeil', { teil: plot.vonTeil.name })}
            </p>
          )}
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
              className="mt-1 cursor-pointer text-xs text-sky-700 dark:text-sky-300 hover:underline"
            >
              {t(plotOffen ? 'detail.plotLess' : 'detail.plotMore')}
            </button>
          )}
          {plot.fallback && (
            <p className="mt-1.5 text-[11px] text-slate-400">{t('detail.plotOnlyEnglish')}</p>
          )}
          {/*
            **Die Quelle steht unten, gesammelt — nicht unter jedem Absatz.**

            Hier stand „Quelle: anisearch.de", und dieselbe Zeile stand
            unter jedem Terminblock. Seit die Termine in den Pillen sind,
            blieb sie hier als einzige übrig — eine Fußnote unter einem
            Absatz, während zwei Handbreit tiefer der Bereich „Woher diese
            Angaben stammen" alle Quellen zusammen führt, aniSearch
            eingeschlossen (Daniel, 04.09.2026: „alle stellen wo quelle
            steht entfernen, sie sind nur noch im quellen bereich zu finden,
            gebündelt").

            Nichts geht verloren: Die Quellenübersicht führt aniSearch mit
            „Titel und Beschreibung, wo vorhanden auf Deutsch" — samt Link
            auf die Werkseite.
          */}
        </div>
      )}
    </>
  )
}

export function TermineAbschnitt({ releases, title }: {
  releases: Release[]
  title: Title
}) {
  return (
    <>
      {releases.length > 0 ? (
        /*
          **Die Termine stehen in den Pillen — hier steht nichts mehr.**

          Bis zum 04.09.2026 folgte an dieser Stelle ein Abschnitt je
          Release: Start, Folgenzahl, letzte Folge, Herkunftskasten, Quelle
          und zwei Kalender-Knöpfe. Bei „Apothekerin" Staffel 1 waren das
          zwei solche Blöcke für eine Serie, die seit April 2024 durch ist
          — und der Kasten oben sagte dasselbe in einer Zeile.

          Daniel am 04.09.2026, in drei Schritten: erst „der bereich gehört
          weg, aber der link zum disc gehört in disc bereich", dann „eig
          gehört der bereich immer weg, unabhängig ob in zukunft oder nicht.
          die titel gehören mit releasedate info in disc/stream bereich",
          schließlich „in die pill muss auch der calendar icon + eintrag".

          **Was bleibt, sind die Meldungen** — Zusatzangaben, die zu keinem
          einzelnen Termin gehören und in keine Pille passen.
        */
        <Meldungen titleId={title.id} />
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
        /*
          **Hier stand der Bereich „Release-Termine für deutsche Synchro".**

          Er ist am 16.09.2026 ersatzlos entfallen (Daniel, mit Bild: „das
          sollte doch alles hochgewandert sein in die obere box, und dann gibt
          es keinen verwendungszweck mehr für die untere"). Wohin seine drei
          Angaben gegangen sind:

          | Angabe | wohin |
          |---|---|
          | Status-Plakette („Erschienen") | der Kasten oben sagt es in Worten |
          | FSK („16") | steht als Marke am Cover, 493 der 943 Titel hatten sie zweimal |
          | „Im Angebot seit 25.07.2024 (Netflix)" | als Zeile in den Kasten, 267 Titel |
          | „Erscheinungstermin: unbekannt" | gestrichen — eine Nicht-Auskunft |
          | „Keine deutsche Synchro bekannt" samt Merken-Hinweis | der Satz stand doppelt, der Hinweis ist im Kasten |
        */
        null
      )}
    </>
  )
}
