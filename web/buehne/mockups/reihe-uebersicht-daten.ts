/**
 * Feste Staffelwerte für Pokémon (Mockup `reihe-uebersicht`, 20.11.2026), bis die Staffeldaten geliefert werden (PR 4364).
 * Kennungen sind ak (wie in `faelle.json`). Eine Spanne steht nur dort, wo die Inventur die Grenzen belegt; die vier
 * Schwarz-&-Weiß-Einträge (Staffel 14–16 zusammen) und Reisen/Abenteuer (23–25 zusammen) teilen sich ihre Staffeln
 * nicht belegbar auf und zeigen deshalb nur den Namen.
 */
export const SAMMELTITEL_ID = 483

export const SPANNEN: Record<number, string> = {
  483: 'Staffel 1–5',
  1349: 'Staffel 6–9',
  1350: 'Staffel 10–13',
  6802: 'Staffel 17–18',
  7798: 'Staffel 19',
  8283: 'Staffel 20–22',
}

/** Letzte belegte deutsche Staffel der Reihe (Inventur: 25 Staffeln), für „Staffel 1–5 von 25“. */
export const STAFFELN_GESAMT = 25

/** TMDB-Staffeln 1 bis 5 des Sammeltitels „Pokémon“ mit Folgenzahl (82 + 36 + 41 + 52 + 65 = 276, passt zu `episodes`). */
export const SAMMELTITEL_STAFFELN: { nr: number; folgen: number }[] = [
  { nr: 1, folgen: 82 },
  { nr: 2, folgen: 36 },
  { nr: 3, folgen: 41 },
  { nr: 4, folgen: 52 },
  { nr: 5, folgen: 65 },
]
