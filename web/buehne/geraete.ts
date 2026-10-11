import type { AusschnittName } from './ausschnitte/index.ts'

export type GeraetGroesse = '375' | '512'

/** Fenstergröße je Gerät; die Breite ist die Breite des Zellenrahmens, also die echte Seitenbreite der App. */
export const GROESSE: Record<GeraetGroesse, { breite: number; hoehe: number; name: string }> = {
  '375': { breite: 375, hoehe: 812, name: 'Handy 375' },
  '512': { breite: 512, hoehe: 900, name: 'Desktop 512' },
}

export function geraeteFuer(_ausschnitt: AusschnittName): GeraetGroesse[] {
  return ['375', '512']
}
