import type { ComponentType } from 'react'
import type { AusschnittName } from './ausschnitte/index.ts'
import type { Ersatz } from './ersatz.tsx'
import type { Fall } from './faelle.ts'

/** Eine eigenständige Ansicht des Ausschnitts `entwurf`: bekommt den Fall (bei Nutzer-Fällen samt `nutzer`). */
export type Entwurf = ComponentType<{ fall: Fall }>

export interface Variante {
  /** Bauteile, die gegenüber dem echten Panel ausgetauscht werden. */
  ersatz: Partial<Ersatz>
  notiz?: string
  /** Stylesheet, das die Zelle über die echte App legt — für Gestaltungs-Mockups, die keine Bauteile tauschen (13.10.2026). */
  stil?: string
  /** Nur Ausschnitt `entwurf`: der Entwurf dieser Variante, wo die App kein Bauteil zum Tauschen hat. */
  entwurf?: Entwurf
}

export interface MockupDef {
  name: string
  titel: string
  ausschnitt: AusschnittName
  faelle: string[]
  varianten: Record<string, Variante>
  /** Wählbare Uhrzeiten (Beschriftung → ISO mit Berliner Versatz); ohne Angabe gilt `faelle.heute`. */
  zeiten?: Record<string, string>
  /** Nur Ausschnitt `entwurf`: was die heutige Seite an dieser Stelle zeigt; fehlt es, steht dort „Neu“. */
  vorher?: Entwurf
  /** Nur Ausschnitt `datenbank`: Adressparameter der Datenbank je Fall (Kennung des Falls → Parameter, z. B. `q` für die Suche, `y` für das Jahr). */
  suchadressen?: Record<string, Record<string, string>>
}

const register = new Map<string, MockupDef>()

/** Meldet ein Mockup an; die Dateien unter `mockups/` rufen das beim Laden auf. */
export function mockup(def: MockupDef): void {
  register.set(def.name, def)
}

export const alleMockups = (): MockupDef[] => [...register.values()]
export const mockupMit = (name: string): MockupDef | undefined => register.get(name)
