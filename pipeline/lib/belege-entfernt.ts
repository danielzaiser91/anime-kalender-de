/**
 * **Entfernte Handbelege kommen nicht über eine zweite Quelle zurück** (28.10.2026).
 *
 * Wer einen Fehlbeleg aus `data/dub-confirmed.yaml` nimmt, trägt ihn in `data/belege-entfernt.yaml` ein. Die abgeholten
 * Browser-Meldungen (`belege-anhaengen.ts`) hängen ihn dann nicht wieder an: Der Bestandsbau am 28.10.2026 brachte den
 * Made-in-Abyss-Beleg zurück, den #2257 entfernt hatte, weil die Meldung vom 28.09. noch in der Abholung lag.
 * Ein Eintrag gilt für Kennung **und** Adresse; dieselbe Adresse an einem anderen Titel (Staffel, OVA) bleibt erlaubt.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { adressKern } from '../../shared/adresse-kern.ts'

export interface BelegEntfernt {
  anilistId: number
  url: string
  grund: string
  entferntAm: string
}

/** Wie `adressKern`, zusätzlich ohne Sprach-/Ländersegment (Disney+ führt dieselbe Seite als `/browse/…` und `/de-de/browse/…`). */
export function sperrKern(url: string | undefined): string {
  return adressKern(url).replace(/^(disneyplus\.com|netflix\.com|crunchyroll\.com)\/(?:[a-z]{2}(?:-[a-z0-9]{2,3})?\/)+/, '$1/')
}

export function ladeBelegeEntfernt(datei: string): BelegEntfernt[] {
  const geladen = yaml.load(readFileSync(datei, 'utf8'))
  return Array.isArray(geladen) ? (geladen as BelegEntfernt[]) : []
}

export function istEntfernt(liste: readonly BelegEntfernt[], anilistId: number | undefined, url: string | undefined): boolean {
  const kern = sperrKern(url)
  return !!kern && liste.some((e) => e.anilistId === anilistId && sperrKern(e.url) === kern)
}

/** Ein Beleg-Block (YAML-Zeilen eines `- anilistId: …`-Eintrags) gehört zu einem entfernten Beleg. */
export function blockIstEntfernt(liste: readonly BelegEntfernt[], block: string[]): boolean {
  try {
    const b = (yaml.load(block.join('\n')) as { anilistId?: number; url?: string }[] | null)?.[0]
    return istEntfernt(liste, b?.anilistId, b?.url)
  } catch {
    return false
  }
}
