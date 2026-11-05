import type { Title } from '../../shared/types.ts'
import type { CrDubData } from './crunchyroll-dub.ts'
import { blockSchluessel, blockSchluesselMitNull, serienkennungenMitNullBlock } from './cr-ja-deckung.ts'

const nullBlockJeDaten = new WeakMap<CrDubData, Set<string>>()
const widerspruchJeDaten = new WeakMap<CrDubData, Set<string>>()

/**
 * Führt eine Serie dieser Kennung einen vollständig deutschen Block, der so viele Folgen hat wie der Titel (Josee: „(German Dub)“, 1 von 1)?
 * Nicht, wenn ein anderer Eintrag derselben Kennung denselben Block (`staffelId`) ohne deutsche Folge führt (04.11.2026, Persona 5).
 */
function deutscherBlockPasst(crDub: CrDubData, kennung: string, folgen: number | null | undefined): boolean {
  if (!folgen) return false
  let widerspruch = widerspruchJeDaten.get(crDub)
  if (!widerspruch) widerspruchJeDaten.set(crDub, (widerspruch = blockSchluesselMitNull(crDub)))
  return crDub.serien.some(
    (s) =>
      s.seriesId === kennung &&
      (s.staffeln ?? []).some((b) => b.folgen === folgen && b.deutsch === folgen && !widerspruch.has(blockSchluessel(kennung, b.staffelId) ?? '')),
  )
}

/**
 * Fallen Serie und Werk laut Katalog zusammen? Der Katalog zählt „1 Staffel“, der Prüflauf (`crunchyroll-dub.json`) kann in derselben Serie
 * einen Block ohne deutsche Folge führen (26.10.2026, Persona 5: Katalog vom 09.09. „1 Staffel, de-DE“, Prüflauf: Block „Day Breakers“ mit 0 deutschen
 * Folgen). Dann sagt das `de-DE` der Serie nichts über das einzelne Werk und trägt kein Ja — es sei denn, ein vollständig deutscher Block hat genau
 * die Folgenzahl des Titels. Wie in `sammleBelege` (09-1) für den Kalender-Slot.
 */
export function katalogSerieIstEinWerk(crDub: CrDubData, kennung: string, eintrag: { staffeln?: number }, title: Title): boolean {
  if ((eintrag.staffeln ?? 0) !== 1) return false
  let nullBlock = nullBlockJeDaten.get(crDub)
  if (!nullBlock) nullBlockJeDaten.set(crDub, (nullBlock = serienkennungenMitNullBlock(crDub)))
  return !nullBlock.has(kennung) || deutscherBlockPasst(crDub, kennung, title.episodes)
}
