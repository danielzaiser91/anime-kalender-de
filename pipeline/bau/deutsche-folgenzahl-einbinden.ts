import { log, warn } from '../lib/util.ts'
import { deFolgenFehler, deFolgenGilt, ladeErstausgabeVonHand } from '../lib/erstausgabe-von-hand.ts'
import { type SynopsisEintrag } from './13-1-anreichern.ts'

/**
 * **Deutsche Folgenzahl in die Detaildaten des Panels** (`deFolgen` in `public/data/synopses/`, nicht in `titles.json`: nur eine Handvoll Titel braucht sie).
 * Quelle ist `deFolgen` an einem Eintrag von `data/erstausgabe-von-hand.yaml`. Eine fehlerhafte Datei bricht den Bau ab; ein Eintrag, dessen Zahl
 * nicht mehr unter der Folgenzahl des Werks liegt (oder dessen Titel fehlt), steht als Warnung im Protokoll.
 */
export function ergaenzeDeutscheFolgenzahl(synopses: Record<number, SynopsisEintrag>, episodesJeTitel: Map<number, number | undefined>): number {
  const eintraege = ladeErstausgabeVonHand()
  const fehler = deFolgenFehler(eintraege)
  if (fehler.length) throw new Error(`data/erstausgabe-von-hand.yaml fehlerhaft:\n${fehler.join('\n')}`)
  let eingebunden = 0
  for (const e of eintraege) {
    if (!e.deFolgen || !e.anilistId) continue
    if (!episodesJeTitel.has(e.anilistId)) warn(`Deutsche Folgenzahl ${e.anilistId} ungenutzt (Titel nicht im Bestand) — deFolgen in data/erstausgabe-von-hand.yaml löschen`)
    else if (!deFolgenGilt(e.deFolgen, episodesJeTitel.get(e.anilistId))) warn(`Deutsche Folgenzahl ${e.anilistId} ungenutzt (nicht unter der Folgenzahl des Werks) — deFolgen in data/erstausgabe-von-hand.yaml löschen`)
    else {
      const { n, name, url, zitat } = e.deFolgen
      synopses[e.anilistId] = { ...synopses[e.anilistId], deFolgen: { n, quelle: { name, url }, zitat } }
      eingebunden++
    }
  }
  log(`Deutsche Folgenzahl: ${eingebunden} eingebunden`)
  return eingebunden
}
