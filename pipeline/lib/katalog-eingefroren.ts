import { type KatalogEintrag } from './anilist.ts'
import { readJson } from './util.ts'

/**
 * Die Stammdaten der Katalog-Titel, die nur AniList kennt (11.10.2026, Daniel: nicht streichen, selbst pflegen).
 * Eingefroren, damit der Bau nicht mehr vom AniList-Abruf abhängt; Plan: daniel-zum-abarbeiten/berichte/eigene-stammdaten-plan-2026-10-11.md.
 */
export const EINGEFROREN_DATEI = 'data/stammdaten/anilist-eingefroren.json'

const KATALOG_CACHE = 'data/cache/anilist-katalog.json'

/** Ein Katalogeintrag plus die Felder, die der Katalog nicht führt (der Bau liest sie nicht). */
export interface EingefrorenerEintrag extends KatalogEintrag {
  /** Laufzeit je Folge in Minuten. */
  dauer?: number
  /** Ende laut AniList, so genau wie belegt („2008", „2008-03", „2008-03-31"). */
  ende?: string
  /** Saison des Starts (WINTER, SPRING, SUMMER, FALL). */
  saison?: string
  /** Herkunftsland auch bei Japan (`land` führt es nur, wenn es nicht JP ist). */
  herkunftsland?: string
}

export interface EingefrorenerBestand {
  eingefrorenAm: string
  quelle: string
  eintraege: EingefrorenerEintrag[]
}

export function ladeEingefrorene(): EingefrorenerEintrag[] {
  return readJson<Partial<EingefrorenerBestand>>(EINGEFROREN_DATEI, {}).eintraege ?? []
}

/**
 * Der Katalog für den Bau: die Einträge aus dem Abruf-Cache, bei den eingefrorenen Kennungen ersetzt durch die Datei im Repo.
 * Ohne warmen Cache bleibt es leer — die Aufrufer behandeln das wie bisher (Frühausstieg, letzte Ausgabe bleibt stehen).
 */
export function ladeKatalogEintraege(): KatalogEintrag[] {
  const cache = readJson<{ eintraege?: KatalogEintrag[] }>(KATALOG_CACHE, {}).eintraege ?? []
  if (!cache.length) return []
  const eingefroren = ladeEingefrorene()
  const gesperrt = new Set(eingefroren.map((e) => e.id))
  return [...cache.filter((e) => !gesperrt.has(e.id)), ...eingefroren].sort((a, b) => a.id - b.id)
}
