/**
 * **Die Uhrzeit aus dem Wochenprogramm schlägt den API-Stempel desselben Tages** (27.10.2026, Psyren: live 15:30, richtig 16:30).
 *
 * Crunchyrolls API stempelt Folgen nach einer Zeitumstellung weiter mit der alten Zeit (`2026-10-26T14:30:00Z` = 16:30 MESZ, in Berlin
 * aber 15:30 MEZ), das Wochenprogramm zeigt die echte Ortszeit: 4 von 4 Paaren ab dem 25.10. wichen um genau 1 h ab, alle 15 davor
 * stimmten. Die nächste Umstellung ist am 28.03.2027 — dann wiederholt sich das. Belege liegen in `data/crunchyroll-woche-belege.json`.
 */
/** Nur die Felder, die hier gelesen werden (die Beleg-Datei selbst: `woche-beleg.ts`, bewusst nicht importiert: der Bau darf keinen Sammler-Code ziehen). */
export type WocheBelege = Record<string, { seriesId: string; datum: string; zeit: string | null; artikel: string }>

export interface ZeitAusWoche {
  zeit: string
  /** Der Wochenprogramm-Artikel, in dem die Zeit stand — steht als Quelle am Termin. */
  artikel: string
}

/** Die Beleg-Zeit für Serie und Tag, nur wenn alle deutschen Belege des Tages dieselbe Zeit tragen (sonst gibt es keine eindeutige). */
export function zeitAusWochenprogramm(belege: WocheBelege, seriesId: string | undefined, datum: string): ZeitAusWoche | undefined {
  const treffer = Object.values(belege).filter((b) => b.seriesId === seriesId && b.datum === datum && b.zeit)
  const zeiten = new Set(treffer.map((b) => b.zeit))
  if (zeiten.size !== 1) return undefined
  return { zeit: treffer[0]!.zeit!, artikel: treffer[0]!.artikel }
}

/** Die Herkunftszeile gibt an, wenn die Uhrzeit aus dem Wochenprogramm statt aus dem API-Stempel stammt. */
export function zeitHinweis(zeitQuelle: string | undefined): string {
  return zeitQuelle ? ' — Uhrzeit laut Crunchyroll-Wochenprogramm' : ''
}

/** Der Artikel kommt zu den Quellen des Termins, wenn er die Uhrzeit belegt. */
export function quellenMitZeit(quellen: string[], zeitQuelle: string | undefined): string[] {
  return zeitQuelle && !quellen.includes(zeitQuelle) ? [...quellen, zeitQuelle] : quellen
}
