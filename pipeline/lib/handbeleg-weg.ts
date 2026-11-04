import type { StreamLink, Title } from '../../shared/types.ts'
import { adressKern, loadDubChecks, type DubCheck } from './dub-confirmed.ts'

const schluessel = (titleId: number, platform: string, url: string | undefined) => `${titleId}|${platform}|${adressKern(url)}`

/**
 * Die Wege, die ein Handbeleg „deutsch" mit Adresse trägt: Titel, Plattform und Adresse (`09-2` legt sie an, wo der Titel dort keinen hat).
 * Ein jüngeres „nicht verfügbar“ zur selben Adresse verschmilzt mit dem Ja (`verschmelze`) und nimmt ihm den Weg.
 */
export function handbelegteJaWege(checks: DubCheck[]): Set<string> {
  return new Set(checks.filter((c) => c.dub === true && c.available !== false && c.url).map((c) => schluessel(c.anilistId, c.platform, c.url)))
}

let ausDerDatei: Set<string> | undefined
/** Wie `handbelegteJaWege`, aus `dub-confirmed.yaml` einmal je Bau gelesen — für Phasen, die die Belege nicht durchgereicht bekommen. */
export function istHandbelegterJaWeg(titleId: number, platform: string, url: string): boolean {
  ausDerDatei ??= handbelegteJaWege(loadDubChecks())
  return ausDerDatei.has(schluessel(titleId, platform, url))
}

/**
 * Titel nur bei aniSearch tragen keine Wege, die der Name erraten hat (`Title.herkunft`); ein Handbeleg „deutsch" mit Adresse ist das Gegenteil von
 * geraten (Daniel hat die Seite gesehen) und bleibt, mit `herkunft: 'handbeleg'`. Ebenso bleibt ein Joyn-Weg, dessen Adresse JustWatch nennt
 * (`jwJoyn`, dann `herkunft: 'justwatch'`: kein Beginn belegt, keine Meldung „neu“; JustWatch ordnet sie über die TMDB-Kennung zu, nie über den Namen): Happy Fish 2 und drei weitere Filme verloren ihn sonst. Alles
 * andere fällt weg. Verändert `streams`.
 */
export function behalteNurHandbelegteWege(titel: Title, checks: DubCheck[], jwJoyn: Map<string, Set<string>> = new Map()): void {
  const belegt = handbelegteJaWege(checks)
  const eigene = jwJoyn.get(String(titel.id))
  titel.streams = (titel.streams ?? []).flatMap<StreamLink>((s) => {
    if (belegt.has(schluessel(titel.id, s.platform, s.url))) return [{ ...s, herkunft: 'handbeleg' as const }]
    return s.platform === 'joyn' && eigene?.has(s.url) ? [{ ...s, herkunft: 'justwatch' as const }] : []
  })
}

/** Die Joyn-Adressen, die JustWatch je Titelkennung nennt (`data/justwatch-audio.json`); eine Adresse bei einem fremden Titel trägt nichts. */
export function joynAdressenVonJw(jw: Record<string, { angebote?: { anbieter?: string; url?: string }[] }>): Map<string, Set<string>> {
  const je = new Map<string, Set<string>>()
  for (const [id, b] of Object.entries(jw)) {
    const adressen = new Set<string>()
    for (const a of b.angebote ?? []) if (a.url && /joyn/i.test(a.anbieter ?? '')) adressen.add(a.url)
    if (adressen.size) je.set(id, adressen)
  }
  return je
}
