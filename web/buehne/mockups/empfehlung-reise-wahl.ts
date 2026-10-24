/** Die Vorschläge des Prüfstein-Mockups: gesehene Titel fallen weg, gemerkte stehen vorn (Reihenfolge des Bestands sonst). */
export function waehleVorschlaege(kennungen: number[], nutzer: { merkliste: number[]; verlauf: number[] } | undefined, anzahl: number): number[] {
  const gesehen = new Set(nutzer?.verlauf ?? [])
  const gemerkt = new Set(nutzer?.merkliste ?? [])
  const offen = kennungen.filter((id) => !gesehen.has(id))
  return [...offen.filter((id) => gemerkt.has(id)), ...offen.filter((id) => !gemerkt.has(id))].slice(0, anzahl)
}
