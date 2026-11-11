/**
 * Maße der TMDB-Cover der Cartoons in Größe `w342` (`data/cartoon-cover-masse.json`), damit die Link-Vorschau einer Titelseite das Cover
 * als `og:image` führen kann. `data/tmdb-poster.json` kennt nur Anime-Plakate (Schlüssel AniList-Kennung), die Cartoon-Pfade fehlen dort;
 * gemessen wird die w342-Datei selbst (Abruf von `image.tmdb.org`, wie das Cover auf der Seite), nicht das Original.
 */
import type { Title } from '../../shared/types.ts'
import { bildMasse, MAX_BYTES } from './anilist-cover-masse.ts'
import type { PlakatMasse } from './titel-vorschau.ts'

export const TMDB_W342 = 'https://image.tmdb.org/t/p/w342'
/** Pfad der Datei (`/abc.jpg`) in einer w342-Adresse. */
const COVER_W342 = /^https:\/\/image\.tmdb\.org\/t\/p\/w342(\/[\w.-]+\.jpg)$/
/** Breite einer vollen w342-Datei; schmalere Originale tragen die Seite nicht (Breite im Kopf muss zur Größe im Pfad passen). */
export const BREITE_W342 = 342

/** Schlüssel `Breite, Höhe, Bytes` je Pfad (`/abc.jpg`). */
export type CartoonMasse = Record<string, readonly [number, number, number]>

export function cartoonPfad(url: string | undefined): string | undefined {
  return url ? COVER_W342.exec(url)?.[1] : undefined
}

/** Schlüssel in der Maße-Tabelle der Vorschau; getrennt von den Original-Plakatpfaden (`/abc.jpg`). */
export function cartoonSchluessel(pfad: string): string {
  return `cartoon:${pfad}`
}

/** Brauchbare Cover (volle Breite, klein genug) als Maße für `vorschauBild`. */
export function cartoonMasse(bestand: CartoonMasse): PlakatMasse {
  const masse = new Map<string, readonly [number, number]>()
  for (const [pfad, [w, h, bytes]] of Object.entries(bestand)) {
    if (bytes <= MAX_BYTES && w === BREITE_W342 && h > 0) masse.set(cartoonSchluessel(pfad), [w, h])
  }
  return masse
}

/** w342-Cover der Titel, zu denen noch keine Messung vorliegt (je Pfad einmal). */
export function ungemesseneCartoon(titel: Pick<Title, 'coverImage'>[], bestand: CartoonMasse): string[] {
  const offen = new Set<string>()
  for (const t of titel) {
    const pfad = cartoonPfad(t.coverImage)
    if (pfad && !(pfad in bestand)) offen.add(pfad)
  }
  return [...offen]
}

/** Ruft höchstens `limit` ungemessene Cover ab; nur eine eindeutige Antwort (200, lesbarer Kopf) zählt. */
export async function messeCartoon(
  pfade: string[],
  bestand: CartoonMasse,
  limit: number,
  hole: (url: string) => Promise<{ status: number; bytes: Buffer }>,
  schlafen: () => Promise<void>,
): Promise<number> {
  let gemessen = 0
  for (const pfad of pfade.slice(0, limit)) {
    try {
      const { status, bytes } = await hole(`${TMDB_W342}${pfad}`)
      const m = status === 200 ? bildMasse(bytes) : undefined
      if (m) {
        bestand[pfad] = [m[0], m[1], bytes.length]
        gemessen++
      }
    } catch {
      /* Nichtauskunft: ungemessen lassen */
    }
    await schlafen()
  }
  return gemessen
}
