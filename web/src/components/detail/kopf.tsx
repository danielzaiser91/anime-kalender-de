import { TrailerKino } from './kino.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { AniSearchVerweis } from './pillen.tsx'
import { type FranchiseMember, type Title, type Release } from '@shared/types.ts'
import type { JSX } from 'react'

/** Der gewählte Teil im Klartext. */
function TeilUeberschrift({ teilName }: { teilName: string }) {
  return (
    <h3 className="pointer-events-auto mt-1 w-fit min-w-0 text-xl font-bold leading-tight text-slate-900 dark:text-white">
      {teilName}
    </h3>
  )
}

export function PanelKopf({ bewertung, reihenTeile, teilName, reihenName, title, kinoRelease, asZiel }: {
  asZiel?: string
  bewertung: JSX.Element | null
  reihenTeile: FranchiseMember[]
  teilName: string
  reihenName: string
  title: Title
  kinoRelease: Release
}) {
  return (
    <>
      {/*
        Der Block rückt ins Cover hinein (`-mt-24`), damit das Bild groß bleibt und der erste Inhalt im Blick (Daniel, 03.09.2026).
        Titel und Bedienelemente stehen auf der Bühne darüber; Format, Jahr und Studio in deren Unterzeile; Genres im Details-Bereich.
      */}
      <div className={`pointer-events-none relative flex flex-col gap-3 p-4 -mt-24`}>
        <div className="min-w-0 flex-1">
          {/*
            Eigene Zeile über dem Staffelnamen (Daniel, 03.10.2026: „titel wird stark gequetscht"): Wertung links, Trailer und
            Absprünge (aniSearch, MAL) rechts. aniSearch nur mit Kennung als Direktlink, nie als Suche (Daniel, 09.10.2026).
          */}
          <div className="pointer-events-none flex flex-wrap items-center gap-2">
            {bewertung && <span className="pointer-events-auto">{bewertung}</span>}
            <span className="pointer-events-none ml-auto flex flex-wrap items-center justify-end gap-2">
              {(title.trailer || kinoRelease) && <span className="pointer-events-auto"><TrailerKino trailer={title.trailer} titel={anzeigeName(title)} /></span>}
              <span className="pointer-events-auto"><AniSearchVerweis title={title} ziel={asZiel} /></span>
            </span>
          </div>
          {/* Die zweite Titelzeile entfällt, wenn sie nur den Reihennamen darüber wiederholt. */}
          {reihenTeile.length > 1 && teilName !== reihenName && <TeilUeberschrift teilName={teilName} />}
        </div>
      </div>
    </>
  )
}
