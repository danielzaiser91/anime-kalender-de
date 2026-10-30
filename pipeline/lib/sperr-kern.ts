import { adressKern } from '../../shared/adresse-kern.ts'

/** Eigenes Modul ohne `js-yaml`: die Wache (`delta-wache.yml`) installiert keine Abhängigkeiten, braucht aber den Kern. */
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
