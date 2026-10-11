/**
 * Staffeln an die Cartoons hängen (11.10.2026): JustWatch (`data/justwatch-audio.json`) vor TMDB (`data/cartoons.json`),
 * Regel und Begründung in `lib/cartoon-staffeln.ts`. Titel mit widersprüchlichen oder nicht zur Gesamtfolgenzahl passenden
 * Angaben stehen mit Grund in `data/cartoon-staffeln-pruefliste.json`.
 */
import { log, writeJson } from '../lib/util.ts'
import type { CartoonEintrag } from '../lib/cartoons.ts'
import { jwStaffeln, waehleStaffeln } from '../lib/cartoon-staffeln.ts'
import type { Staffel } from '../lib/jw-staffeln.ts'
import type { Title } from '../../shared/types.ts'

export const PRUEFLISTE = 'data/cartoon-staffeln-pruefliste.json'

export interface StaffelPruefung {
  titleId: number
  titel: string
  quelle: 'justwatch' | 'tmdb'
  gruende: string[]
}

export function setzeStaffeln(
  titel: Title[],
  roh: Record<string, CartoonEintrag>,
  jw: Record<string, { staffeln?: Staffel[] }>,
): void {
  const pruefen: StaffelPruefung[] = []
  const je = { justwatch: 0, tmdb: 0 }
  for (const t of titel) {
    const wahl = waehleStaffeln(jwStaffeln(jw[String(t.id)]?.staffeln), roh[String(t.id)]?.staffeln, t.episodes)
    if (!wahl) continue
    t.staffeln = wahl.staffeln
    t.staffelnQuelle = wahl.quelle
    je[wahl.quelle]++
    if (wahl.gruende.length) {
      pruefen.push({ titleId: t.id, titel: t.titleDe ?? t.titleEn ?? '', quelle: wahl.quelle, gruende: wahl.gruende })
    }
  }
  writeJson(PRUEFLISTE, pruefen.sort((a, b) => a.titleId - b.titleId))
  log(`Cartoon-Staffeln: ${je.justwatch} laut JustWatch, ${je.tmdb} laut TMDB, ${pruefen.length} auf der Prüfliste`)
}
