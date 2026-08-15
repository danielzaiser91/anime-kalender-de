import { createIdSet } from './idSet.ts'

/** Gemerkte Titel. Liegen im Browser des Nutzers, nicht auf einem Server. */
const favoritesSet = createIdSet('favorites')

/**
 * Fügt Kennungen hinzu, ohne etwas umzuschalten — **wiederholbar**.
 *
 * `toggle` ist hier falsch, und der Fehler ist bösartig: Läuft der Aufruf
 * zweimal, nimmt der zweite Lauf weg, was der erste hinzugefügt hat. Genau das
 * passiert in React im Entwicklungsmodus, wo `StrictMode` jeden Effekt doppelt
 * ausführt — gemessen am 14.08.2026: Der Abgleich schickte korrekt drei Titel
 * an den Server, im Browser blieb aber nur einer übrig.
 *
 * In der gebauten Fassung liefe der Effekt nur einmal, der Fehler wäre also
 * unsichtbar geblieben. Darauf zu bauen wäre trotzdem falsch: Jeder zweite
 * Durchlauf, aus welchem Grund auch immer, hätte dasselbe Ergebnis.
 */
export function favoritenErgaenzen(ids: number[]): void {
  if (!ids.length) return
  const jetzt = favoritesSet.read()
  for (const id of ids) jetzt.add(id)
  favoritesSet.write(jetzt)
}

export function useFavorites(): {
  favorites: Set<number>
  isFavorite: (id: number) => boolean
  toggle: (id: number) => void
  count: number
} {
  const { ids, has, toggle, count } = favoritesSet.use()
  return { favorites: ids, isFavorite: has, toggle, count }
}

/**
 * Ausgeblendete Titel.
 *
 * Gedacht für zwei Fälle: Ein Kalender, der auch von Jüngeren benutzt wird,
 * soll Bild und Schlagworte eines FSK-18-Titels nicht ungefragt zeigen. Und
 * wer eine bestimmte Serie schlicht nicht sehen will, soll sie loswerden,
 * ohne dass der Termin aus dem Kalender verschwindet.
 *
 * Deshalb wird nicht gefiltert, sondern verdeckt: Die Karte bleibt an ihrem
 * Platz, zeigt aber nur noch den Namen. Ein Filter würde den Tag stillschweigend
 * leerer machen, und man wüsste nie, dass da etwas war.
 */
const hiddenSet = createIdSet('hidden')

export function useHidden(): {
  hidden: Set<number>
  isHidden: (id: number) => boolean
  toggle: (id: number) => void
  count: number
} {
  const { ids, has, toggle, count } = hiddenSet.use()
  return { hidden: ids, isHidden: has, toggle, count }
}
