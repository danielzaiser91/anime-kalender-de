import { belegeUeberFolgenzahl } from './dub-confirmed.ts'

/**
 * Handbelege, deren Deutsch-Bereiche in der Zählung der Anbieter-Serie standen (Kengan Ashura S2 und Mushoku Tensei Cour 2 auf Netflix,
 * Spy × Family auf Disney+, 28.10.2026) und auf Staffelzählung umgerechnet wurden. Bei ihnen darf nach dem Verschmelzen kein Bereich
 * über der Folgenzahl des Titels stehen; allgemein gilt die Schwelle in `check-logic-bestand.ts`.
 */
export const STAFFELZAEHLUNG_IDS: readonly number[] = [127720, 140960, 146638]

type Beleg = Parameters<typeof belegeUeberFolgenzahl>[0][number]

/** Zeilen (Kennung, Plattform, Adresse, Zahlen) der Belege aus `STAFFELZAEHLUNG_IDS`, deren Bereiche die Folgenzahl überschreiten. */
export function staffelzaehlungVerletzt(verschmolzen: Beleg[], folgenJeTitel: ReadonlyMap<number, number>): string[] {
  return belegeUeberFolgenzahl(
    verschmolzen.filter((b) => STAFFELZAEHLUNG_IDS.includes(b.anilistId ?? -1)),
    folgenJeTitel,
  )
}
