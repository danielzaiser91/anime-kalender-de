// Typen für `pipeline/check-netflix-zweite-kennung.ts`.
export declare function ergaenzeZweiteKennungen(jeAdresse: Map<string, { t: { id: number } }[]>, zusatz: Map<number, string[]>): number
export declare function ladeZusatz(titel: unknown[], wurzel: string): Map<number, string[]>
export declare function zaehleZusatzZiele(eintrag: { gesamt: number; gemeldet: number }, zusatz: Map<number, string[]>): number
