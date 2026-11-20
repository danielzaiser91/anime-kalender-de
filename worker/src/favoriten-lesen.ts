import { terminFilterAusText, type TerminFilter } from '../../shared/push-filter.ts'
/** Vorsatz einer Liste in unserer eigenen Kennung `ak` (siehe `favoriten-kennung.ts`). */
export const VORSATZ = 'ak:'

/** Was zum Lesen einer Liste gebraucht wird: alt → neu zusammengeführter Titel. */
export type Kennungen = { umleitung?: Map<number, number> }

/**
 * Liest eine gespeicherte Liste; mit und ohne Vorsatz sind es ak-Kennungen, zusammengeführte Titel
 * (Dubletten, 08.10.2026) wandern auf ihren Nachfolger. Ohne Abhängigkeit von `env.ts`, damit `check:logic` sie prüfen kann.
 */
export function leseFavoriten(raw: string | null | undefined, kennungen: Kennungen = {}): Set<number> {
  const text = raw ?? ''
  const zahlen = (text.startsWith(VORSATZ) ? text.slice(VORSATZ.length) : text)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v !== 0)
  const { umleitung } = kennungen
  return new Set(umleitung ? zahlen.map((id) => umleitung.get(id) ?? id) : zahlen)
}

/** Anfang des Filter-Teils hinter den Kennungen (`ak:1,2,~tvAus=1`): `leseFavoriten` liest ihn als Nicht-Zahl und lässt ihn aus, ein älterer Worker also ebenso. */
export const FILTER_MARKE = '~'

/** Der Termin-Filter dieses Abos (`shared/push-filter.ts`); ohne Teil oder unlesbar: `null` = alles melden. */
export function leseAboFilter(raw: string | null | undefined): TerminFilter | null {
  const teil = (raw ?? '').split(',').find((t) => t.startsWith(FILTER_MARKE))
  return teil ? terminFilterAusText(teil.slice(FILTER_MARKE.length)) : null
}
