import { type EigeneHandlung } from './handlung-eigen.ts'

type Synopse = { de?: string; eigen?: unknown }

/**
 * Eigene Handlungen gegen den gebauten Bestand. Ein Titel, der ganz fehlt, ist ein Fehler (Eintrag gehört zu nichts);
 * liefert inzwischen eine Quelle den Text, gewinnt sie schon im Bau und der Eintrag ist nur ein Hinweis zum Aufräumen.
 * Liegt der Titel hinter dem Toggle (`ohne-synchro.json`: die Verschobenen und der ganze AniList-Katalog, beide nicht zu trennen), kommt er noch vor und der Eintrag wartet dort;
 * das ist eine Warnung, kein Fehler. Verwaist ist nur, was auch dort fehlt.
 */
export function bewerteEigeneHandlungen(
  eintraege: EigeneHandlung[],
  titel: Set<number>,
  ausgeliefert: (id: number) => Synopse | undefined,
  hinterToggle: ReadonlySet<number>,
): { fehler: string[]; hinweise: number[]; versteckt: number[] } {
  const fehler: string[] = []
  const hinweise: number[] = []
  const versteckt: number[] = []
  for (const e of eintraege) {
    const s = ausgeliefert(e.id)
    if (!titel.has(e.id) && hinterToggle.has(e.id)) versteckt.push(e.id)
    else if (!titel.has(e.id)) fehler.push(`Eigene Handlung ${e.id}: Titel nicht im Bestand`)
    else if (s?.de && !s.eigen) hinweise.push(e.id)
  }
  return { fehler, hinweise, versteckt }
}
