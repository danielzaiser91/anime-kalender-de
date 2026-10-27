import { amazonLinkArt } from '@shared/plattform-suche.ts'

/** Medium-Wörter, die das Kürzel „BLU-RAY“ vor dem Händler schon sagt. */
const MEDIUM = /\b(?:blu-?ray|dvd|4k uhd)\b/gi

/** Nur Wörter, ohne Medium und Satzzeichen — damit „Vol. 1/2 Blu-ray“ in „Vol. 1/2: Limited Edition Blu-ray“ erkennbar steckt. */
function woerter(teil: string): Set<string> {
  return new Set(teil.replace(MEDIUM, ' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))
}

/** Streicht das Medium und verwaiste Trenner am Rand („Standard & Limited Edition, Blu-ray“ → „Standard & Limited Edition“). */
function ohneMedium(teil: string): string {
  return teil
    .replace(MEDIUM, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,:;])/g, '$1')
    .replace(/^[\s,:;+&-]+|[\s,:;+&-]+$/g, '')
}

/**
 * Der kurze Ausgabenname einer Disc-Pille (Daniel, 21.10.2026, Yaiba): Die Editionsangabe nennt dieselbe Ausgabe oft
 * zweimal („Staffel 1 - Vol. 1/2: Limited Edition Blu-ray + Sammelschuber · Staffel 1 - Vol. 1/2 Blu-ray“).
 * Ein Teil, dessen Wörter schon in einem anderen stecken, entfällt; das Medium steht im Kürzel der Pille.
 */
export function kurzeAusgabe(edition?: string): string | undefined {
  if (!edition) return undefined
  const teile = edition.split(' · ').map((t) => t.trim()).filter(Boolean)
  const bleibt = teile.filter((teil, i) => {
    const eigene = woerter(teil)
    return !teile.some((anderes, j) => {
      if (i === j) return false
      const fremde = woerter(anderes)
      const enthalten = [...eigene].every((w) => fremde.has(w))
      /* Bei Gleichheit gewinnt der frühere Teil. */
      return enthalten && (fremde.size > eigene.size || j < i)
    })
  })
  return bleibt.map(ohneMedium).filter(Boolean).join(' · ') || undefined
}

/** Beschriftung des Kauflinks: Eine Namenssuche verspricht kein Produkt (Conan Box 1: 616 Treffer), die EAN-Suche eines (27.10.2026). */
export function kaufTextSchluessel(url: string | undefined): 'detail.beiShopSuchen' | 'detail.beiShop' | 'detail.kaufenBei' {
  const art = amazonLinkArt(url)
  return art === 'name' ? 'detail.beiShopSuchen' : art === 'ean' ? 'detail.beiShop' : 'detail.kaufenBei'
}
