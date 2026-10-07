/** Ein Bild aus TMDBs `/images`. */
export interface TmdbBild {
  file_path: string
  width: number
  height: number
  iso_639_1: string | null
}

/** Rangfolge der Sprachfassungen: dieselbe Bildsprache wie AniList zuerst. */
const SPRACHEN: (string | null)[] = ['ja', null, 'de', 'en']

/** Hochformat wie ein Cover (2:3 ≈ 0,667; AniList 460 × 644 = 0,714). */
export const istHochformat = (b: TmdbBild): boolean => b.width / b.height >= 0.64 && b.width / b.height <= 0.76

/** Das beste Plakat: erst nach Sprache, dann das breiteste. Ohne Hochformat gibt es keins. */
export function waehlePlakat(bilder: TmdbBild[]): TmdbBild | undefined {
  const hoch = bilder.filter(istHochformat)
  for (const sprache of SPRACHEN) {
    const passend = hoch.filter((b) => b.iso_639_1 === sprache).sort((a, b) => b.width - a.width)
    if (passend[0]) return passend[0]
  }
  return undefined
}

const schlicht = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * Ist dieser TMDB-Film unser Titel? Der Name muss (nach Entfernen von Zeichen und Schreibweise) einem unserer Namen gleichen und das Jahr
 * höchstens um eins abweichen — ein Name allein ist kein Beleg (CLAUDE.md, „Namensabgleich").
 */
export function passtFilm(namen: (string | undefined)[], jahr: number | undefined, r: { title?: string; original_title?: string; release_date?: string }): boolean {
  const ziel = new Set(namen.filter((n): n is string => Boolean(n)).map(schlicht))
  const gleich = [r.title, r.original_title].filter((n): n is string => Boolean(n)).some((n) => ziel.has(schlicht(n)))
  const j = Number(r.release_date?.slice(0, 4))
  return gleich && (!jahr || !j || Math.abs(j - jahr) <= 1)
}
