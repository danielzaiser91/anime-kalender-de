import { ohneSprache } from './fremde-adressen.ts'

export interface BelegAdresse {
  anilistId?: number
  url?: string
}

/**
 * Echte Sammelseiten (28.10.2026): Handbeleg eines Titels aus `titles.json` an einer Adresse, die auch ein Cartoon oder ein
 * Titel ohne Synchro führt, und die das Werk wirklich gemeinsam zeigt. Schlüssel `<Kennung>`, Wert Adresse und Grund.
 * Jede Ausnahme gilt für genau diese Kennung und Adresse und muss einen Treffer haben (sonst streichen).
 */
export const SAMMELSEITEN: Record<number, { url: string; grund: string }> = {
  21416: {
    url: 'https://www.crunchyroll.com/de/series/G63K98PZ6/one-punch-man',
    grund: 'Serienseite mit Staffel 1–3 und dem Rückblick-Special (ohne-synchro 10014335); der Katalog führt keine eigene OVA-Seite.',
  },
  108945: {
    url: 'https://www.crunchyroll.com/de/series/G63K98PZ6/one-punch-man',
    grund: 'Serienseite mit Staffel 1–3 und dem Rückblick-Special (ohne-synchro 10014335); der Katalog führt keine eigene OVA-Seite.',
  },
  131942: {
    url: 'https://www.crunchyroll.com/de/series/GYP8DP1MY/jojos-bizarre-adventure',
    grund: 'Eine Serienseite für alle JoJo-Staffeln; die Specials Recaps und Re-Edited (ohne-synchro) teilen sie (sharedWith 3).',
  },
  146722: {
    url: 'https://www.crunchyroll.com/de/series/GYP8DP1MY/jojos-bizarre-adventure',
    grund: 'Eine Serienseite für alle JoJo-Staffeln; die Specials Recaps und Re-Edited (ohne-synchro) teilen sie (sharedWith 3).',
  },
  187053: {
    url: 'https://www.amazon.de/gp/video/detail/B07XYDCVFK',
    grund: 'Prime-Seite „Sylvanian Families“ (12 Mini-Folgen): Cartoon -13247 und Anime „Mini Episodes – Ivy“ tragen je einen Handbeleg dafür; ob beide dasselbe Werk sind, ist offen.',
  },
}

export interface FremderBeleg {
  anilistId: number
  url: string
  fuehrtAuch: string[]
}

/** Handbelege von Titeln aus `titles.json`, deren Adresse auch ein Cartoon oder Titel ohne Synchro führt, ohne benannte Ausnahme. */
export function findeFremdeBelege(
  belege: BelegAdresse[],
  titelIds: ReadonlySet<number>,
  fremd: ReadonlyMap<string, string[]>,
  ausnahmen: Record<number, { url: string }> = SAMMELSEITEN,
): { offen: FremderBeleg[]; ausgenommen: number[] } {
  const offen: FremderBeleg[] = []
  const ausgenommen = new Set<number>()
  for (const b of belege) {
    if (!b.anilistId || !b.url || !titelIds.has(b.anilistId)) continue
    const fuehrt = fremd.get(ohneSprache(b.url))
    if (!fuehrt) continue
    const ausnahme = ausnahmen[b.anilistId]
    if (ausnahme && ohneSprache(ausnahme.url) === ohneSprache(b.url)) ausgenommen.add(b.anilistId)
    else offen.push({ anilistId: b.anilistId, url: b.url, fuehrtAuch: fuehrt })
  }
  return { offen, ausgenommen: [...ausgenommen] }
}
