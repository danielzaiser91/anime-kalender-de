export const ENTWURF_MAX_TAGE: number
export function heuteBerlin(jetzt?: Date): string
export function veralteterStempel(liste: { datum: string; entwurf?: boolean }[], heute: string): string | null
export function stempelWarnungAusDatei(pfad?: string, heute?: string): string | null
