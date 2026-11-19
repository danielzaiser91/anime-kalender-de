/** Ablage der nachgeladenen Texte (`i18n-spaet.ts` trägt ein, `translate` in `i18n.tsx` liest); eigene Datei, damit kein Importkreis entsteht. */
export const SPAET: Record<string, string> = {}

export function registriereSpaeteTexte(texte: Record<string, string>): void {
  Object.assign(SPAET, texte)
}
