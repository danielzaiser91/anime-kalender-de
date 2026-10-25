import { type EigeneHandlung } from './handlung-eigen.ts'

type Synopse = { de?: string; eigen?: unknown }

/**
 * Eigene Handlungen gegen den gebauten Bestand. Ein Titel, der ganz fehlt, ist ein Fehler (Eintrag gehört zu nichts);
 * liefert inzwischen eine Quelle den Text, gewinnt sie schon im Bau und der Eintrag ist nur ein Hinweis zum Aufräumen.
 */
export function bewerteEigeneHandlungen(
  eintraege: EigeneHandlung[],
  titel: Set<number>,
  ausgeliefert: (id: number) => Synopse | undefined,
): { fehler: string[]; hinweise: string[] } {
  const fehler: string[] = []
  const hinweise: string[] = []
  for (const e of eintraege) {
    const s = ausgeliefert(e.id)
    if (!titel.has(e.id)) fehler.push(`Eigene Handlung ${e.id}: Titel nicht im Bestand`)
    else if (s?.de && !s.eigen) hinweise.push(`Eigene Handlung ${e.id}: der Bestand führt einen Text aus einer Quelle`)
  }
  return { fehler, hinweise }
}
