/**
 * Die Zeilen von `data/bestand-historie.jsonl`: welche zählt als Vorgänger, welche ist verworfen.
 *
 * Eine Zeile entsteht in `data:historie`, bevor `commit-data.sh` über den Bau entscheidet. Wird der Bau danach nicht
 * ausgeliefert (Zusicherung rot) oder ohne Titel neu gebaut (Quarantäne), hat die Zeile einen Stand gemessen, der nie live war
 * (19.10.2026: A/B-Pendeln, die Wache verglich gegen Stände ohne Gegenstück im Netz). Solche Zeilen bleiben stehen,
 * tragen `verworfen: true` und zählen weder als Vorgänger noch für die Wache.
 */

export interface HistorieZeile {
  zeitpunkt?: string
  verworfen?: boolean
  [feld: string]: unknown
}

function parse(zeile: string): HistorieZeile | null {
  try {
    const wert: unknown = JSON.parse(zeile)
    return wert && typeof wert === 'object' && !Array.isArray(wert) ? (wert as HistorieZeile) : null
  } catch {
    return null
  }
}

/** Die lesbaren, nicht verworfenen Zeilen in Dateireihenfolge; Unlesbares fällt weg. */
export function geltendeZeilen(text: string): HistorieZeile[] {
  return text
    .split('\n')
    .map(parse)
    .filter((z): z is HistorieZeile => z !== null && z.verworfen !== true)
}

/** Der Vorgänger für den nächsten Vergleich: die letzte geltende Zeile. */
export function letzteGeltende(text: string): HistorieZeile | null {
  return geltendeZeilen(text).at(-1) ?? null
}

/**
 * Markiert die letzte lesbare Zeile als verworfen; alle anderen Zeilen bleiben Byte für Byte stehen (auch unlesbare).
 * Ist die letzte lesbare Zeile schon verworfen, ändert sich nichts: zwei Läufe markieren nicht eine weitere Zeile.
 * Mit `laufId` zählt nur eine Zeile desselben Laufs: Ist `data:historie` gescheitert, gehört die letzte Zeile einem früheren Lauf.
 */
export function letzteVerwerfen(text: string, laufId?: string): string {
  const zeilen = text.split('\n')
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const z = parse(zeilen[i]!)
    if (!z) continue
    if (z.verworfen === true) return text
    if (laufId !== undefined && z.laufId !== laufId) return text
    zeilen[i] = JSON.stringify({ ...z, verworfen: true })
    return zeilen.join('\n')
  }
  return text
}
