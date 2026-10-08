import { istQuellenAusfall, mediaByMalIds, type AniListMedia } from './anilist.ts'
import { log, readJson, warn, writeJson } from './util.ts'

/**
 * **Cover für Titel, die nur bei aniSearch stehen** (08.10.2026: „Dragon Ball Super: Beerus" und „Fool Night" hatten keines, AniList kennt beide).
 * Die Titelkennung bleibt `10000000 + aniSearch-Kennung`; nur das Bild kommt von AniList, über die MAL-Kennung des aniSearch-Eintrags.
 */
const CACHE = 'data/cache/anilist-anisearch-mal.json'

type Eintrag = { y?: number; mal?: number }
type Treffer = { id: number; cover: string }

/** MAL-Kennungen junger aniSearch-Einträge, zu denen AniList noch nichts im Bestand hat und der Cache kein Cover kennt. */
export function malOhneAnilistTitel(eintraege: Record<string, Eintrag>, bekannteMal: Set<number>, cache: Record<string, Treffer>, ab: number): number[] {
  const mal = Object.values(eintraege)
    .filter((e): e is Eintrag & { mal: number } => Boolean(e.mal) && (e.y ?? 0) >= ab && !bekannteMal.has(e.mal!) && !cache[String(e.mal)])
    .map((e) => e.mal)
  return [...new Set(mal)]
}

/**
 * Fragt AniList nach den fehlenden MAL-Kennungen (Blöcke zu 50, Rate-Limit-Wartezeit steckt in `mediaByMalIds`). Jugendfreie Treffer mit Cover
 * kommen in den Cache. Ausgenommen sind MAL-Kennungen, die wir ohnehin führen (`malBestand`, `aniBestand`). Gibt zurück, ob AniList ausgefallen war.
 */
export async function holeAnisearchCover(malBestand: Record<string, unknown>, aniBestand: Record<string, AniListMedia>): Promise<boolean> {
  const bekannteMal = new Set([...Object.keys(malBestand).map(Number), ...Object.values(aniBestand).flatMap((m) => (m.idMal ? [m.idMal] : []))])
  const cache = readJson<Record<string, Treffer>>(CACHE, {})
  const offen = malOhneAnilistTitel(readJson<Record<string, Eintrag>>('data/anisearch-eintraege.json', {}), bekannteMal, cache, new Date().getFullYear() - 1)
  if (!offen.length) return false
  try {
    const gefunden = await mediaByMalIds(offen)
    for (const [mal, m] of gefunden) {
      const cover = m.coverImage?.extraLarge ?? m.coverImage?.large
      if (!m.isAdult && cover) cache[String(mal)] = { id: m.id, cover }
    }
  } catch (err) {
    if (!istQuellenAusfall(err)) throw err
    warn(`AniList ist gerade nicht erreichbar — aniSearch-Cover übersprungen (${(err as Error).message})`)
    return true
  }
  writeJson(CACHE, cache, true)
  log(`AniList-Cover für aniSearch-Titel: ${offen.length} MAL-Kennungen abgefragt, ${Object.keys(cache).length} Cover im Cache`)
  return false
}

/** Kennung des aniSearch-Titels → Cover-Adresse von AniList, aus dem Cache. */
export function anisearchCoverAusCache(basis: number): Map<number, string> {
  const eintraege = readJson<Record<string, Eintrag>>('data/anisearch-eintraege.json', {})
  const cache = readJson<Record<string, Treffer>>(CACHE, {})
  const aus = new Map<number, string>()
  for (const [schluessel, e] of Object.entries(eintraege)) {
    const t = e.mal ? cache[String(e.mal)] : undefined
    if (t) aus.set(basis + Number(schluessel), t.cover)
  }
  return aus
}
