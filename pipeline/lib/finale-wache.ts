/**
 * Wache für das „Staffelfinale“ (`ReleaseEvent.staffelfinale`): Es steht nur, wo das Ende der Staffel belegt ist.
 * Verstöße: (a) Das Release ist eine Sichtung („läuft noch“, `tvLetzteSichtung`) ohne belegtes Enddatum — seine Folgenzahl ist
 * die letzte gesehene Folge; (b) die Folgen sind japanisch schon weiter erschienen als das Release endet (`folgen/zaehlung.json`,
 * erste Zahl) und kein Enddatum belegt es. Anlass: Beyblade X Staffel 3 bei RTL+ stand als „Folge 122/122, Staffelfinale“, die Reihe
 * hat japanisch 128 Folgen (26.10.2026).
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'

export type FinaleVerstoss = { slug: string; titleId: number; grund: string }

/** Die Releases, deren Finale-Termin im Bestand steht, ohne dass das Ende belegt ist. */
export function finaleOhneEndbeleg(
  events: ReleaseEvent[],
  releases: Release[],
  zaehlung: Record<string, number[] | undefined>,
): FinaleVerstoss[] {
  const mitFinale = new Set(events.filter((e) => e.staffelfinale).map((e) => e.releaseSlug))
  const raus: FinaleVerstoss[] = []
  for (const r of releases) {
    if (!mitFinale.has(r.slug) || r.schedule?.lastEpisodeDate) continue
    const ende = (r.schedule?.firstEpisodeNumber ?? 1) - 1 + (r.schedule?.episodeCount ?? 0)
    const japanisch = zaehlung[String(r.titleId)]?.[0] ?? 0
    if (!r.schedule?.episodeCount) raus.push({ slug: r.slug, titleId: r.titleId, grund: 'Finale ohne Folgenzahl am Release' })
    else if (r.tvLetzteSichtung) raus.push({ slug: r.slug, titleId: r.titleId, grund: 'Finale aus einer Sichtung, ohne Enddatum' })
    else if (japanisch > ende) raus.push({ slug: r.slug, titleId: r.titleId, grund: `Finale bei Folge ${ende}, japanisch ${japanisch} Folgen` })
  }
  return raus
}
