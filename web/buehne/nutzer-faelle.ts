/** Nutzerzustand eines Falls: was der Besucher gemerkt und gesehen hat (Empfehlungen und Co. brauchen das, Titel allein genügen nicht). */
export interface Nutzer {
  merkliste: number[]
  verlauf: number[]
}

/** Fallarten mit Nutzerzustand: Kennung → Anzeigename und Zahl der gemerkten und gesehenen Titel (die ersten des Bestands). */
export const NUTZER_FAELLE: Record<string, { name: string; merkliste: number; verlauf: number }> = {
  'nutzer-neu': { name: 'Nutzer: neu (nichts gemerkt)', merkliste: 0, verlauf: 0 },
  'nutzer-aktiv': { name: 'Nutzer: 3 gemerkt, 5 gesehen', merkliste: 3, verlauf: 5 },
}

/** Der Zustand aus den Kennungen des Bestands: gemerkt sind die ersten, gesehen die folgenden — überschneidungsfrei. */
export function nutzerAus(kennungen: number[], spec: { merkliste: number; verlauf: number }): Nutzer {
  return {
    merkliste: kennungen.slice(0, spec.merkliste),
    verlauf: kennungen.slice(spec.merkliste, spec.merkliste + spec.verlauf),
  }
}
