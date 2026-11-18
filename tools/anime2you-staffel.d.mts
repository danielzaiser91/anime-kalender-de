export function zitatStaffeln(zitat: string): number[]
export function adressStaffel(note: string | undefined): { staffel: number | null; folgen: number | null }
export function pruefeStaffel(zitat: string, note: string | undefined, anilistFolgen?: number | null): { urteil: 'passt' | 'abweichung' | 'unbekannt'; grund: string }
export function pruefeTitel(eintraege: Array<{ anilistId: number; url?: string; note?: string }>, anilistId: number, zitat: string, anilistFolgen?: number | null): Array<{ url: string; urteil: string; grund: string }>
