/*
  Zustandsrechnung des Mockups „Relative Uhrzeit in der Woche" (Spezifikation `relative-uhrzeit-spezifikation.md`).
  Die Rechnung der Seite (Variante D) liegt in `shared/laeuft-jetzt.ts`; hier bleibt, was nur die verworfenen Varianten
  A bis C brauchen: die Jetzt-Linie vor der ersten nicht vorbeigegangenen Zeile (auch während etwas läuft) und die Kopfzeile von B.
*/
import { kastenZustand as seitenZustand, type Kastenzustand as SeitenZustand, type Sendung, type Termin, type Zeilenzustand } from '../../../shared/laeuft-jetzt.ts'

export * from '../../../shared/laeuft-jetzt.ts'

export interface Kastenzustand extends SeitenZustand {
  /** Die Jetzt-Linie steht vor dieser Zeile; leer, wenn noch nichts vorbei ist und nichts läuft oder alles vorbei ist. */
  linieVor?: number
}

function linieVor(zeilen: Zeilenzustand[]): number | undefined {
  const i = zeilen.findIndex((z) => z.art !== 'vorbei')
  if (i < 0) return undefined
  return i > 0 || zeilen[0]!.art === 'laeuft' ? i : undefined
}

/** Zustand der Seite, dazu die Linie der Varianten A bis C. */
export function kastenZustand(gruppen: Termin[][], sendungen: Sendung[][], heute: string, jetzt: string): Kastenzustand {
  const z = seitenZustand(gruppen, sendungen, heute, jetzt)
  return { ...z, linieVor: linieVor(z.zeilen) }
}

export type Kopfzeile = { art: 'laeuft'; name: string; bis: string } | { art: 'naechste'; minuten: number } | { art: 'nichts' }

/** Variante B: die eine Zeile unter „Im Fernsehen"; ab drei Stunden Abstand keine. */
export function kopfzeile(zustand: Kastenzustand, namen: string[]): Kopfzeile | undefined {
  const lauf = zustand.zeilen.findIndex((z) => z.art === 'laeuft')
  const laeuft = zustand.zeilen[lauf]
  if (laeuft?.art === 'laeuft') return { art: 'laeuft', name: namen[lauf]!, bis: laeuft.bis }
  const naechste = zustand.zeilen.find((z) => z.art === 'naechste')
  if (naechste?.art === 'naechste') return { art: 'naechste', minuten: naechste.minuten }
  return zustand.alleVorbei ? { art: 'nichts' } : undefined
}
