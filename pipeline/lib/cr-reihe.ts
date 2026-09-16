/**
 * **Führt eine Crunchyroll-Reihe ein Werk überhaupt?** Reine Regel ohne Abruf —
 * `fetch-crunchyroll-offene.ts` liefert Staffelliste, Katalogzahl und das
 * Ergebnis der Suche, `check-logic.ts` hält die gemessenen Fälle fest.
 *
 * Anlass (16.09.2026): Neun Verweise zeigten auf die Serienseite ihrer Reihe
 * und blieben ohne Urteil — Stone Ocean und Sword of the Wizard King (bei
 * Netflix), DxD-Mini-Episoden, Blue-Exorcist-OVA und -Film, ein
 * Kaguya-Special. Die Status-App zeigte sie als Crunchyroll-Pille, an der
 * niemand etwas melden konnte.
 */

export interface CrStaffel {
  titel: string
  folgen: number | null
  jahre: number[]
}

export interface CrWerk {
  format?: string | null
  episodes?: number | null
  jpYear?: number | null
}

const ARTEN: [RegExp, string[]][] = [
  [/\b(ova|oad)\b/i, ['OVA']],
  [/\b(movie|film)\b/i, ['MOVIE']],
  [/\b(specials?|mini|extra|bonus)\b/i, ['SPECIAL', 'TV_SHORT']],
]

/** Staffel-Tags nennen die Saison; ein Werk vom Winter kann dort im Folgejahr stehen. */
export function jahrPasst(jahre: number[], jahr: number): boolean {
  return jahre.some((j) => Math.abs(j - jahr) <= 1)
}

/**
 * Gibt den Grund zurück, wenn die Reihe das Werk nachweislich **nicht** führt,
 * sonst `undefined`. Der Befund gilt der Adresse und entfernt den Verweis —
 * deshalb müssen alle vier Bedingungen halten:
 *
 * 1. **Die Staffelliste ist vollständig**: ihre Folgen ergeben zusammen die
 *    Folgenzahl des Katalogeintrags. JoJo 158, Black Clover 171, DxD 49 gehen
 *    auf; Blue Exorcist (48 gegen 98) und Food Wars (68 gegen 31) nicht — und
 *    genau dort widersprachen Handbelege.
 * 2. **Keine Staffel nennt die Art des Werks** („OVA", „Movie", „Special").
 * 3. **Die Suche nennt nichts, was es anderswo sein könnte** (`andersWo`) —
 *    die AoT-OADs sind eine eigene Serie.
 * 4. **TV/ONA:** keine Staffel aus dem Startjahr (±1); eine Staffel ohne Jahr
 *    zählt nur mit gleicher Folgenzahl. **Nebenausgaben:** keine Staffel mit
 *    gleicher Folgenzahl, die nicht eine andere Art nennt (Black Clovers „OVA"
 *    mit einer Folge ist nicht der Film).
 */
export function reiheFuehrtEsNicht(
  werk: CrWerk,
  staffeln: CrStaffel[],
  katalogFolgen: number | null | undefined,
  andersWo: boolean,
): string | undefined {
  if (!staffeln.length) return undefined
  const summe = staffeln.reduce((n, s) => n + (s.folgen ?? 0), 0)
  if (!katalogFolgen || summe !== katalogFolgen) return undefined
  const format = String(werk.format ?? '')
  const eigeneArt = ARTEN.find(([, f]) => f.includes(format))?.[0]
  const fremdeArt = (titel: string) => ARTEN.some(([m, f]) => !f.includes(format) && m.test(titel))
  if (eigeneArt && staffeln.some((s) => eigeneArt.test(s.titel))) return undefined
  const folgen = Number.isFinite(werk.episodes) ? Number(werk.episodes) : format === 'MOVIE' ? 1 : null
  if (folgen == null || andersWo) return undefined
  if (format === 'TV' || format === 'ONA') {
    const jahr = Number(werk.jpYear)
    if (!jahr || !staffeln.some((s) => s.jahre.length)) return undefined
    if (staffeln.some((s) => jahrPasst(s.jahre, jahr))) return undefined
    if (staffeln.some((s) => !s.jahre.length && s.folgen === folgen)) return undefined
    return `die Reihe führt ${staffeln.length} Staffeln, keine aus ${jahr} — das Werk steht unter dieser Adresse nicht`
  }
  if (staffeln.some((s) => s.folgen === folgen && !fremdeArt(s.titel))) return undefined
  return `die Reihe führt ${staffeln.length} Staffeln, keine als ${format} und keine andere mit ${folgen} Folge(n) — das Werk steht unter dieser Adresse nicht`
}
