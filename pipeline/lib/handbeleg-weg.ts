import type { Title } from '../../shared/types.ts'
import { adressKern, loadDubChecks, type DubCheck } from './dub-confirmed.ts'

const schluessel = (titleId: number, platform: string, url: string | undefined) => `${titleId}|${platform}|${adressKern(url)}`

/** Die Wege, die ein Handbeleg „deutsch" mit Adresse trägt: Titel, Plattform und Adresse (`09-2` legt sie an, wo der Titel dort keinen hat). */
export function handbelegteJaWege(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.dub === true && c.url).map((c) => schluessel(c.anilistId, c.platform, c.url)))
}

let ausDerDatei: Set<string> | undefined
/** Wie `handbelegteJaWege`, aus `dub-confirmed.yaml` einmal je Bau gelesen — für Phasen, die die Belege nicht durchgereicht bekommen. */
export function istHandbelegterJaWeg(titleId: number, platform: string, url: string): boolean {
  ausDerDatei ??= handbelegteJaWege(loadDubChecks())
  return ausDerDatei.has(schluessel(titleId, platform, url))
}

/**
 * Titel nur bei aniSearch tragen keine Wege, die der Name erraten hat (`Title.herkunft`); ein Handbeleg „deutsch" mit Adresse ist das Gegenteil von
 * geraten (Daniel hat die Seite gesehen) und bleibt, mit `herkunft: 'handbeleg'`. Alles andere fällt weg. Verändert `streams`.
 */
export function behalteNurHandbelegteWege(titel: Title, checks: DubCheck[]): void {
  const belegt = handbelegteJaWege(checks)
  titel.streams = (titel.streams ?? [])
    .filter((s) => belegt.has(schluessel(titel.id, s.platform, s.url)))
    .map((s) => ({ ...s, herkunft: 'handbeleg' as const }))
}
