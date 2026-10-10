import { zurueckgestellt, type WegListe } from './anisearch-archiv-vorrang.ts'
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

export interface Luecken {
  haupt: number[]
  katalog: number[]
}

/**
 * **Die Vorrangliste für Sprecherseiten:** zuerst die Lücken im Hauptbestand (Titel mit Synchro-Marke vor dem Rest), danach der Katalog (ohne Marke zuerst, wie bisher).
 * Eine Lücke ist eine fällige Kennung, die nicht nach einer endgültigen Auskunft (404/410) noch in der Frist steht. Jede Kennung steht einmal — auch wenn sich
 * mehrere Titel eine teilen (117 Titel, 10.10.2026).
 */
export function sprecherLuecken(e: {
  haupt: number[]
  katalog: Katalog
  bestand: Record<string, Eintrag>
  weg: WegListe
  jetztMs: number
}): Luecken {
  const offen = (id: number): boolean => faellig(e.bestand, id, e.jetztMs) && !zurueckgestellt(e.weg, id, e.jetztMs)
  const imHaupt = new Set(e.haupt)
  const markiert = (id: number): number => Number(e.katalog.get(id) === true)
  return {
    haupt: [...imHaupt].filter(offen).sort((a, b) => markiert(b) - markiert(a)),
    katalog: [...e.katalog.keys()].filter((id) => !imHaupt.has(id) && offen(id)).sort((a, b) => markiert(a) - markiert(b)),
  }
}
