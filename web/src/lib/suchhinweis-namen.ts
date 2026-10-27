import { PLATFORMS, type PlatformId } from '@shared/types.ts'
import type { FilterState } from './filters.ts'
import type { Einheit } from './suchhinweis-filter.ts'

const LISTE: Record<string, string> = {
  platforms: 'Plattform',
  providers: 'Anbieter',
  releaseTypes: 'Art',
  statuses: 'Status',
  fsk: 'FSK',
  years: 'Jahr',
  genres: 'Genre',
  keywords: 'Schlagwort',
  sprecher: 'Sprecher',
  land: 'Herkunft',
}

const SCHALTER: Record<string, string> = {
  favoritesOnly: 'nur Favoriten',
  kostenlosOnly: 'nur kostenlos',
  confirmedOnly: 'nur bestätigte Termine',
  availableOnly: 'nur verfügbar',
  favoritesExcluded: 'ohne Favoriten',
  kostenlosExcluded: 'ohne Kostenloses',
  confirmedExcluded: 'ohne bestätigte Termine',
  availableExcluded: 'ohne Verfügbares',
  zweitanbieterExcluded: 'ohne Zweitanbieter',
}

function werteVon(e: Einheit, f: FilterState, tGenre: (g: string) => string): string[] {
  const quelle = e.art === 'ausschluss' ? f.excluded : f
  const werte = quelle[e.feld as keyof typeof quelle] as (string | number)[]
  if (e.feld === 'platforms') return werte.map((w) => PLATFORMS[w as PlatformId]?.name ?? String(w))
  if (e.feld === 'genres') return werte.map((w) => tGenre(String(w)))
  return werte.map(String)
}

/** „Jahr 2003“, „ohne Genre Action“, „nur bestätigte Termine“ — der gesetzte Filter, wie ihn der Nutzer kennt. */
export function einheitName(e: Einheit, f: FilterState, tGenre: (g: string) => string): string {
  if (e.art === 'schalter') return SCHALTER[e.feld] ?? e.feld
  if (e.art === 'vertrauen') return 'Mindest-Vertrauen'
  const werte = werteVon(e, f, tGenre).join(', ')
  return `${e.art === 'ausschluss' ? 'ohne ' : ''}${LISTE[e.feld] ?? e.feld} ${werte}`
}
