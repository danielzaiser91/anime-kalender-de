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

// Zustandsbild „Kopf ohne Marke“: Fall 86 ohne Sprachbeleg an allen Zeilen (Fall-Optionen, `fall-optionen.ts`).
mockup({
  name: 'probe-tonspur',
  titel: 'Probe – Panel ohne Sprachbeleg',
  ausschnitt: 'detailpanel',
  faelle: ['86', '86-ohne-beleg'],
  varianten: { A: { ersatz: {}, notiz: 'Probe ohne Änderung: der Fall „ohne Beleg“ zeigt den Kopf ohne Marke.' } },
})

probe('filter', 'Filterfenster und Chips')
probe('kachel', 'Kachelraster der Datenbank')
probe('ganz', 'Ganze App')
