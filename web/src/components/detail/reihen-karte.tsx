import type { ReactNode } from 'react'
import { hauptstaffeln, staffelSpanne, staffelStaende } from '@shared/titles.ts'
import type { FranchiseMember, Title } from '@shared/types.ts'
import { useLang, type Translate } from '../../lib/i18n.tsx'
import { PanelKarte, StapelZeichen } from './panel-karte.tsx'

type Zahlwort = (n: number, einzahl: Parameters<Translate>[0], mehrzahl: Parameters<Translate>[0]) => string
const zahlwort = (t: Translate): Zahlwort => (n, einzahl, mehrzahl) => (n === 1 ? t(einzahl) : t(mehrzahl, { n }))

/** Der Staffelstand: „Staffel 1–5 von 25" für eine Hauptstaffel, sonst „25 Staffeln"; ohne Staffeln leer. */
export function reihenStand(reihenTeile: FranchiseMember[], reihenName: string, titelId: number, t: Translate): string {
  const haupt = hauptstaffeln(reihenTeile)
  const stand = staffelStaende(haupt, reihenName)
  const von = [...stand.values()][0]?.von ?? haupt.length
  const gewaehlt = stand.get(titelId)
  if (gewaehlt) return t('detail.staffelVon', { n: staffelSpanne(gewaehlt), von: gewaehlt.von })
  return von > 0 ? zahlwort(t)(von, 'detail.eineStaffel', 'detail.staffelnZahl') : ''
}

/** „Staffel 4 von 4 · 1 Film · 1 Special" — nur Gruppen, die es gibt. Ist der gewählte Teil keine Staffel, steht die Staffelzahl. */
export function reihenZeile(reihenTeile: FranchiseMember[], reihenName: string, titelId: number, t: Translate): string {
  const hauptIds = new Set(hauptstaffeln(reihenTeile).map((m) => m.id))
  const filme = reihenTeile.filter((m) => m.format === 'MOVIE').length
  const eigene = reihenTeile.filter((m) => m.eigenesWerk).length
  const specials = reihenTeile.filter((m) => !hauptIds.has(m.id) && !m.eigenesWerk && m.format !== 'MOVIE').length
  const zahl = zahlwort(t)
  return [
    reihenStand(reihenTeile, reihenName, titelId, t),
    eigene ? zahl(eigene, 'detail.eineEigeneSerie', 'detail.reiheEigeneSerien') : '',
    filme ? zahl(filme, 'detail.einFilm', 'detail.reiheFilme') : '',
    specials ? zahl(specials, 'detail.einSpecial', 'detail.reiheSpecials') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Die Reihe als Karte unter dem Antwortkasten (Daniel, 09.10.2026, Entwurf B): Zähler im Kopf, darunter der Stand der Reihe. */
export function ReihenKarte({ reihenTeile, reihenName, title, zaehler, children }: { reihenTeile: FranchiseMember[]; reihenName: string; title: Title; zaehler: number; children: ReactNode }) {
  const { t } = useLang()
  return (
    <PanelKarte symbol={<StapelZeichen />} titel={t('detail.reihe')} zaehler={zaehler} akzent="info">
      <p className="-mt-1.5 mb-2 pl-[38px] text-t5 text-ak-text/75">{reihenZeile(reihenTeile, reihenName, title.id, t)}</p>
      {children}
    </PanelKarte>
  )
}
