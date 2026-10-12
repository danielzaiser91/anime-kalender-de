import type { AusschnittName } from './ausschnitte/index.ts'
import type { Ersatz } from './ersatz.tsx'

export interface Variante {
  /** Bauteile, die gegenüber dem echten Panel ausgetauscht werden. */
  ersatz: Partial<Ersatz>
  notiz?: string
}

export interface MockupDef {
  name: string
  titel: string
  ausschnitt: AusschnittName
  faelle: string[]
  varianten: Record<string, Variante>
}

const register = new Map<string, MockupDef>()

/** Meldet ein Mockup an; die Dateien unter `mockups/` rufen das beim Laden auf. */
export function mockup(def: MockupDef): void {
  register.set(def.name, def)
}

export const alleMockups = (): MockupDef[] => [...register.values()]
export const mockupMit = (name: string): MockupDef | undefined => register.get(name)
