/**
 * Wache für das „Staffelfinale“ (`ReleaseEvent.staffelfinale`): Es steht nur, wo das Ende der Staffel belegt ist.
 *
 * Hart (rot, Titel zurückgestellt) sind die Verstöße, die `istStaffelfinale` nie erzeugen darf: ein Finale ohne Folgenzahl am Release
 * oder aus einer Sichtung (`tvLetzteSichtung`) ohne Enddatum — sie träten nur auf, wenn die Regel wieder fiele.
 * Weich (nur eine Zeile „⚠ WARNUNG“) ist der Verdacht: Die Folgen sind japanisch schon weiter erschienen, als das Release endet
 * (`folgen/zaehlung.json`, erste Zahl), und kein Enddatum belegt das Ende. Das trifft auch ein echtes Teilfinale (Disney+ liefert Naruto in
 * Paketen, eine deutsche Fassung kann mitten in der Reihe enden), deshalb sperrt es nichts; freigegeben wird mit `lastEpisodeDate`.
 *
 * Anlass: Beyblade X Staffel 3 bei RTL+ stand als „Folge 122/122, Staffelfinale“, die Reihe hat japanisch 128 Folgen (26.10.2026).
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'

export type FinaleVerstoss = { slug: string; titleId: number; grund: string; hart: boolean }

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
    const fall = { slug: r.slug, titleId: r.titleId }
    if (!r.schedule?.episodeCount) raus.push({ ...fall, grund: 'Finale ohne Folgenzahl am Release', hart: true })
    else if (r.tvLetzteSichtung) raus.push({ ...fall, grund: 'Finale aus einer Sichtung, ohne Enddatum', hart: true })
    else if (japanisch > ende) raus.push({ ...fall, grund: `Finale bei Folge ${ende}, japanisch ${japanisch} Folgen`, hart: false })
  }
  return raus
}
