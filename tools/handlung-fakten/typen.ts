/** Gemeinsame Typen und Pfade des Faktensammlers für eigene deutsche Handlungstexte (docs/wissen/datensatz.md, „Eigene Handlungstexte“). */

/** Nicht getrackter Ordner (`data/cache/` steht in `.gitignore`): Quelltexte und Faktenkarten gehören nie ins Repo. */
export const CACHE = 'data/cache/handlung-fakten'

// Kontakt: das Impressum der Projektseite (Route `#/impressum`; `/impressum` ohne Hash gibt es nicht), keine private Adresse.
export const UA = 'anime-kalender-de/1.0 (https://anime-kalender.de/#/impressum; Faktensammler fuer eigene Handlungstexte, hoechstens 1 Abruf je Sekunde)'

export type Ebene = 'titel' | 'reihe'
export type Einordnung = 'titel' | 'reihe' | 'zu dünn'

/** Ein Titel ohne deutsche Handlung samt allem, was der Sammler über ihn und seine Reihe schon weiß. */
export interface Luecke {
  id: number
  /** Archivseite dieses Titels; `geteilt`, wenn sie mehreren Titeln zugeordnet ist (dann beschreibt sie die Gruppe). */
  anisearchSeite?: number
  geteilt: boolean
  titleDe?: string
  titleEn?: string
  titleRomaji?: string
  format?: string
  episodes?: number
  jpYear?: number
  franchiseId?: number
  genres: string[]
  studios: string[]
  /** Namen der Reihe (frühestes Fernsehformat zuerst), für geratene Seitennamen. */
  reiheNamen: string[]
  geschwister: Geschwister[]
}

export interface Geschwister {
  id: number
  name: string
  anisearchSeite?: number
  /** Deutscher aniSearch-Text des Geschwistertitels aus `public/data/synopses`, wenn vorhanden. */
  deText?: string
}

export interface Quelle {
  art: 'wikipedia' | 'anisearch' | 'geschwister'
  ebene: Ebene
  name: string
  url: string
  lizenz: string
  hinweis?: string
  /** Wikipedia: Sprache und Seitenname nach Weiterleitung; aniSearch: Seitenkennung; Geschwister: Titelkennung. */
  sprache?: 'de' | 'en'
  seite?: string
  anisearchId?: number
  titelId?: number
}

export interface Quellsaetze {
  quelle: string
  ebene: Ebene
  aus: string
  saetze: string[]
  /** Sätze mit Wertung, Rezension oder Zitat, die nicht übernommen wurden. */
  entfernt: number
}

export interface Zaehlung {
  titelSaetze: number
  /** Davon aus Plot-Abschnitt oder Seitenbeschreibung (nicht aus der Einleitung). */
  titelPlot: number
  reiheSaetze: number
  quellen: number
}
