import type { Ersatz } from '../ersatz.tsx'
import type { Fall } from '../faelle.ts'

/** Was jeder Ausschnitt von der Zelle bekommt: den Fall (bzw. den Gesamtbestand, siehe `ALLE`) und die Ersatz-Bauteile der Variante. */
export interface AusschnittEigenschaften {
  fall: Fall
  ersatz: Partial<Ersatz>
  /** Das Mockup und seine Variante (leer = Vorher), für Ausschnitte mit eigenen Entwürfen. */
  mockup: string
  variante: string
}
