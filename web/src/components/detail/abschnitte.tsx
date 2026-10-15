import { Meldungen } from './vermerk.tsx'
import { type Release, type Title } from '@shared/types.ts'
import { Aufklappbar } from './aufklapp-kopf.tsx'
import { BuchZeichen, PanelKarte } from './panel-karte.tsx'
import { PLOT_PREVIEW } from './hilfen.tsx'
import type { Translate } from '../../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'
import { Chip } from '../ui.tsx'
import { HerkunftZeile, zeigtHerkunft } from './herkunft-zeile.tsx'
import { EigeneQuellenZeile, ReiheHinweis } from './handlung-quelle.tsx'
import { type plotVon } from './plot.ts'

export function EckdatenAbschnitt({ title, t, genresOffen, onFilterBy, tGenre, setGenresOffen }: {
  title: Title
  t: Translate
  genresOffen: boolean
  onFilterBy: (kind: 'genre' | 'keyword', value: string) => void
  tGenre: (name: string) => string
  setGenresOffen: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <>
      {(title.genres.length > 0 || zeigtHerkunft(title)) && (
        <Aufklappbar titel={t('detail.werkangaben')}>
          {zeigtHerkunft(title) && <HerkunftZeile title={title} t={t} />}
          <div className="flex flex-wrap gap-2">
              {(genresOffen ? title.genres : title.genres.slice(0, 3)).map((g) => (
                <Chip gross key={g} onClick={() => onFilterBy('genre', g)}>
                  {tGenre(g)}
                </Chip>
              ))}
              {!genresOffen && title.genres.length > 3 && (
                <button
                  type="button"
                  onClick={() => setGenresOffen(true)}
                  className="min-h-11 min-w-11 cursor-pointer rounded-full px-3 text-t3 text-ak-leise transition hover:text-ak-text"
                >
                  +{title.genres.length - 3}
                </button>
              )}
          </div>
        </Aufklappbar>
      )}
    </>
  )
}

/** Anbietername wie auf der Quelle selbst: aus der Adresse („anisearch.de") wird „aniSearch". */
const quelleLabel = (name: string): string => (name === 'anisearch.de' ? 'aniSearch' : name === 'anilist.co' ? 'AniList' : name)

export function HandlungAbschnitt({ plot, t, plotOffen, setPlotOffen }: {
  plot: ReturnType<typeof plotVon>['plot']
  t: Translate
  plotOffen: boolean
  setPlotOffen: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <>
      {plot && (
        <PanelKarte symbol={<BuchZeichen />} titel={t('detail.plot')} akzent="akzent">
          {/*
            **Der Hinweis steht über dem Text, nicht darunter.**

            Er ändert, wie der Absatz zu lesen ist — wer ihn erst am Ende
            findet, hat die Handlung schon dem falschen Titel zugeschrieben.
          */}
          {plot.vonTeil && (
            <p className="mb-1 text-t4 text-ak-warnung-text">
              {t(plot.erschienen ? 'detail.plotVonTeilFrueher' : 'detail.plotVonTeil', { teil: plot.vonTeil.name })}
            </p>
          )}
          {plot.eigen?.reihe && !plot.vonTeil && <ReiheHinweis t={t} />}
          {/*
            Zuerst zwei Sätze, den Rest auf Wunsch.

            Eine Inhaltsangabe von tausend Zeichen schob alles darunter aus
            dem Bild — die deutschen Stimmen, die Keywords, die
            Quellenangabe. Wer die Handlung lesen will, klickt; wer sie nur
            einordnen will, sieht den Anfang und bleibt im Überblick.
          */}
          <p className="whitespace-pre-line text-t3 text-ak-text/85">
            {plotOffen || plot.text.length <= PLOT_PREVIEW
              ? plot.text
              : `${plot.text.slice(0, PLOT_PREVIEW).trimEnd()} …`}
          </p>
          {plot.fallback && (
            <p className="mt-1.5 text-t5 text-slate-400">{t('detail.plotOnlyEnglish')}</p>
          )}
          {/* Die Quelle steht immer sichtbar am Fuß der Karte, auch eingeklappt (aniSearch verlangt Nennung und Link bei übernommenen Texten, 05.10.2026). */}
          <div className="mt-2 flex items-center justify-between gap-2">
            {plot.text.length > PLOT_PREVIEW ? (
              <button
                type="button"
                onClick={() => setPlotOffen((v) => !v)}
                aria-expanded={plotOffen}
                className="min-h-11 cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche-2 px-4 text-t3 font-semibold text-ak-text transition hover:border-ak-leise"
              >
                {t(plotOffen ? 'detail.plotLess' : 'detail.plotMore')}
              </button>
            ) : (
              <span />
            )}
            {plot.eigen ? (
              <EigeneQuellenZeile eigen={plot.eigen} t={t} />
            ) : (
              <span className="text-t4 text-slate-600 dark:text-slate-400">
                {t('detail.plotQuelle')}{' '}
                <a href={plot.quelle.url} target="_blank" rel="noopener noreferrer" className="-my-3 inline-flex min-h-11 items-center underline decoration-slate-400/50 underline-offset-2 hover:text-ak-text">
                  {quelleLabel(plot.quelle.name)} ↗
                </a>
              </span>
            )}
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
