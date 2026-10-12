/**
 * **Eine aniSearch-Kennung, die mehrere Titel des Hauptbestands tragen, ist gewollt oder ein Fehler** (Messung 12.10.2026: 42 Kennungen, 117 Titel).
 * aniSearch führt Filmreihen und Serie-samt-Special oft auf einer Seite („Film, 3": Kizumonogatari; „TV-Serie, 30": Wolf's Rain samt OVA), AniList trennt sie.
 * Gewollt heißt: Die Handdatei (`data/anisearch-ids-hand.yaml`, AniList-Kennung → aniSearch-Kennung, „nachgesehen") bindet alle Titel der Gruppe bis auf höchstens einen
 * an diese Kennung — der eine kommt aus der ID-Brücke. Jede andere Gruppe ist neu und ungeklärt: Brücke und Hand widersprechen sich, oder die Brücke hat
 * zwei Titeln dieselbe Seite gegeben. Gibt je Gruppe eine Meldung zurück, leer heißt in Ordnung.
 */
export function anisearchKennungMehrfach(titel: { id: number; anisearchId?: number }[], hand: Record<number, number>): string[] {
  const jeKennung = new Map<number, number[]>()
  for (const t of titel) if (t.anisearchId) jeKennung.set(t.anisearchId, [...(jeKennung.get(t.anisearchId) ?? []), t.id])
  const fehler: string[] = []
  for (const [kennung, ids] of jeKennung) {
    const ungebunden = ids.filter((id) => hand[id] !== kennung)
    if (ids.length < 2 || ungebunden.length <= 1) continue
    fehler.push(`aniSearch-Kennung ${kennung} tragen ${ids.length} Titel (${ids.join(', ')}), ${ungebunden.length} davon ohne Handbindung (${ungebunden.join(', ')}) — in data/anisearch-ids-hand.yaml binden, wenn aniSearch sie auf einer Seite führt, sonst die falsche Kennung korrigieren`)
  }
  return fehler
}
