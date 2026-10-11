import { ALLE } from '../faelle.ts'
import { mockup } from '../register.ts'
import type { AusschnittName } from '../ausschnitte/index.ts'

/** Probe-Mockup eines Ausschnitts: eine Variante ohne Änderung (Vorher = Nachher), damit der Ausschnitt in der Bühne sichtbar ist. */
function probe(ausschnitt: AusschnittName, titel: string): void {
  mockup({
    name: `probe-${ausschnitt}`,
    titel: `Probe – ${titel}`,
    ausschnitt,
    faelle: [ALLE],
    varianten: { A: { ersatz: {}, notiz: 'Probe ohne Änderung: Nachher ist gleich Vorher.' } },
  })
}

probe('filter', 'Filterfenster und Chips')
probe('kachel', 'Kachelraster der Datenbank')
probe('ganz', 'Ganze App')
