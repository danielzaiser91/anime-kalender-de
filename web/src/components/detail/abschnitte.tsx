import { Meldungen } from './vermerk.tsx'
import { type Release, type Title } from '@shared/types.ts'
import { SectionTitle } from '../ui.tsx'
import { BuchZeichen, PanelKarte } from './panel-karte.tsx'
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

/** Anbietername wie auf der Quelle selbst: aus der Adresse („anisearch.de") wird „aniSearch". */
const quelleLabel = (name: string): string => (name === 'anisearch.de' ? 'aniSearch' : name === 'anilist.co' ? 'AniList' : name)

export function HandlungAbschnitt({ plot, t, plotOffen, setPlotOffen }: {
  plot: { text: string; fallback: boolean; quelle: { name: string; url: string; }; vonTeil?: undefined; } | { text: string; fallback: boolean; vonTeil: FranchiseMember; quelle: { name: string; url: string; }; } | undefined
  t: Translate
  plotOffen: boolean
  setPlotOffen: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <>
      {plot && (
        <PanelKarte symbol={<BuchZeichen />} titel={t('detail.plot')} akzent="amber">
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
            einordnen will, sieht den Anfang und bleibt im Überblick.
          */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-ak-text/85">
            {plotOffen || plot.text.length <= PLOT_PREVIEW
              ? plot.text
              : `${plot.text.slice(0, PLOT_PREVIEW).trimEnd()} …`}
          </p>
          {plot.fallback && (
            <p className="mt-1.5 text-[11px] text-slate-400">{t('detail.plotOnlyEnglish')}</p>
          )}
          {/* Die Quelle steht immer sichtbar am Fuß der Karte, auch eingeklappt (aniSearch verlangt Nennung und Link bei übernommenen Texten, 05.10.2026). */}
          <div className="mt-2 flex items-center justify-between gap-2">
            {plot.text.length > PLOT_PREVIEW ? (
              <button
                type="button"
                onClick={() => setPlotOffen((v) => !v)}
                aria-expanded={plotOffen}
                className="cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche-2 px-3 py-1 text-xs font-semibold text-ak-text transition hover:border-ak-akzent hover:text-ak-akzent-text"
              >
                {t(plotOffen ? 'detail.plotLess' : 'detail.plotMore')}
              </button>
            ) : (
              <span />
            )}
            <span className="text-[11px] text-slate-400">
              {t('detail.plotQuelle')}{' '}
              <a href={plot.quelle.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-400/50 underline-offset-2 hover:text-ak-akzent-text">
                {quelleLabel(plot.quelle.name)} ↗
              </a>
            </span>
          </div>
        </PanelKarte>
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
          derselben Stelle wie sonst auch.
        */
        /*
          **Hier stand der Bereich „Release-Termine für deutsche Synchro".**

          Er ist am 16.09.2026 ersatzlos entfallen. Wohin seine drei
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
