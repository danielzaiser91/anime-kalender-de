import { filterMode, toggleFilter, type FilterState, type ListKey } from './filters.ts'
import { schnellSetzen, schnellZustand, type SchnellId, type SchnellZiel } from './schnellfilter.ts'

/**
 * **Jeder Tipp auf eine Filter-Pille schaltet reihum** nichts → ausgewählt → ausgeschlossen → nichts
 * (Daniel, 04.11.2026; ersetzt den Klick-Modus). Kennt eine Pille einen Zustand nicht, überspringt der Zyklus ihn.
 */
export type FilterZustand = 'nichts' | 'ja' | 'nein'

const REIHE: readonly FilterZustand[] = ['nichts', 'ja', 'nein']

/** Der Zustand nach einem Tipp: der nächste erlaubte in der Reihe, sonst der erste (also „nichts“). */
export function naechsterZustand(jetzt: FilterZustand, erlaubt: readonly FilterZustand[] = REIHE): FilterZustand {
  const ab = REIHE.indexOf(jetzt)
  for (let i = 1; i <= REIHE.length; i++) {
    const kandidat = REIHE[(ab + i) % REIHE.length]
    if (erlaubt.includes(kandidat)) return kandidat
  }
  return jetzt
}

/** Das Ziel, das `toggleFilter`/`schnellSetzen` brauchen: „nichts“ hebt den bisherigen Zustand auf, also zielt es auf diesen. */
function zielNachTipp(jetzt: FilterZustand, erlaubt?: readonly FilterZustand[]): SchnellZiel {
  const n = naechsterZustand(jetzt, erlaubt)
  return (n === 'nichts' ? jetzt : n) === 'ja' ? 'ja' : 'nein'
}

/** Pillen mit Listenwert (Anbieter, Genre, Schlagwort, Herkunft …): alle drei Zustände. */
export function zyklusFilter<K extends ListKey>(filters: FilterState, key: K, value: FilterState[K][number]): FilterState {
  const jetzt = filterMode(filters, key, value)
  const ziel = zielNachTipp(jetzt === 'include' ? 'ja' : jetzt === 'exclude' ? 'nein' : 'nichts')
  return toggleFilter(filters, key, value, ziel === 'ja' ? 'include' : 'exclude')
}

/** Schnell-Chips, die nur „ausblenden“ kennen (kein „nur anzeigen“). */
const NUR_NEIN: readonly SchnellId[] = ['zweitanbieter']

export function schnellErlaubt(id: SchnellId): readonly FilterZustand[] {
  return NUR_NEIN.includes(id) ? ['nichts', 'nein'] : REIHE
}

/** Ein Tipp auf einen Schnell-Chip; Ergebnis wie `schnellSetzen`. */
export function schnellZyklus(f: FilterState, id: SchnellId, tvAn?: boolean): { filters: FilterState; tvAn?: boolean } {
  const jetzt = schnellZustand(f, id, tvAn) ?? 'nichts'
  return schnellSetzen(f, id, zielNachTipp(jetzt, schnellErlaubt(id)), tvAn)
}
