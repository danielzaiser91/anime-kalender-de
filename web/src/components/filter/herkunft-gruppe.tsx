import type { FilterState } from '../../lib/filters.ts'
import { HERKUENFTE, type Herkunft } from '../../lib/herkunft.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Chip, Tooltip } from '../ui.tsx'
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

/** Eine Pille: Flagge, Name, Zahl; „Unbekannt" erklärt sich im Tooltip. */
export function HerkunftChip({
  t,
  land,
  anzahl,
  zustand,
  onClick,
}: {
  t: Translate
  land: Herkunft
  anzahl: number | undefined
  zustand: { active: boolean; excluded: boolean }
  onClick: () => void
}) {
  const chip = (
    <Chip {...zustand} onClick={onClick}>
      <Flagge land={land} />
      {herkunftName(t, land)}
      {anzahl ? <span className="opacity-70">{anzahl.toLocaleString('de-DE')}</span> : null}
    </Chip>
  )
  if (land !== 'XX') return chip
  return (
    <Tooltip text={t('filter.herkunft.XX.hinweis')} eigenerFokus>
      {chip}
    </Tooltip>
  )
}

/** ⓘ neben einer Gruppenüberschrift; der Text steht im Tooltip. */
export function InfoZeichen({ text }: { text: string }) {
  return (
    <Tooltip text={text} seite="unten" className="ml-1.5 normal-case tracking-normal">
      <span aria-label={text} className="grid size-4 cursor-help place-items-center rounded-full border border-ak-leise text-[10px] font-semibold leading-none text-ak-leise">
        i
      </span>
    </Tooltip>
  )
}
