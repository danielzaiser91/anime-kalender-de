import type { ReactNode } from 'react'
import { hauptstaffeln, staffelStaende } from '@shared/titles.ts'
import type { FranchiseMember, Title } from '@shared/types.ts'
import { useLang, type Translate } from '../../lib/i18n.tsx'
import { PanelKarte, StapelZeichen } from './panel-karte.tsx'

/** „Staffel 4 von 4 · 1 Film · 1 Special" — nur Gruppen, die es gibt. Ist der gewählte Teil keine Staffel, steht die Staffelzahl. */
function reihenZeile(reihenTeile: FranchiseMember[], reihenName: string, titelId: number, t: Translate): string {
  const haupt = hauptstaffeln(reihenTeile)
  const stand = staffelStaende(haupt, reihenName)
  const hauptIds = new Set(haupt.map((m) => m.id))
  const von = [...stand.values()][0]?.von ?? haupt.length
  const filme = reihenTeile.filter((m) => m.format === 'MOVIE').length
  const specials = reihenTeile.filter((m) => !hauptIds.has(m.id) && m.format !== 'MOVIE').length
  const gewaehlt = stand.get(titelId)
  const zahl = (n: number, einzahl: Parameters<Translate>[0], mehrzahl: Parameters<Translate>[0]) => (n === 1 ? t(einzahl) : t(mehrzahl, { n }))
  return [
    gewaehlt ? t('detail.staffelVon', { n: gewaehlt.staffel, von: gewaehlt.von }) : von > 0 ? zahl(von, 'detail.eineStaffel', 'detail.staffelnZahl') : '',
    filme ? zahl(filme, 'detail.einFilm', 'detail.reiheFilme') : '',
    specials ? zahl(specials, 'detail.einSpecial', 'detail.reiheSpecials') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Die Reihe als Karte unter dem Antwortkasten (Daniel, 09.10.2026, Entwurf B): Zähler im Kopf, darunter der Stand der Reihe. */
export function ReihenKarte({ reihenTeile, reihenName, title, children }: { reihenTeile: FranchiseMember[]; reihenName: string; title: Title; children: ReactNode }) {
  const { t } = useLang()
  return (
    <PanelKarte symbol={<StapelZeichen />} titel={t('detail.reihe')} zaehler={reihenTeile.length} akzent="blue">
      <p className="-mt-1.5 mb-2 pl-[38px] text-[11px] text-ak-text/75">{reihenZeile(reihenTeile, reihenName, title.id, t)}</p>
      {children}
    </PanelKarte>
  )
}
