import type { FilterState } from './filters.ts'

/**
 * **Die Schnellfilter sind Vorlieben, keine Ansicht** (Daniel, 02.10.2026): Sie bleiben im Browser stehen,
 * nicht in der Adresse. „Disc ausblenden" verschwand sonst bei jedem Besuch, „TV ausblenden" blieb
 * (das liegt weiter unter `tvAus`, siehe `App.tsx`).
 *
 * Eine Adresse mit `fav=1` (Push-Nachricht) schaltet den Filter für diese Ansicht ein und merkt ihn sich nicht.
 */
export interface Vorlieben {
  favoritesOnly: boolean
  kostenlosOnly: boolean
  confirmedOnly: boolean
  availableOnly: boolean
  discAus: boolean
  favoritesExcluded: boolean
  kostenlosExcluded: boolean
  confirmedExcluded: boolean
  availableExcluded: boolean
}

const SCHLUESSEL = 'vorlieben'
const LEER: Vorlieben = { favoritesOnly: false, kostenlosOnly: false, confirmedOnly: false, availableOnly: false, discAus: false, favoritesExcluded: false, kostenlosExcluded: false, confirmedExcluded: false, availableExcluded: false }

export function vorliebenLesen(): Vorlieben {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}') as Partial<Vorlieben>
    return {
      favoritesOnly: roh.favoritesOnly === true,
      kostenlosOnly: roh.kostenlosOnly === true,
      confirmedOnly: roh.confirmedOnly === true,
      availableOnly: roh.availableOnly === true,
      discAus: roh.discAus === true,
      favoritesExcluded: roh.favoritesExcluded === true,
      kostenlosExcluded: roh.kostenlosExcluded === true,
      confirmedExcluded: roh.confirmedExcluded === true,
      availableExcluded: roh.availableExcluded === true,
    }
  } catch {
    /* Gesperrter Speicher oder kaputter Wert: dann gilt die Standardansicht. */
    return { ...LEER }
  }
}

/** Die Vorlieben, wie `filters` sie gerade zeigt. */
export function vorliebenAus(filters: FilterState): Vorlieben {
  return {
    favoritesOnly: filters.favoritesOnly,
    kostenlosOnly: filters.kostenlosOnly,
    confirmedOnly: filters.confirmedOnly,
    availableOnly: filters.availableOnly,
    discAus: filters.excluded.releaseTypes.includes('disc'),
    favoritesExcluded: filters.favoritesExcluded,
    kostenlosExcluded: filters.kostenlosExcluded,
    confirmedExcluded: filters.confirmedExcluded,
    availableExcluded: filters.availableExcluded,
  }
}

function vorliebenSchreiben(v: Vorlieben): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(v))
  } catch {
    /* Gesperrter Speicher: die Wahl gilt dann für diesen Besuch. */
  }
}

/**
 * Merkt sich, was sich zwischen `vorher` und `nachher` geändert hat — und nur das. Ein Filter, den nur die
 * Adresse eingeschaltet hat (`fav=1` aus der Push-Nachricht), wird dadurch nicht zur Vorliebe,
 * wenn jemand daneben einen anderen Schalter umlegt.
 */
export function vorliebenNachfuehren(vorher: FilterState, nachher: FilterState): void {
  const alt = vorliebenAus(vorher)
  const neu = vorliebenAus(nachher)
  const gemerkt = vorliebenLesen()
  let geaendert = false
  for (const k of Object.keys(LEER) as (keyof Vorlieben)[]) {
    if (alt[k] !== neu[k] && gemerkt[k] !== neu[k]) {
      gemerkt[k] = neu[k]
      geaendert = true
    }
  }
  if (geaendert) vorliebenSchreiben(gemerkt)
}
