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
    .filter((v) => Number.isInteger(v) && v > 0)
  const { umleitung } = kennungen
  return new Set(umleitung ? zahlen.map((id) => umleitung.get(id) ?? id) : zahlen)
}
