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

// TV-Box eines MAXX-Termins mit Joyn-Weg: „Danach auf Joyn“ darf nur einmal im Panel stehen.
mockup({
  name: 'probe-tv-box',
  titel: 'Probe – TV-Box mit Joyn',
  ausschnitt: 'detailpanel',
  faelle: ['yaiba-joyn'],
  varianten: { A: { ersatz: {}, notiz: 'Probe ohne Änderung: Knopfzeile der TV-Box und Joyn-Pille.' } },
})

probe('filter', 'Filterfenster und Chips')
probe('kachel', 'Kachelraster der Datenbank')
probe('ganz', 'Ganze App')
