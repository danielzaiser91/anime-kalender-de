import type { AusschnittName } from './ausschnitte/index.ts'

export type GeraetGroesse = '375' | '512' | '1200'

/** Fenstergröße je Gerät; die Breite ist die Breite des Zellenrahmens, also die echte Seitenbreite der App. */
export const GROESSE: Record<GeraetGroesse, { breite: number; hoehe: number; name: string }> = {
  '375': { breite: 375, hoehe: 812, name: 'Handy 375' },
  '512': { breite: 512, hoehe: 900, name: 'Desktop 512' },
  '1200': { breite: 1200, hoehe: 800, name: 'Desktop breit 1200' },
}

/** Kachelraster und ganze App brauchen eine breite Desktop-Zelle (Raster, Seitenleisten); Panel und Filter zeigen sich schon bei 512. */
const BREIT: AusschnittName[] = ['kachel', 'ganz', 'datenbank', 'design']

export function geraeteFuer(ausschnitt: AusschnittName): GeraetGroesse[] {
  return BREIT.includes(ausschnitt) ? ['375', '1200'] : ['375', '512']
}
