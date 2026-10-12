import { beiCoverKlick, CoverMaximieren, coverVorwaermen } from './cover-max.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { TrailerKino } from './kino.tsx'
import { metaVon, unterzeileVon } from './kopf-texte.ts'
import { WeitereTitel } from './weitere.tsx'
import { AniSearchVerweis } from './pillen.tsx'
import { Bewertung } from './bewertung.tsx'
import { PanelAktionen } from './aktionen.tsx'
import { type Title, type FranchiseMember, type Release } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

/**
 * **Der Kopf mit Rangfolge** (Daniel, 11.10.2026, Variante V2): ein flaches Bild (Wertung und Absprünge darauf), darunter der
 * Name als größte Zeile, dann Teil, Werkangaben und die Knöpfe. Ein Klick aufs Bild öffnet das Cover groß.
 */
export function PanelBuehne({ reihenName, teilName, reihenTeile, buehnenBild, grossBild, title, onToggleHidden, favorites, onToggleFavorite, onClose, t, folgenImKasten, eigenerTeil, kinoRelease, asZiel }: {
  reihenName: string
  teilName: string
  reihenTeile: FranchiseMember[]
  buehnenBild: string | undefined
  grossBild?: [string, number, number]
  title: Title
  onToggleHidden: (id: number) => void
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
  onClose: () => void
  t: Translate
  folgenImKasten: boolean
  eigenerTeil: FranchiseMember | undefined
  kinoRelease: Release | undefined
  asZiel?: string
}) {
  const teil = reihenTeile.length > 1 && teilName !== reihenName ? teilName : undefined
  const unter = unterzeileVon(title, teil, folgenImKasten, t)
  return (
    <>
      <div className="relative h-[220px] shrink-0 cursor-zoom-in bg-slate-200 sm:h-[240px] dark:bg-slate-800" onClick={beiCoverKlick} onPointerEnter={coverVorwaermen} onTouchStart={coverVorwaermen}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover"
          style={{ backgroundImage: buehnenBild ? `url(${buehnenBild})` : undefined, backgroundPosition: '50% 10%' }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
          <Bewertung title={title} t={t} />
          <AniSearchVerweis title={title} ziel={asZiel} />
        </div>
      </div>
      <CoverMaximieren bild={buehnenBild} gross={grossBild} titel={anzeigeName(title)} />
      <div className="flex shrink-0 items-start gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <h2 title={reihenName} className="line-clamp-3 text-2xl font-semibold leading-tight text-slate-900 dark:text-white">
            {reihenName}
          </h2>
          {unter && <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{unter}</p>}
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{metaVon(title, eigenerTeil, t)}</p>
          <WeitereTitel title={title} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.close')}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-300 text-lg text-slate-700 transition hover:bg-slate-500/10 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      <PanelAktionen
        title={title}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onToggleHidden={onToggleHidden}
        t={t}
        trailer={(title.trailer || kinoRelease) && <TrailerKino trailer={title.trailer} titel={anzeigeName(title)} />}
      />
    </>
  )
}
