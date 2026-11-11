/**
 * Maße und Größe der AniList-Cover (`data/anilist-cover-masse.json`), damit die Link-Vorschau einer Titelseite das Cover als
 * `og:image` führen kann. WhatsApp zeigt eine Karte nur mit Maßen im Kopf und einer Datei bis etwa 300 KB; AniList nennt
 * weder Höhe noch Dateigröße, also wird jede Datei einmal abgerufen (Dateiname trägt einen Hash: der Inhalt ändert sich nie).
 *
 * Messung 06.11.2026 an allen 465 Covern von `titles.json`: `medium` 200–230 px breit (höchstens 192 KB), `large` 400–460 px
 * (33–726 KB, 95 über 300 KB; PNG-Cover sind die großen). Hotlink-Regeln: `s4.anilist.co/robots.txt` sperrt Bilder nicht, die Cover
 * sind erlaubt (Entscheidung Daniel, Memory project-cover-quellen).
 */
import type { PlakatMasse } from './titel-vorschau.ts'

/** Größe und Dateiname des Covers (`large/bx44-….png`, `medium/365.jpg`), nur auf dem AniList-Bilderdienst. */
const ANILIST_COVER = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/((?:large|medium)\/[\w.-]+\.(?:jpg|png))$/

/** Größte Datei, die als Vorschau taugt (WhatsApp: um 300 KB, 50 KB Luft). */
export const MAX_BYTES = 250_000
/** Schmalste Breite einer brauchbaren Vorschau (kleinste gemessene: 200). */
export const MIN_BREITE = 200

/** Schlüssel `Breite, Höhe, Bytes` je Cover (`large/…` oder `medium/…`). */
export type CoverMasse = Record<string, readonly [number, number, number]>

export function coverDatei(url: string | undefined): string | undefined {
  return url ? ANILIST_COVER.exec(url)?.[1] : undefined
}

/** Schlüssel in der Maße-Tabelle der Vorschau; getrennt von den TMDB-Pfaden (`/abc.jpg`). */
export function coverSchluessel(datei: string): string {
  return `anilist:${datei}`
}

/** Brauchbare Cover (klein genug, breit genug) als Maße für `vorschauBild`. */
export function anilistMasse(bestand: CoverMasse): PlakatMasse {
  const masse = new Map<string, readonly [number, number]>()
  for (const [datei, [w, h, bytes]] of Object.entries(bestand)) {
    if (bytes <= MAX_BYTES && w >= MIN_BREITE && h > 0) masse.set(coverSchluessel(datei), [w, h])
  }
  return masse
}

/** Breite und Höhe aus dem Dateikopf von PNG und JPEG, sonst nichts. */
export function bildMasse(b: Buffer): [number, number] | undefined {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)]
  if (b[0] !== 0xff || b[1] !== 0xd8) return undefined
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]
    i += 2 + b.readUInt16BE(i + 2)
  }
  return undefined
}

/** Cover-Adressen, zu denen noch keine Messung vorliegt (je Datei einmal). */
export function ungemessene(covers: (string | undefined)[], bestand: CoverMasse): string[] {
  const offen = new Set<string>()
  for (const url of covers) {
    const datei = coverDatei(url)
    if (url && datei && !(datei in bestand)) offen.add(url)
    const klein = mediumFassung(url)
    const kleinDatei = coverDatei(klein)
    if (klein && kleinDatei && unbrauchbar(bestand[datei ?? '']) && !(kleinDatei in bestand)) offen.add(klein)
  }
  return [...offen]
}

/** Die kleine Fassung (`medium/…`) desselben Covers, nur für eine `large/…`-Adresse. */
export function mediumFassung(url: string | undefined): string | undefined {
  return url && coverDatei(url)?.startsWith('large/') ? url.replace('/cover/large/', '/cover/medium/') : undefined
}

/** Gemessen, aber als Vorschau unbrauchbar (zu groß oder zu schmal). */
function unbrauchbar(m: CoverMasse[string] | undefined): boolean {
  return m !== undefined && (m[2] > MAX_BYTES || m[0] < MIN_BREITE)
}

/**
 * Ruft höchstens `limit` ungemessene Cover ab und trägt Breite, Höhe und Größe ein. Nur eine eindeutige Antwort (200 mit lesbarem Kopf)
 * zählt; Fehler und andere Status bleiben ungemessen und kommen im nächsten Lauf wieder dran.
 */
export async function messeCover(
  adressen: string[],
  bestand: CoverMasse,
  limit: number,
  hole: (url: string) => Promise<{ status: number; bytes: Buffer }>,
  schlafen: () => Promise<void>,
): Promise<number> {
  let gemessen = 0
  for (const url of adressen.slice(0, limit)) {
    try {
      const { status, bytes } = await hole(url)
      const m = status === 200 ? bildMasse(bytes) : undefined
      const datei = coverDatei(url)
      if (m && datei) {
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
