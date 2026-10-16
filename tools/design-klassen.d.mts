// Typen für die beiden Grenz-Helfer, die auch `pipeline/check-kalender-plausibilitaet-bestand.ts` nutzt.
export declare function zuViel(zahlen: Record<string, number>, erlaubt: Record<string, number | undefined>): string[]
export declare function gesenkt<T extends Record<string, number | undefined>>(zahlen: Record<string, number>, erlaubt: T): T & Record<string, number>
