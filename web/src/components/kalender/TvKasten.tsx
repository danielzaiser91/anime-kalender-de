import { useState } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import { tvPremiere } from '../../lib/tv-angabe.ts'
import { buendeleTermine } from '../../lib/buendel.ts'
import { coverBild } from '../../lib/cover.ts'
import { useLang } from '../../lib/i18n.tsx'
import { FernsehZeichen } from './Zeichen.tsx'

/**
 * Die Fernsehtermine eines Tages als Liste neben den Postern. Wiederholungen desselben Titels beim
 * selben Sender stehen als eine Zeile mit „+2 bis 18:50"; ein Klick darauf nennt die Zeiten.
 */
export function TvKasten({
  termine,
  data,
  hidden,
  vorbeiBis,
  onOpen,
  kompakt,
}: {
  termine: ReleaseEvent[]
  data: Dataset
  hidden: Set<number>
  /** Uhrzeit, bis zu der heute alles vorbei ist; an anderen Tagen leer. */
  vorbeiBis?: string
  onOpen: (ev: ReleaseEvent) => void
  /** In einer Schwebekarte: ohne eigenen Rahmen und Kopf. */
  kompakt?: boolean
}) {
  const { t } = useLang()
  const gruppen = buendeleTermine(termine, (ev) => !!ev.verpasst || tvPremiere(ev, data))
  const liste = (
    <ul className="flex flex-col">
      {gruppen.map((g) => (
        <TvZeile key={g[0].id} gruppe={g} data={data} versteckt={hidden.has(g[0].titleId)} vorbei={!!vorbeiBis && (g[g.length - 1].time ?? '99') < vorbeiBis} onOpen={onOpen} />
      ))}
    </ul>
  )
  if (kompakt) return liste
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-ak-tv-rand bg-ak-tv-grund px-3.5 py-3">
      <h3 className="flex items-center gap-2 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ak-tv">
        <FernsehZeichen groesse={16} />
        {t('kal.imTv')}
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
  onOpen,
}: {
  gruppe: ReleaseEvent[]
  data: Dataset
  versteckt: boolean
  vorbei: boolean
  onOpen: (ev: ReleaseEvent) => void
}) {
  const { t } = useLang()
  const [auf, setAuf] = useState(false)
  const [ev, ...weitere] = gruppe
  if (versteckt) {
    return <li className="py-1 text-[13px] italic text-ak-sehr-leise">{ev.name}</li>
  }
  const cover = data.titleById.get(ev.titleId)?.coverImage
  const premiere = tvPremiere(ev, data)
  const letzte = weitere[weitere.length - 1]?.time
  return (
    <li data-tv-zeile className={vorbei ? 'ak-vorbei' : ''}>
      <button
        type="button"
        data-schliesst
        onClick={() => onOpen(ev)}
        className="grid w-full cursor-pointer grid-cols-[24px_44px_minmax(0,1fr)] items-center gap-2 rounded-lg py-1 text-left text-[13px] transition hover:bg-ak-tv/10"
      >
        {cover ? (
          <img {...coverBild(cover, 24)} alt="" loading="lazy" className="h-[34px] w-6 rounded object-cover" />
        ) : (
          <span className="h-[34px] w-6 rounded bg-ak-flaeche-2" />
        )}
        <span className="font-bold tabular-nums text-ak-tv">{ev.time ?? '–'}</span>
        <span className="flex min-w-0 flex-col">
          <span className="ak-titel font-semibold text-ak-text">
            {ev.name}
            {premiere && (
              <span className="ml-1.5 inline-block rounded-full bg-[#e14d8a] px-1.5 align-[1px] text-[10px] font-extrabold uppercase tracking-wider text-[#0d0f14]">
                {t('kal.premiere')}
              </span>
            )}
          </span>
          <span className="text-xs text-ak-leise">
            {ev.sender}
            {ev.episode && !ev.sichtung ? ` · ${t('kal.folge', { n: ev.episode })}` : ''}
          </span>
        </span>
      </button>
      {weitere.length > 0 && (
        <button
          type="button"
          onClick={() => setAuf(!auf)}
          aria-expanded={auf}
          className="ml-[76px] cursor-pointer rounded px-1 text-xs font-semibold text-ak-tv hover:underline"
        >
          {auf
            ? t('kal.buendelAuch', { zeiten: weitere.map((w) => w.time ?? '–').join(', ') })
            : letzte
              ? t('kal.buendelTv', { n: weitere.length, zeit: letzte })
              : t('kal.buendelTvOhneZeit', { n: weitere.length })}
        </button>
      )}
    </li>
  )
}
