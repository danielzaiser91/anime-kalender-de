/**
 * Bilanz vorher/nachher für Änderungen an der Zuordnung von Meldungen und Auto-Terminen (16.11.2026, Prüfer-Auflage B2 zu PR 4053):
 * Gemessen wird, was `meldungenAus` und `releasesAus` auf denselben Eingaben liefern; jede Abweichung steht einzeln im PR.
 */

/** Eine Zeile je Ergebnis: Titel-ID, Name, Anlass — stabil sortiert, damit zwei Läufe vergleichbar sind. */
export function bilanzZeilen(eintraege: { titleId: number; name?: string; anlass: string }[]): string[] {
  return eintraege.map((e) => `${e.titleId} | ${e.name ?? '?'} | ${e.anlass}`).sort()
}

export interface Unterschied {
  /** Nur vorher da (verloren oder umgehängt). */
  weg: string[]
  /** Nur nachher da (neu oder umgehängt). */
  neu: string[]
}

/** Vielfachmengen-Vergleich: zwei gleiche Zeilen vorher und eine nachher ergeben eine verlorene. */
export function unterschied(vorher: string[], nachher: string[]): Unterschied {
  const rest = new Map<string, number>()
  for (const z of nachher) rest.set(z, (rest.get(z) ?? 0) + 1)
  const weg: string[] = []
  for (const z of vorher) {
    const n = rest.get(z) ?? 0
    if (n > 0) rest.set(z, n - 1)
    else weg.push(z)
  }
  const neu = [...rest].flatMap(([z, n]) => Array<string>(n).fill(z))
  return { weg, neu: neu.sort() }
}
