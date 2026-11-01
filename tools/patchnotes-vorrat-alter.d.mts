export const VORRAT_ORDNER: string
export const VORRAT_MAX_TAGE: number
export function veralteterVorrat(eintraege: { name: string; seit?: string; wartetAuf?: string }[], heute: string, maxTage?: number): string[]
export function vorratFelder(name: string, text: string): { name: string; seit?: string; wartetAuf?: string }
export function vorratWarnungenAusOrdner(ordner?: string, heute?: string): string[]
