import { istQuellenAusfall, mediaByMalIds, type AniListMedia } from './anilist.ts'
import { log, readJson, warn, writeJson } from './util.ts'

/**
 * **Cover für Titel, die nur bei aniSearch stehen** (08.10.2026: „Dragon Ball Super: Beerus" und „Fool Night" hatten keines, AniList kennt beide). Die Datei liegt im Repo und nicht in `data/cache/`: Der Bau-Lauf sieht den Cache erst nach dem nächsten Wochenlauf.
 * Die Titelkennung bleibt `10000000 + aniSearch-Kennung`; nur das Bild kommt von AniList, über die MAL-Kennung des aniSearch-Eintrags.
 */
const CACHE = 'data/anisearch-cover.json'

const BLOCK = 50

type Eintrag = { y?: number; mal?: number; dub?: string }
type Treffer = { id: number; cover: string }

/**
 * MAL-Kennungen von aniSearch-Einträgen, zu denen AniList noch nichts im Bestand hat und der Cache kein Cover kennt. Einträge mit deutscher Fassung (d/p/c)
 * werden ohne Jahresgrenze gefragt, denn sie alle sind Titel im Hauptbestand (08.10.2026: 93 ältere ohne Cover); die übrigen nur ab `ab`, weil über 8.000
 * nur im Katalog stehen.
 */
export function malOhneAnilistTitel(eintraege: Record<string, Eintrag>, bekannteMal: Set<number>, cache: Record<string, Treffer>, ab: number): number[] {
  const mal = Object.values(eintraege)
    .filter((e): e is Eintrag & { mal: number } => Boolean(e.mal) && (e.dub !== '-' || (e.y ?? 0) >= ab) &&!bekannteMal.has(e.mal!) && !cache[String(e.mal)])
    .map((e) => e.mal)
  return [...new Set(mal)]
}

/**
 * Fragt AniList nach den fehlenden MAL-Kennungen, Block für Block (50 je Anfrage; Abstand und Rate-Limit-Wartezeit stecken in `gql`). Jugendfreie Treffer
 * mit Cover kommen in den Cache, der nach jedem Block geschrieben wird. Wen AniList nicht kennt, bleibt ohne Eintrag und wird im nächsten Lauf wieder
 * gefragt (Nichtauskunft ist kein Befund). Scheitert ein Block nach allen Wartezeiten, ruht der Abruf bis zum nächsten Lauf. Ausgenommen sind MAL-Kennungen, die wir ohnehin führen (`malBestand`, `aniBestand`). Gibt zurück, ob AniList ausgefallen war.
 */
export async function holeAnisearchCover(malBestand: Record<string, unknown>, aniBestand: Record<string, AniListMedia>): Promise<boolean> {
  const bekannteMal = new Set([...Object.keys(malBestand).map(Number), ...Object.values(aniBestand).flatMap((m) => (m.idMal ? [m.idMal] : []))])
  const cache = readJson<Record<string, Treffer>>(CACHE, {})
  const offen = malOhneAnilistTitel(readJson<Record<string, Eintrag>>('data/anisearch-eintraege.json', {}), bekannteMal, cache, new Date().getFullYear() - 1)
  if (!offen.length) return false
  let abgefragt = 0
  let ausgefallen = false
  try {
    for (let i = 0; i < offen.length; i += BLOCK) {
      const block = offen.slice(i, i + BLOCK)
      const gefunden = await mediaByMalIds(block, undefined, true)
      for (const [mal, m] of gefunden) {
        const cover = m.coverImage?.extraLarge ?? m.coverImage?.large
        if (!m.isAdult && cover) cache[String(mal)] = { id: m.id, cover }
      }
      abgefragt += block.length
      writeJson(CACHE, cache, true)
    }
  } catch (err) {
    if (!istQuellenAusfall(err) && !/rate-limit/i.test((err as Error).message)) throw err
    ausgefallen = true
    warn(`AniList-Abruf der aniSearch-Cover pausiert nach ${abgefragt} von ${offen.length} Kennungen, der Rest folgt im nächsten Lauf (${(err as Error).message})`)
  }
  log(`AniList-Cover für aniSearch-Titel: ${abgefragt} von ${offen.length} MAL-Kennungen abgefragt, ${Object.keys(cache).length} Cover im Cache`)
  return ausgefallen
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
