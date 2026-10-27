import type { Title } from '@shared/types.ts'
import type { FilterState } from './filters.ts'
import { findeBlockade, type Blockade } from './suchhinweis-filter.ts'
import { hatKarte, nurMitSchalter, passtGenau, zaehleKarten, type ZusatzTreffer } from './suchhinweis-zaehlen.ts'

/** Was der Hinweis wissen muss: die Karten, die der Schalter dazuholt, und was den exakten Treffer versteckt. */
export interface Suchhinweis {
  zusatz: ZusatzTreffer
  blockade?: Blockade<Title>
}

export interface HinweisEingabe {
  /** Alle Titel der Datenbank mit dem Schalter „ohne deutsche Synchro“ und ohne ihn, beide vor dem Filter. */
  mit: Title[]
  ohne: Title[]
  /** Die Liste, die die Datenbank gerade zeigt. */
  sichtbar: Title[]
  suche: string
  filters: FilterState
  ohneSynchro: boolean
  gruppiert: boolean
  synonymeFuer: (id: number) => string[]
  /** Filtert wie die Ansicht, samt Suche (gibt zwischendurch ab). */
  filtere: (titel: Title[], f: FilterState) => Generator<void, Title[]>
  /** Passt ein einzelner Titel zu den Filtern? Die Suche bleibt außen vor: „exakt“ ist hier der Name. */
  passtZuFiltern: (t: Title, f: FilterState) => boolean
}

/** Der Hinweis zum Stand der Datenbank (Suche, Filter, Schalter). */
export function* berechneHinweisGen(e: HinweisEingabe): Generator<void, Suchhinweis> {
  const nurSchalter = nurMitSchalter(e.mit, e.ohne)
  const zusatz = zaehleKarten(yield* e.filtere(nurSchalter, e.filters), e.sichtbar, e.gruppiert, e.suche, e.synonymeFuer)
  const exakte = e.mit.filter((t) => passtGenau(t, e.suche, e.synonymeFuer(t.id)))
  /* Steht für einen exakten Namen schon eine Karte (bei zusammengefassten Staffeln auch die seiner Reihe), fehlt nichts zu erklären. */
  if (e.gruppiert && exakte.some((t) => hatKarte(t, e.sichtbar, true))) return { zusatz }
  const ueberSchalter = new Set(nurSchalter.map((t) => t.id))
  const kandidaten = exakte.map((titel) => ({ titel, nurMitSchalter: ueberSchalter.has(titel.id) }))
  return { zusatz, blockade: findeBlockade(kandidaten, e.filters, e.ohneSynchro, e.passtZuFiltern) }
}
