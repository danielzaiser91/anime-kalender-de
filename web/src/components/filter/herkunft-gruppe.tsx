import type { FilterState } from '../../lib/filters.ts'
import { HERKUENFTE, type Herkunft } from '../../lib/herkunft.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Flagge } from './Flagge.tsx'

/**
 * Die Herkünfte der Gruppe, nach Titelzahl absteigend: nur solche mit Titeln, dazu gewählte oder ausgeschlossene (sonst fände man
 * sie nicht wieder). Mit nur einer Herkunft und ohne Auswahl entfällt die Gruppe — es gäbe nichts zu wählen.
 */
export function herkunftListe(zaehlung: Map<Herkunft, number>, filters: FilterState): Herkunft[] {
  const gesetzt = [...filters.land, ...filters.excluded.land]
  const liste = HERKUENFTE.filter((h) => zaehlung.has(h) || gesetzt.includes(h))
  if (liste.length < 2 && !gesetzt.length) return []
  return liste.sort((a, b) => (zaehlung.get(b) ?? 0) - (zaehlung.get(a) ?? 0))
}

export const herkunftName = (t: Translate, h: Herkunft): string => t(`filter.herkunft.${h}` as never)

/** Inhalt einer Pille: Flagge, Name, Zahl der Titel. */
export function HerkunftPille({ t, land, anzahl }: { t: Translate; land: Herkunft; anzahl: number | undefined }) {
  return (
    <>
      <Flagge land={land} />
      {herkunftName(t, land)}
      {anzahl ? <span className="opacity-60">{anzahl.toLocaleString('de-DE')}</span> : null}
    </>
  )
}

export function HerkunftHinweis({ t }: { t: Translate }) {
  return <p className="basis-full text-[11px] leading-snug text-ak-leise">{t('filter.herkunft.hinweis')}</p>
}
