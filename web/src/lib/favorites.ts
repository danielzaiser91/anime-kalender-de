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
  /*
    Das Datum wird beim Umschalten mitgeführt — an genau der Stelle, an der der
    Titel dazukommt oder geht. Ein späterer Abgleich „welche Kennung hat noch
    kein Datum" würde raten müssen.
  */
  const toggleMitDatum = (id: number) => {
    const vorher = has(id)
    toggle(id)
    favoritDatumPflegen(id, !vorher)
  }
  return { favorites: ids, isFavorite: has, toggle: toggleMitDatum, count }
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

/**
 * **Seit wann ein Titel gemerkt ist.**
 *
 * Daniel am 29.08.2026: „details evtl sichtbar sein (ab wann zu favorit
 * hinzugefügt oder sonstige infos die wir tracken)."
 *
 * Die Favoritenliste ist ein `Set<number>` und trägt kein Datum. Statt ihr
 * Format zu ändern — und damit jede vorhandene Liste im Browser eines Besuchers
 * anzufassen — steht das Datum daneben in einer eigenen Ablage.
 *
 * **Wer die Seite schon benutzt, verliert nichts.** Seine Favoriten bleiben; sie
 * tragen nur bis zum nächsten Antippen kein Datum, und die Anzeige schreibt dann
 * „schon länger" statt eines erfundenen Tages. Ein Datum zu erraten wäre die
 * schlechtere Lösung: Es sähe richtig aus und wäre falsch.
 */
const SEIT_SCHLUESSEL = 'favorites:seit'

function seitLesen(): Record<string, string> {
  try {
    const roh = localStorage.getItem(SEIT_SCHLUESSEL)
    if (!roh) return {}
    const geparst: unknown = JSON.parse(roh)
    return geparst && typeof geparst === 'object' ? (geparst as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** Wann dieser Titel gemerkt wurde — `undefined`, wenn es aus der Zeit davor stammt. */
export function favoritSeit(id: number): string | undefined {
  return seitLesen()[String(id)]
}

/**
 * Das Datum mitschreiben, wenn ein Titel gemerkt oder entfernt wird.
 *
 * Wird beim Umschalten aufgerufen: Neu hinzugefügt bekommt heute, entfernt
 * verliert seinen Eintrag — sonst behauptet ein später erneut gemerkter Titel,
 * er sei seit Monaten dabei.
 */
export function favoritDatumPflegen(id: number, gemerkt: boolean): void {
  try {
    const stand = seitLesen()
    if (gemerkt) stand[String(id)] = new Date().toISOString().slice(0, 10)
    else delete stand[String(id)]
    localStorage.setItem(SEIT_SCHLUESSEL, JSON.stringify(stand))
  } catch {
    /* Ohne Speicher fehlt nur die Angabe, nicht der Favorit. */
  }
}
