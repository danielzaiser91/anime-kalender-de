import { type ErstausgabeVonHand } from './erstausgabe-von-hand.ts'

/**
 * `deFolgen` von Hand gegen den Bestand. Fehler: Titel fehlt oder die Folgenzahl des Werks fehlt (die Teilsynchro-Angabe verschwindet dann still).
 * Hinweis: n liegt nicht unter den Folgen des Werks, die Synchro ist vollständig und der Eintrag nur überholt.
 */
export function bewerteDeutscheFolgenzahl(
  eintraege: ErstausgabeVonHand[],
  titel: Map<number, { episodes?: number }>,
  zurueckgestellt: Set<number>,
): { fehler: string[]; hinweise: number[] } {
  const fehler: string[] = []
  const hinweise: number[] = []
  for (const e of eintraege) {
    if (!e.deFolgen) continue
    const id = e.anilistId ?? 0
    const t = titel.get(id)
    if (!t && zurueckgestellt.has(id)) continue // zurückgestellt (Quarantäne), nicht verloren
    const name = `Deutsche Folgenzahl ${id} (${e.title})`
    if (!t) fehler.push(`${name}: Titel nicht im Bestand`)
    else if (!t.episodes) fehler.push(`${name}: die Folgenzahl des Werks fehlt, die Angabe „${e.deFolgen.n} Folgen auf Deutsch“ verschwindet`)
    else if (e.deFolgen.n >= t.episodes) hinweise.push(id)
  }
  return { fehler, hinweise }
}
