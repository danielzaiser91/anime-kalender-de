/**
 * **Eigene Titel** (`data/eigene-titel.yaml`): Titel aus einer belegten Ankündigung, die kein AniList-Eintrag trägt.
 * Ihre Kennung ist `EIGENE_ID_BASIS + nr`, höchstens eine Million Nummern. Der Raum liegt unter `ANISEARCH_ID_BASIS` (10 Mio., dort heißt die
 * Kennung „nur aniSearch“) und weit über den AniList-Kennungen (rund 220.000); die Kennungen 6 bis 10 Mio. bleiben frei, weil Prüfungen dort
 * ihre Testkennungen führen (9.000.0xx).
 */
export const EIGENE_ID_BASIS = 5_000_000
export const EIGENE_ID_ENDE = 6_000_000

/** Eigener Titel: keine AniList-Kennung, kein aniSearch-Zeilenschlüssel. */
export const istEigenerTitel = (id: number): boolean => id >= EIGENE_ID_BASIS && id < EIGENE_ID_ENDE

/**
 * Ohne eigene Titel — für „Erstmals mit deutscher Synchro“ (`neu-mit-synchro.json`): Die Meldung sagt, dass es vorher keine deutsche Fassung gab.
 * Bei einem Titel, den wir erst bei der Ankündigung kennenlernen, wissen wir das nicht; die Ankündigung („Start am …“) steht als eigene Meldung.
 */
export const ohneEigene = <T extends { id: number }>(titel: T[]): T[] => titel.filter((t) => !istEigenerTitel(t.id))
