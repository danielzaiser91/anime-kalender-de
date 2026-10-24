import type { Entwurf, MockupDef } from './register.ts'

/** Welche Ansicht eine Zelle zeigt: Variante leer = Vorher (die heutige Seite, sonst `undefined` = „Neu“), sonst der Entwurf der Variante. */
export function waehleEntwurf(def: MockupDef | undefined, variante: string): Entwurf | undefined {
  if (!def) return undefined
  return variante === '' ? def.vorher : def.varianten[variante]?.entwurf
}
