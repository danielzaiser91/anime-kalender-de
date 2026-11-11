/**
 * Maße und Größe der eigenen aniSearch-Kopien (`data/cover-eigen-masse.json`, Bucket `cover.anime-kalender.de`), damit die Link-Vorschau
 * einer Titelseite die Kopie als `og:image` führen kann. Das Manifest `data/cover-eigen.json` kennt nur die Bytes; die Höhe steht nur in der
 * Datei. Gemessen wird an der eigenen Domain, nie an aniSearch. Die Größengrenze ist dieselbe wie bei AniList-Covern (`MAX_BYTES`).
 */
import type { Title } from '../../shared/types.ts'
import { MAX_BYTES, MIN_BREITE } from './anilist-cover-masse.ts'
import type { PlakatMasse } from './titel-vorschau.ts'

export const EIGENE_BASIS = 'https://cover.anime-kalender.de/'
const EIGENE_COVER = /^https:\/\/cover\.anime-kalender\.de\/(anisearch\/\d+\.webp)$/

/** Schlüssel `Breite, Höhe, Bytes` je Datei (`anisearch/126.webp`). */
export type EigeneMasse = Record<string, readonly [number, number, number]>

export function eigeneDatei(url: string | undefined): string | undefined {
  return url ? EIGENE_COVER.exec(url)?.[1] : undefined
}

/** Schlüssel in der Maße-Tabelle der Vorschau; getrennt von TMDB-Pfaden und AniList-Schlüsseln. */
export function eigenSchluessel(datei: string): string {
  return `eigen:${datei}`
}

/** Brauchbare Kopien (klein genug, breit genug) als Maße für `vorschauBild`. */
export function eigeneMasse(bestand: EigeneMasse): PlakatMasse {
  const masse = new Map<string, readonly [number, number]>()
  for (const [datei, [w, h, bytes]] of Object.entries(bestand)) {
    if (bytes <= MAX_BYTES && w >= MIN_BREITE && h > 0) masse.set(eigenSchluessel(datei), [w, h])
  }
  return masse
}

/** Breite und Höhe aus dem Kopf einer WebP-Datei (VP8, VP8L, VP8X), sonst nichts. */
export function webpMasse(b: Buffer): [number, number] | undefined {
  if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return undefined
  const art = b.toString('latin1', 12, 16)
  if (art === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]
  if (art === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1]
  if (art === 'VP8L' && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21)
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
  }
  return undefined
}

/** Eigene Kopien der Titel, zu denen noch keine Messung vorliegt (je Datei einmal). */
export function ungemesseneEigene(titel: Pick<Title, 'coverImage'>[], bestand: EigeneMasse): string[] {
  const offen = new Set<string>()
  for (const t of titel) {
    const datei = eigeneDatei(t.coverImage)
    if (datei && !(datei in bestand)) offen.add(datei)
  }
  return [...offen]
}

/** Ruft höchstens `limit` ungemessene Kopien von der eigenen Domain ab; nur eine eindeutige Antwort (200, lesbarer Kopf) zählt. */
export async function messeEigene(
  dateien: string[],
  bestand: EigeneMasse,
  limit: number,
  hole: (url: string) => Promise<{ status: number; bytes: Buffer }>,
  schlafen: () => Promise<void>,
): Promise<number> {
  let gemessen = 0
  for (const datei of dateien.slice(0, limit)) {
    try {
      const { status, bytes } = await hole(`${EIGENE_BASIS}${datei}`)
      const m = status === 200 ? webpMasse(bytes) : undefined
      if (m) {
        bestand[datei] = [m[0], m[1], bytes.length]
        gemessen++
      }
    } catch {
      /* Nichtauskunft: ungemessen lassen */
    }
    await schlafen()
  }
  return gemessen
}
