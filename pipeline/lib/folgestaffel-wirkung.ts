import { stripAffiliate } from '../../shared/mappings.ts'
import { type Title } from '../../shared/types.ts'
import { mitFolgestaffelEintraegen } from '../bau/11-2-6-folgestaffel-eintraege.ts'
import { type JwEintrag } from '../bau/11-2-2-wege-ohne-weg.ts'

/**
 * Wirkende Folgestaffel-Einträge im gebauten Bestand: Stand 11.11.2026 (`public/data` auf f9096cdc6, `data/justwatch-audio.json` desselben Stands) 18 von 139.
 * Gemessen an 14 Ständen von `main` seit dem 06.10.2026 (nach der Regel von PR 3484 nachgerechnet): vor dem Merge immer 0 wirkende, die Zahl der Einträge lag
 * seit dem 23.10.2026 zwischen 139 und 168. Mehr als diese eine Messung mit Wirkung gibt es noch nicht; der Sprung 9 ist die Hälfte des Standes und
 * wird nachgezogen, sobald mehrere Stände nach dem Merge vorliegen. Ändert ein PR die Regel bewusst, zieht er den Stand im selben PR nach.
 */
export const FOLGESTAFFEL_WIRKEND_STAND = 18
export const FOLGESTAFFEL_SPRUNG = 9

/** Ein Eintrag wirkt, wenn eine Adresse seiner Staffel-Angebote als Bezugsweg am Titel steht. */
export function wirkendImBestand(jw: Record<string, JwEintrag>, titles: ReadonlyMap<number, Title>): { eintraege: number; wirkend: number } {
  const mit = mitFolgestaffelEintraegen(jw, titles)
  const ids = Object.keys(mit).filter((id) => !(id in jw))
  const wirkt = (id: string) => {
    const urls = new Set((mit[id]!.angebote ?? []).map((a) => a.url && stripAffiliate(a.url)))
    return (titles.get(Number(id))?.watchLinks ?? []).some((w) => urls.has(w.url))
  }
  return { eintraege: ids.length, wirkend: ids.filter(wirkt).length }
}

/** Die Warnzeile, wenn die wirkende Zahl um mehr als `FOLGESTAFFEL_SPRUNG` vom Stand abweicht, sonst `undefined`. */
export function sprungZeile(wirkend: number, eintraege: number): string | undefined {
  if (Math.abs(wirkend - FOLGESTAFFEL_WIRKEND_STAND) <= FOLGESTAFFEL_SPRUNG) return undefined
  return `⚠ WARNUNG Folgestaffel-Einträge: ${wirkend} wirken (von ${eintraege}), Stand ${FOLGESTAFFEL_WIRKEND_STAND}, Sprung über ${FOLGESTAFFEL_SPRUNG} — Regel in pipeline/bau/11-2-6-folgestaffel-eintraege.ts oder Anbieterdaten prüfen, bei Absicht Stand in pipeline/lib/folgestaffel-wirkung.ts nachziehen`
}
