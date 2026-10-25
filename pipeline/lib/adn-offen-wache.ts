/** Zählt im committeten `data/adn-anisearch-offen.json` die Serien mit Grund `titelliste-fehlt` (Lauf ohne aniSearch-Titelliste). */
/** Ab dieser Zahl lautet die Warnung deutlicher; rot wird nur eine kaputte Datei (rot stoppt den ganzen Bestandsbau). */
export const VIELE_AB = 5

export type OffenWache = { stufe: 'ok' | 'warnung' | 'rot'; fehlt: number; text: string }

export function bewerteOffenDatei(inhalt: string | null): OffenWache {
  if (inhalt === null) return { stufe: 'rot', fehlt: 0, text: 'Datei data/adn-anisearch-offen.json fehlt' }
  let j: { anzahl?: unknown; serien?: unknown } | null
  try {
    j = JSON.parse(inhalt)
  } catch {
    return { stufe: 'rot', fehlt: 0, text: 'data/adn-anisearch-offen.json ist kein gültiges JSON' }
  }
  if (!j || !Array.isArray(j.serien)) return { stufe: 'rot', fehlt: 0, text: 'Feld „serien“ fehlt oder ist keine Liste' }
  if (j.anzahl !== j.serien.length) return { stufe: 'rot', fehlt: 0, text: `Feld „anzahl“ (${String(j.anzahl)}) passt nicht zu ${j.serien.length} Serien` }
  const fehlt = j.serien.filter((s: { grund?: unknown } | null) => s?.grund === 'titelliste-fehlt').length
  if (fehlt >= VIELE_AB) return { stufe: 'warnung', fehlt, text: `${fehlt} Serien ohne Titelliste (ab ${VIELE_AB} deutlich): der Wochenlauf findet die aniSearch-Titelliste offenbar länger nicht` }
  if (fehlt > 0) return { stufe: 'warnung', fehlt, text: `${fehlt} Serie(n) mit „titelliste-fehlt“: der letzte Lauf hatte keine Titelliste, der nächste rechnet neu` }
  return { stufe: 'ok', fehlt, text: 'keine Serie mit „titelliste-fehlt“' }
}
