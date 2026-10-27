import { type KatalogEintrag } from './anilist.ts'
import { readJson } from './util.ts'

/**
 * Die Stammdaten der Katalog-Titel, die nur AniList kennt (11.10.2026, Daniel: nicht streichen, selbst pflegen).
 * Eingefroren, damit der Bau nicht mehr vom AniList-Abruf abhängt; Plan: daniel-zum-abarbeiten/berichte/eigene-stammdaten-plan-2026-10-11.md.
 */
export const EINGEFROREN_DATEI = 'data/stammdaten/anilist-eingefroren.json'

/** Die Liste der Titel ohne aniSearch-Treffer (`keiner`); nur diese werden eingefroren. */
export const ABGLEICH_LISTE = 'data/anisearch-katalog-abgleich.json'

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
  /** Zeitpunkt des letzten Nachtrags (`einfrieren-anilist.ts --nachtragen`); die Einträge davor bleiben unverändert. */
  nachgetragenAm?: string
  quelle: string
  eintraege: EingefrorenerEintrag[]
}

/** Kennungen mit Urteil `keiner` (kein aniSearch-Treffer), aufsteigend. */
export function ladeKeinerIds(): number[] {
  const liste = readJson<{ keiner?: { id: number }[] }>(ABGLEICH_LISTE, {}).keiner ?? []
  return liste.map((k) => k.id).sort((a, b) => a - b)
}

/** Kennungen aus `keiner`, die noch nicht eingefroren sind: der Bau müsste sie weiter bei AniList holen. */
export function nichtEingefroren(keiner: number[], eingefroren: { id: number }[]): number[] {
  const da = new Set(eingefroren.map((e) => e.id))
  return keiner.filter((id) => !da.has(id))
}

export function ladeEingefrorene(): EingefrorenerEintrag[] {
  return readJson<Partial<EingefrorenerBestand>>(EINGEFROREN_DATEI, {}).eintraege ?? []
}

/** Cache-Einträge, bei den eingefrorenen Kennungen ersetzt durch die eingefrorenen; ohne Cache leer (kein Teilkatalog aus nur der Datei). */
export function mischeKatalog(cache: KatalogEintrag[], eingefroren: KatalogEintrag[]): KatalogEintrag[] {
  if (!cache.length) return []
  const gesperrt = new Set(eingefroren.map((e) => e.id))
  return [...cache.filter((e) => !gesperrt.has(e.id)), ...eingefroren].sort((a, b) => a.id - b.id)
}

/**
 * Der Katalog für den Bau: der Abruf-Cache, bei den eingefrorenen Kennungen ersetzt durch die Datei im Repo.
 * Ohne warmen Cache bleibt er leer — die Aufrufer behandeln das wie bisher (Frühausstieg, letzte Ausgabe bleibt stehen).
 */
export function ladeKatalogEintraege(): KatalogEintrag[] {
  const cache = readJson<{ eintraege?: KatalogEintrag[] }>(KATALOG_CACHE, {}).eintraege ?? []
  return mischeKatalog(cache, ladeEingefrorene())
}
