/** Tage grün-aber-leer, ab denen gemeldet wird. */
export const LEER_TAGE: number
/** Quellen, bei denen 0 Treffer normal ist, mit Grund. */
export const LEER_OK: Record<string, string>
/** Meldezeilen „grün, aber leer“ je Quelle aus einem `source-health.json`-Stand. */
export function leerZeilen(gesundheit: Record<string, { leerSeit?: string; lastCount?: number }>, jetztMs: number, ok?: Record<string, string>, tage?: number): string[]
