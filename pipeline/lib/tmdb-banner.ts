import type { TmdbBild } from './tmdb-plakat.ts'

/** Breite, die TMDB als `w1280` ausliefert; schmalere Hintergrundbilder wären als Vorschaubild zu grob. */
export const BANNER_MIN_BREITE = 1280

/** Rangfolge der Sprachfassungen: ohne Schrift zuerst (das Bild trägt sonst fremde Titel), dann japanisch. */
const SPRACHEN: (string | null)[] = [null, 'ja', 'en', 'de']

/** Querformat 16:9 (1,78) mit Spielraum. */
const istQuerformat = (b: TmdbBild): boolean => b.width / b.height >= 1.7 && b.width / b.height <= 1.85

/** Das beste Hintergrundbild: Querformat ab `BANNER_MIN_BREITE`, erst nach Sprache, dann das breiteste; sonst keines. */
export function waehleBanner(bilder: TmdbBild[]): TmdbBild | undefined {
  const quer = bilder.filter((b) => istQuerformat(b) && b.width >= BANNER_MIN_BREITE)
  for (const sprache of SPRACHEN) {
    const passend = quer.filter((b) => b.iso_639_1 === sprache).sort((a, b) => b.width - a.width)
    if (passend[0]) return passend[0]
  }
  return undefined
}

/** Bestand `data/tmdb-banner.json`: Titelkennung → Pfad des Bildes, `null` = TMDB hat keins; `inhaltAm` = Tag des Abrufs. */
export type TmdbBanner = Record<string, { p: string; w: number; h: number; inhaltAm?: string } | null>

export const BANNER_DATEI = 'data/tmdb-banner.json'

/** Die ausgelieferte Adresse (`w1280`, wie bei den Cartoons). */
export const bannerAdresse = (pfad: string): string => `https://image.tmdb.org/t/p/w1280${pfad}`
