import type { StreamLink, Title } from '../../shared/types.ts'
import { adressKern, loadDubChecks, type DubCheck } from './dub-confirmed.ts'
import { kanalAdressenOhneBeleg, kanalSchluessel } from './kanal-titel.ts'

const schluessel = (titleId: number, platform: string, url: string | undefined) => `${titleId}|${platform}|${adressKern(url)}`

/**
 * Die Wege, die ein Handbeleg „deutsch" mit Adresse trägt: Titel, Plattform und Adresse (`09-2` legt sie an, wo der Titel dort keinen hat).
 * Ein jüngeres „nicht verfügbar“ zur selben Adresse verschmilzt mit dem Ja (`verschmelze`) und nimmt ihm den Weg.
 */
export function handbelegteJaWege(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.dub === true && c.available !== false && c.url).map((c) => schluessel(c.anilistId, c.platform, c.url)))
}

/**
 * Die Wege, die ein Handbeleg trägt: das Ja mit Adresse (`handbelegteJaWege`) und die Adresse eines Kanal-Titels. Der Lader nimmt Letzterem Amazons Sprachangabe
 * (`ohneKanalSprache`, `kanalOhneBeleg`), die Seite bleibt Adressbeleg; der Weg steht ohne Haken (🇩🇪 ?) und ohne Sprachangabe von JustWatch (`kanalHandbelegWege`). Ein jüngeres Nein (`dub: false`,
 * `available: false`) zur selben Adresse nimmt ihm den Weg.
 */
export function handbelegteWege(checks: DubCheck[]): Set<string> {
  const kanal = checks.filter((c) => c.kanalOhneBeleg && c.dub !== false && c.available !== false && c.url)
  return new Set([...handbelegteJaWege(checks), ...kanal.map((c) => schluessel(c.anilistId, c.platform, c.url))])
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
  const belegt = handbelegteWege(checks)
  titel.streams = (titel.streams ?? [])
    .filter((s) => belegt.has(schluessel(titel.id, s.platform, s.url)))
    .map((s) => ({ ...s, herkunft: 'handbeleg' as const }))
}

/**
 * Trägt nur der Adressbeleg eines Kanal-Titels diesen Weg (`herkunft: 'handbeleg'`, ohne eigenes Urteil)? Dann gibt auch JustWatch ihm keine
 * Sprachangabe: wie Amazons eigene sagt sie bei einem Kanal-Abo nichts über die Folge (`docs/wissen/quellen.md`, Kanal-Titel).
 */
export function kanalHandbelegWege(checks: DubCheck[]): (titelId: number, s: StreamLink) => boolean {
  const kanal = kanalAdressenOhneBeleg(checks)
  return (titelId, s) => s.herkunft === 'handbeleg' && s.dub === undefined && kanal.has(kanalSchluessel(titelId, s.url))
}
