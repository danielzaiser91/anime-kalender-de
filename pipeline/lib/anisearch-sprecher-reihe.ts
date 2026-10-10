import type { Sprecher } from './anisearch-sprecher.ts'

/** Hochzählen, sobald `sprecherAus()` ein Feld mehr liest. */
export const PARSER_STAND = 1
const ALTER_TAGE = 180

export interface Eintrag extends Sprecher {
  fetchedAt: string
  stand: number
}
export interface AnisearchEintrag {
  anisearchId?: number
  info?: { languages?: { language: string; dubbed?: boolean }[] }
}
/** aniSearch-ID → trägt die Marke „Deutsch synchronisiert". */
export type Katalog = Map<number, boolean>

export function katalogAus(anisearch: Record<string, AnisearchEintrag>): Katalog {
  const titel: Katalog = new Map()
  for (const e of Object.values(anisearch)) {
    if (!e.anisearchId) continue
    titel.set(e.anisearchId, !!e.info?.languages?.some((l) => l.language === 'Deutsch' && l.dubbed))
  }
  return titel
}

export function faellig(bestand: Record<string, Eintrag>, id: number, jetztMs: number): boolean {
  const e = bestand[String(id)]
  if (!e || e.stand < PARSER_STAND) return true
  return (jetztMs - Date.parse(e.fetchedAt)) / 86_400_000 >= ALTER_TAGE
}

/** Fällige Seiten, Titel ohne Synchro-Marke zuerst. */
export function warteschlange(katalog: Katalog, bestand: Record<string, Eintrag>, jetztMs: number): number[] {
  return [...katalog.entries()]
    .filter(([id]) => faellig(bestand, id, jetztMs))
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(([id]) => id)
}
