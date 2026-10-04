import { CARTOON_KEYWORD, toggleFilter, type FilterState } from './filters.ts'

/**
 * **Schnellfilter mit zwei Stellungen** (Daniel, 04.10.2026): Jeder trägt unter seinem Namen ✅ (nur das zeigen)
 * und 🚫 (das ausblenden); höchstens eines von beiden ist aktiv, ein zweiter Klick auf dasselbe schaltet aus.
 *
 * Die Zustände liegen dort, wo sie schon lagen — Favoriten, kostenlos, bestätigt und verfügbar in eigenen Feldern
 * (mit je einem Gegenstück `…Excluded`), Disc und Cartoon in den Listen des Filters, TV im Schalter der Ansicht.
 */
export type SchnellId = 'favoriten' | 'kostenlos' | 'bestaetigt' | 'tv' | 'disc' | 'verfuegbar' | 'cartoon'
export type SchnellZiel = 'ja' | 'nein'

const FELD = {
  favoriten: ['favoritesOnly', 'favoritesExcluded'],
  kostenlos: ['kostenlosOnly', 'kostenlosExcluded'],
  bestaetigt: ['confirmedOnly', 'confirmedExcluded'],
  verfuegbar: ['availableOnly', 'availableExcluded'],
} as const

export function schnellZustand(f: FilterState, id: SchnellId, tvAn?: boolean): SchnellZiel | undefined {
  if (id === 'tv') return tvAn === false ? 'nein' : f.platforms.includes('tv') ? 'ja' : undefined
  if (id === 'disc') return f.releaseTypes.includes('disc') ? 'ja' : f.excluded.releaseTypes.includes('disc') ? 'nein' : undefined
  if (id === 'cartoon') return f.keywords.includes(CARTOON_KEYWORD) ? 'ja' : f.excluded.keywords.includes(CARTOON_KEYWORD) ? 'nein' : undefined
  const [nur, ohne] = FELD[id]
  return f[nur] ? 'ja' : f[ohne] ? 'nein' : undefined
}

/** Das Ergebnis eines Klicks: der neue Filter und, nur bei TV, der neue Stand des TV-Schalters. */
export function schnellSetzen(f: FilterState, id: SchnellId, ziel: SchnellZiel, tvAn?: boolean): { filters: FilterState; tvAn?: boolean } {
  const jetzt = schnellZustand(f, id, tvAn)
  const modus = ziel === 'ja' ? 'include' : 'exclude'
  if (id === 'disc') return { filters: toggleFilter(f, 'releaseTypes', 'disc', modus) }
  if (id === 'cartoon') return { filters: toggleFilter(f, 'keywords', CARTOON_KEYWORD, modus) }
  if (id === 'tv') {
    /* „Nein" ist der Schalter der Ansicht (TV ausblenden), „ja" der Einschluss der Plattform. */
    const ohnePlattform = f.platforms.includes('tv') ? toggleFilter(f, 'platforms', 'tv', 'include') : f
    if (ziel === 'nein') return jetzt === 'nein' ? { filters: f, tvAn: true } : { filters: ohnePlattform, tvAn: false }
    if (jetzt === 'ja') return { filters: ohnePlattform, tvAn }
    return { filters: toggleFilter(f, 'platforms', 'tv', 'include'), tvAn: true }
  }
  const [nur, ohne] = FELD[id]
  const an = jetzt !== ziel
  return { filters: { ...f, [nur]: ziel === 'ja' && an, [ohne]: ziel === 'nein' && an } }
}
