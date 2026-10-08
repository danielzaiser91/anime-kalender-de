import { TrailerKino } from './kino.tsx'
import { anzeigeName, eindeutschenStaffel } from '@shared/titles.ts'
import { AniSearchVerweis } from './pillen.tsx'
import { sprechendeBeschriftung } from './reihen-regeln.ts'
import { useVorschau } from '../../lib/vorschau.ts'
import { type FranchiseMember, type Title, type Release } from '@shared/types.ts'
import type { JSX } from 'react'

/** Der gewählte Teil im Klartext; bei „Reihe: Name 2" („2" allein sagt nichts) mit vollem Namen, wenn die Vorschau `reihe-namen` an ist. */
function TeilUeberschrift({ teilName, title }: { teilName: string; title: Title }) {
  const voll = useVorschau('reihe-namen') === 'voll'
  return (
    <h3 className="pointer-events-auto mt-1 w-fit min-w-0 text-xl font-bold leading-tight text-slate-900 dark:text-white">
      {voll ? sprechendeBeschriftung(teilName, eindeutschenStaffel(anzeigeName(title))) : teilName}
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
  const kompakt = useVorschau('panel-kopf') === 'kompakt'
  /* Mit großen Tipp-Zielen ist die Knopfleiste höher als das kompakte Cover; der Block rückt weniger weit hinein. */
  const rueckt = useVorschau('tippziele') === 'gross' ? 'max-sm:-mt-6' : 'max-sm:-mt-12'
  return (
    <>
      {/*
        Der Block rückt ins Cover hinein (`-mt-24`), damit das Bild groß bleibt und der erste Inhalt im Blick (Daniel, 03.09.2026).
        Titel und Bedienelemente stehen auf der Bühne darüber; Format, Jahr und Studio in deren Unterzeile; Genres im Details-Bereich.
      */}
      <div className={`pointer-events-none relative flex flex-col gap-3 p-4 ${kompakt ? `-mt-24 ${rueckt}` : '-mt-24'}`}>
        <div className="min-w-0 flex-1">
          {/*
            Eigene Zeile über dem Staffelnamen (Daniel, 03.10.2026: „titel wird stark gequetscht"): Wertung links, Trailer und
            Absprünge (aniSearch, MAL) rechts. Der Verweis steht bei allen Titeln, ohne Kennung als Suche (Daniel, 07.09.2026).
          */}
          <div className="pointer-events-none flex flex-wrap items-center gap-2">
            {bewertung && <span className="pointer-events-auto">{bewertung}</span>}
            <span className="pointer-events-none ml-auto flex flex-wrap items-center justify-end gap-2">
              {(title.trailer || kinoRelease) && <span className="pointer-events-auto"><TrailerKino trailer={title.trailer} titel={anzeigeName(title)} /></span>}
              <span className="pointer-events-auto"><AniSearchVerweis title={title} ziel={asZiel} /></span>
            </span>
          </div>
          {/* Die zweite Titelzeile entfällt, wenn sie nur den Reihennamen darüber wiederholt. */}
          {reihenTeile.length > 1 && teilName !== reihenName && <TeilUeberschrift teilName={teilName} title={title} />}
        </div>
      </div>
    </>
  )
}
