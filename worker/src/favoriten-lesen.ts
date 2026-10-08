/** Vorsatz einer Liste in unserer eigenen Kennung `ak` (siehe `favoriten-kennung.ts`). */
export const VORSATZ = 'ak:'

/** Was zum Lesen einer Liste gebraucht wird: AniList → ak (Karenz bis 05.11.2026) und alt → neu zusammengeführter Titel. */
export type Kennungen = { abbild?: Map<number, number>; umleitung?: Map<number, number> }

/**
 * Liest eine gespeicherte Liste; ohne Vorsatz wird über `abbild` umgerechnet (fehlt es, bleiben die Zahlen, wie sie sind), zusammengeführte Titel
 * (Dubletten, 08.10.2026) wandern auf ihren Nachfolger. Ohne Abhängigkeit von `env.ts`, damit `check:logic` sie prüfen kann.
 */
export function leseFavoriten(raw: string | null | undefined, kennungen: Kennungen = {}): Set<number> {
  const { abbild, umleitung } = kennungen
  const text = raw ?? ''
  const neu = text.startsWith(VORSATZ)
  const zahlen = (neu ? text.slice(VORSATZ.length) : text)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0)
  if (!neu && !abbild) return new Set(zahlen)
  const inAk = neu ? zahlen : zahlen.map((id) => abbild!.get(id)).filter((id): id is number => id !== undefined)
  return new Set(umleitung ? inAk.map((id) => umleitung.get(id) ?? id) : inAk)
}
