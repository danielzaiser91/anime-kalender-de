import { Fragment, useState } from 'react'
import { zeitMitMarke } from '@shared/zeit-text.ts'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Zeilenzustand } from '@shared/laeuft-jetzt.ts'
import type { Dataset } from '../../lib/data.ts'
import { tvPremiere } from '../../lib/tv-angabe.ts'
import { tvJetzt } from '../../lib/tv-jetzt.ts'
import { ErsteSendung, JetztLinie, SenderZeile, UhrzeitMitLaeuft } from './TvJetzt.tsx'
import { buendeleTermine } from '../../lib/buendel.ts'
import { coverBild } from '../../lib/cover.ts'
import { useLang } from '../../lib/i18n.tsx'
import { FernsehZeichen } from './Zeichen.tsx'
import { PremiereMarke } from './PremiereMarke.tsx'
import { useHoverCover } from './HoverCover.tsx'
import { TREFFER_24_HOCH } from '../detail/tippziel.ts'

/**
 * Unterhalb von lg (Desktop-Breakpoint der Wochenansicht) steht der TV-Kasten als eine Kachelreihe
 * zum Wischen; die nächste Kachel ragt an, damit man sieht, dass es weitergeht. Ab lg: Liste.
 */
const REIHE =
  'flex flex-col max-lg:relative max-lg:snap-x max-lg:snap-mandatory max-lg:flex-row max-lg:gap-2 max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:scroll-px-3.5 max-lg:pb-1 max-lg:[scrollbar-width:thin]'
const REIHE_KACHEL =
  'max-lg:flex max-lg:w-[80%] max-lg:shrink-0 max-lg:snap-start max-lg:flex-col max-lg:rounded-xl max-lg:border max-lg:border-ak-tv-rand max-lg:px-2 max-lg:py-1 max-lg:min-[520px]:w-[46%]'

/**
 * Die Fernsehtermine eines Tages als Liste neben den Postern. Wiederholungen desselben Titels beim
 * selben Sender stehen als eine Zeile mit „+2, zuletzt um 18:50" (Beginn der letzten, nicht ihr Ende); ein Klick darauf nennt die Zeiten.
 */
export function TvKasten({
  termine,
  data,
  hidden,
  vorbeiBis,
  jetzt,
  onOpen,
  kompakt,
}: {
  termine: ReleaseEvent[]
  data: Dataset
  hidden: Set<number>
  /** Uhrzeit, bis zu der vergangene Tage und heute alles vorbei ist; an künftigen Tagen leer. */
  vorbeiBis?: string
  /** Nur für heute: die Uhrzeit, nach der „Läuft", „in 13 Min" und die Jetzt-Linie rechnen. */
  jetzt?: string
  onOpen: (ev: ReleaseEvent) => void
  /** In einer Schwebekarte: ohne eigenen Rahmen und Kopf. */
  kompakt?: boolean
}) {
  const { t } = useLang()
  const gruppen = buendeleTermine(termine, (ev) => !!ev.verpasst || tvPremiere(ev, data))
  const stand = jetzt ? tvJetzt(gruppen, data.releaseBySlug, jetzt) : undefined
  const liste = (
    <ul className={kompakt ? 'flex flex-col' : REIHE}>
      {gruppen.map((g, i) => (
        <Fragment key={g[0].id}>
          {stand?.linie.linieVor === i && <JetztLinie uhr={jetzt!} nichtsMehr={false} />}
          <TvZeile
            gruppe={g}
            data={data}
            versteckt={hidden.has(g[0].titleId)}
            vorbei={stand ? stand.zustand.zeilen[i]?.art === 'vorbei' : !!vorbeiBis && (g[g.length - 1].time ?? '99') < vorbeiBis}
            zustand={stand?.zustand.zeilen[i]}
            restZeigen={!!stand?.linie.restInZeile}
            kachel={!kompakt}
            onOpen={onOpen}
          />
        </Fragment>
      ))}
      {stand?.linie.linieVor === gruppen.length && <JetztLinie uhr={jetzt!} nichtsMehr />}
    </ul>
  )
  if (kompakt) return liste
  return (
    <div className="flex min-h-full flex-col gap-0.5 rounded-2xl border border-ak-tv-rand bg-ak-tv-grund px-3.5 py-3">
      {/* Klebt oben, wenn der Kasten in Zeilenhöhe rollt — sonst verschwände mit dem Kopf auch der Hinweis, was hier steht. */}
      <h3 className="sticky top-0 z-[1] -mx-3.5 -mt-3 flex items-center gap-2 rounded-t-2xl bg-ak-tv-grund px-3.5 pt-3 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ak-tv">
        <FernsehZeichen groesse={16} />
        <span>
          {t('kal.imTv')}
          {!!stand?.linie.ersteIn && <ErsteSendung minuten={stand.linie.ersteIn} />}
        </span>
      </h3>
      {termine.length === 0 ? <p className="text-[13px] text-ak-sehr-leise">{t('kal.keineAusstrahlung')}</p> : liste}
    </div>
  )
}

function TvZeile({
  gruppe,
  data,
  versteckt,
  vorbei,
  zustand,
  restZeigen,
  kachel,
  onOpen,
}: {
  gruppe: ReleaseEvent[]
  data: Dataset
  versteckt: boolean
  vorbei: boolean
  zustand: Zeilenzustand | undefined
  restZeigen: boolean
  kachel: boolean
  onOpen: (ev: ReleaseEvent) => void
}) {
  const { t } = useLang()
  const [auf, setAuf] = useState(false)
  const [ev, ...weitere] = gruppe
  const cover = data.titleById.get(ev.titleId)?.coverImage
  const { zeiger, vorschau } = useHoverCover(versteckt ? undefined : cover)
  if (versteckt) {
    return <li className={`py-1 text-[13px] italic text-ak-sehr-leise ${kachel ? REIHE_KACHEL : ''}`}>{ev.name}</li>
  }
  const premiere = tvPremiere(ev, data)
  const letzte = zeitMitMarke(weitere[weitere.length - 1] ?? {}, '≈ ')
  return (
    <li data-tv-zeile className={[kachel ? REIHE_KACHEL : '', vorbei ? 'ak-vorbei' : ''].join(' ')} {...zeiger}>
      <button
        type="button"
        data-schliesst
        onClick={() => onOpen(ev)}
        className="grid w-full cursor-pointer grid-cols-[24px_54px_minmax(0,1fr)] items-center gap-2 rounded-lg py-1 text-left max-lg:min-h-11 text-[13px] transition hover:bg-ak-flaeche-2 focus-visible:-outline-offset-2"
      >
        {cover ? (
          <img {...coverBild(cover, 24)} alt="" loading="lazy" className="h-[34px] w-6 rounded object-cover" />
        ) : (
          <span className="h-[34px] w-6 rounded bg-ak-flaeche-2" />
        )}
        <UhrzeitMitLaeuft zeit={zeitMitMarke(ev, '≈ ') || '–'} zustand={zustand} />
        <span className="flex min-w-0 flex-col">
          <span className="ak-titel font-semibold text-ak-text">
            {vorbei && <span className="sr-only">vorbei </span>}
            {ev.name}
            {premiere && <PremiereMarke platform="tv" vorher={ev.premiereVorher} className="ml-1.5 inline-block px-1.5 align-[1px]" />}
          </span>
          <SenderZeile ev={ev} zustand={zustand} restZeigen={restZeigen} />
        </span>
      </button>
      {weitere.length > 0 && (
        <button
          type="button"
          onClick={() => setAuf(!auf)}
          aria-expanded={auf}
          className={`ml-[86px] flex min-h-11 cursor-pointer items-center rounded px-1 text-xs font-semibold text-ak-tv hover:underline sm:min-h-0 ${TREFFER_24_HOCH}`}
        >
          {auf
            ? t('kal.buendelAuch', { zeiten: weitere.map((w) => zeitMitMarke(w, '≈ ') || '–').join(', ') })
            : letzte
              ? t(weitere.length === 1 ? 'kal.buendelTvEine' : 'kal.buendelTv', { n: weitere.length, zeit: letzte })
              : t('kal.buendelTvOhneZeit', { n: weitere.length })}
        </button>
      )}
      {vorschau}
    </li>
  )
}
