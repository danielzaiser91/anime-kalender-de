import { beiCoverKlick, CoverMaximieren, coverVorwaermen } from './cover-max.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { TrailerKino } from './kino.tsx'
import { metaVon, unterzeileVon } from './kopf-texte.ts'
import { WeitereTitel } from './weitere.tsx'
import { Flaggen } from './flaggen.tsx'
import { PanelAktionen } from './aktionen.tsx'
import { KopfGrund, Posterkarte, SchliessenKnopf } from './kopf-bild.tsx'
import { type Title, type FranchiseMember, type Release } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

/**
 * **Der Kopf: Banner mit Posterkarte** (Daniel, 12.10.2026, Variante B): das Banner oben (200 px, am Rechner 240; ohne Banner das
 * unscharfe Cover), darauf ✕ und die Flaggen; darunter das ganze Poster als Karte, die in das Banner ragt, und der Name daneben.
 * Merken, Teilen, Ausblenden stehen als Reihe darunter. Ein Klick aufs Bild öffnet das Cover groß.
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
  const meta = metaVon(title, eigenerTeil, t)
  return (
    <>
      <div
        data-kopf
        className="relative h-[200px] shrink-0 cursor-zoom-in overflow-hidden bg-slate-200 min-[512px]:h-[240px] dark:bg-slate-800"
        onClick={beiCoverKlick}
        onPointerEnter={coverVorwaermen}
        onTouchStart={coverVorwaermen}
      >
        <KopfGrund banner={title.bannerImage} cover={buehnenBild} />
        <SchliessenKnopf onClose={onClose} label={t('detail.close')} />
        <Flaggen title={title} ziel={asZiel} t={t} />
      </div>
      <CoverMaximieren bild={buehnenBild} gross={grossBild} titel={anzeigeName(title)} />
      <div className="relative z-10 -mt-[72px] grid shrink-0 grid-cols-[120px_1fr] gap-3 px-4 pb-3 min-[512px]:-mt-[84px] min-[512px]:grid-cols-[140px_1fr]">
        <Posterkarte bild={buehnenBild} onClick={beiCoverKlick} />
        <div className="min-w-0 pt-[80px] min-[512px]:pt-[92px]">
          <h2 title={reihenName} className="line-clamp-2 text-t1 font-bold text-ak-text">
            {reihenName}
          </h2>
          {unter && <p className="mt-1 text-t3 text-ak-leise">{unter}</p>}
          <div className="mt-1 text-t4 text-ak-leise">
            {meta ? `${meta} · ` : ''}
            <WeitereTitel title={title} />
          </div>
        </div>
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
