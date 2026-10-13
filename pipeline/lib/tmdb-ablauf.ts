/**
 * **TMDB darf nur sechs Monate zwischengespeichert werden** (API-Bedingungen 1.C, Wortlaut in `docs/wissen/quellen.md`, 12.10.2026).
 *
 * Wir fassen bei 150 Tagen an, damit zwischen Streichung und Frist (180 Tage) Läufe liegen. Was TMDB-Inhalt ist (Handlung, Name,
 * Anbieter, FSK), verfällt; die Zuordnung (`tmdbId`, `kind`, `jahr`) ist unser Urteil, welches Werk gemeint ist, und bleibt.
 */
export const STREICH_TAGE = 150
export const FRIST_TAGE = 180

/** Felder von `data/tmdb-titles.json`, die TMDB-Inhalt tragen. */
export const INHALTSFELDER = ['overviewDe', 'nameDe', 'fsk', 'providers', 'offers', 'justwatchUrl', 'kinoDe'] as const

export interface MitInhaltsstand {
  fetchedAt?: string
  /** Wann der Inhalt zuletzt von TMDB kam; `fetchedAt` auch dann, wenn ein Fehltreffer den Inhalt stehen ließ. */
  inhaltAm?: string
}

type Feld = Record<string, unknown>

export const hatInhalt = (e: MitInhaltsstand): boolean => INHALTSFELDER.some((f) => (e as Feld)[f] !== undefined)

/** Vollen Tage seit einem Stand (ISO-Datum); ohne Datum unbekannt (`undefined`). */
export function tageSeit(stand: string | undefined, jetzt: Date): number | undefined {
  const t = stand ? Date.parse(stand) : NaN
  return Number.isNaN(t) ? undefined : Math.floor((jetzt.getTime() - t) / 86_400_000)
}

/** Das Datum, ab dem die Frist zählt. */
export const inhaltsStand = (e: MitInhaltsstand): string | undefined => e.inhaltAm ?? e.fetchedAt

/** Entfernt den TMDB-Inhalt jedes Eintrags, dessen Stand älter als `STREICH_TAGE` ist (oder fehlt); gibt die Kennungen zurück. */
export function streicheAbgelaufenes(cache: Record<string, MitInhaltsstand>, jetzt: Date): string[] {
  const gestrichen: string[] = []
  for (const [id, e] of Object.entries(cache)) {
    if (!hatInhalt(e)) continue
    const alter = tageSeit(inhaltsStand(e), jetzt)
    if (alter !== undefined && alter <= STREICH_TAGE) continue
    for (const f of INHALTSFELDER) delete (e as Feld)[f]
    gestrichen.push(id)
  }
  return gestrichen
}
