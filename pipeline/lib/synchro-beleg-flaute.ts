/**
 * **Flaute der Synchro-Belege melden** (Dirigent, 08.11.2026): Lauf 17:00 endete grün, obwohl 0 von 18 Vorschlägen Beleg wurden – erst der Blick von Hand
 * zeigte es. Ab `MINDEST` strittigen Vorschlägen und 0 Belegen gibt es eine Warnung mit der Ablehnungsliste. Strittig ist alles außer den zwei Gründen, die
 * richtig sind (der Weg trägt schon das Ja, ein Handbeleg steht schon).
 */
import type { AbgabeErgebnis } from './synchro-beleg-abgabe.ts'

export const MINDEST = 5
const RICHTIG = ['Weg trägt schon dub: true', 'Handbeleg zu Titel und Plattform steht schon']

/** Der Text der Warnung (eine Zeile), oder undefined, wenn alles in Ordnung ist. */
export function belegFlaute(erg: AbgabeErgebnis): string | undefined {
  if (erg.belege.length) return undefined
  const strittig = erg.zurueck.filter((z) => !RICHTIG.includes(z.grund))
  if (strittig.length < MINDEST) return undefined
  const liste = strittig.map((z) => `${z.titel} (Artikel ${z.artikelId}): ${z.grund}`).join('; ')
  return `Synchro-Belege: 0 Belege bei ${strittig.length} Vorschlägen ohne richtigen Ablehnungsgrund – ${liste}`
}
