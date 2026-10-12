import { beiCoverKlick, coverVorwaermen } from './cover-max.tsx'
import { BuehnenLeiste } from './buehnen-leiste.tsx'
import { BuehnenBildFlaeche, BuehnenUnterzeile } from './buehnen-teile.tsx'
import { type Title, type FranchiseMember } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

export function PanelBuehne({ reihenName, buehnenBild, grossBild, title, onToggleHidden, favorites, onToggleFavorite, onClose, t, unterzeile, folgenImKasten, eigenerTeil }: {
  reihenName: string
  buehnenBild: string | undefined
  grossBild?: [string, number, number]
  title: Title
  onToggleHidden: (id: number) => void
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
  onClose: () => void
  t: Translate
  unterzeile: (string | undefined)[]
  folgenImKasten: boolean
  eigenerTeil: FranchiseMember | undefined
}) {
  return (
    <>
      <div className="relative shrink-0" style={{ isolation: 'isolate' }}>
        <h2
          title={reihenName}
          className="line-clamp-2 py-1 pb-2 pl-4 pr-24 text-lg font-semibold leading-tight text-slate-900 dark:text-white"
        >
          {reihenName}
        </h2>
        {/* Schließen, Merken, Teilen und die Altersfreigabe stehen in der Titelzeile statt auf dem Cover (Daniel, 04.10.2026). */}
        <BuehnenLeiste title={title} favorites={favorites} onToggleFavorite={onToggleFavorite} onToggleHidden={onToggleHidden} onClose={onClose} t={t} buehnenBild={buehnenBild} grossBild={grossBild} />
        {title.fsk !== undefined && (
          <span className="absolute right-11 top-0 z-10 rounded-b-lg bg-[rgba(8,12,18,.74)] px-2 py-1 text-xs font-semibold tabular-nums text-slate-200 backdrop-blur-[3px]">
            {t(title.fskQuelle ? 'antwort.fskAnbieter' : 'antwort.fskAb', { n: title.fsk })}
          </span>
        )}

        {/*
          **410 px, und der Ausschnitt sitzt tief.**

          Daniel am 03.09.2026, in zwei Schritten: erst „cover height: 210 ->
          410px; background-position: 50% 20 -> 90%", nach dem Ansehen dann
          „auf 50% 10% und 400px reduzieren (sind paar negativ aufgefallen mit
          der verschiebung, so ist besser)". Bei 90 % lag der Ausschnitt zu
          tief — manche Cover zeigten dann den Bildrand statt der Figuren.

          Der „Staffel 1"-Block darunter holt einen Teil davon wieder herein
          (sein `-mt-24`): Das Cover bleibt groß, der Weg zum Inhalt kurz.
        */}
        <div className={`relative cursor-zoom-in h-[400px]`} onClick={beiCoverKlick} onPointerEnter={coverVorwaermen} onTouchStart={coverVorwaermen}>
          <BuehnenBildFlaeche buehnenBild={buehnenBild} />

          <BuehnenUnterzeile title={title} unterzeile={unterzeile} folgenImKasten={folgenImKasten} eigenerTeil={eigenerTeil} t={t} />

          {/*
            **Die Altersfreigabe als Marke, gegenüber der Unterzeile.**

            Sie stand bis zum 04.09.2026 in der Faktenzeile des Kastens,
            zwischen zwei Angaben, die den Kopf darüber wiederholten. Als
            deren Dopplung fiel, blieb sie als einzige übrig — und gehört
            damit dorthin, wo die Werkangaben stehen. Daniel: „ab 12 kann als
            label icon oben rechts vom sub-title-div."

            Rechts, weil links der Untertitel steht und die Schließen-Leiste
            erst 3,5 rem tiefer beginnt; die Marke passt in die Lücke
            dazwischen, ohne beide anzufassen.
          */}
        </div>
      </div>
    </>
  )
}
