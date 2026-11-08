/**
 * **Flaute der Synchro-Belege melden** (Dirigent, 08.11.2026): Lauf 17:00 endete grün, obwohl 0 von 18 Vorschlägen Beleg wurden – erst der Blick von Hand
 * zeigte es. Ab `MINDEST` Zuordnungsfehlern (`Zurueckgestellt.strittig`) und 0 Belegen gibt es eine Warnung mit der Ablehnungsliste. Berechtigte Gründe
 * (Weg trägt schon das Urteil, Handbeleg steht, Weg fehlt noch, Zukunftstag, Art, keine Stream-Plattform, unsicher) zählen nicht.
 * Sichtbar ist heute nur die `::warning::`-Zeile im Lauf-Log; `flaute.txt` und die Ausgabe `flaute=1` haben noch keinen Leser (Workflow-Schritt: Vorschlag im PR).
 */
import type { AbgabeErgebnis } from './synchro-beleg-abgabe.ts'

export const MINDEST = 5

/** Der Text der Warnung (eine Zeile), oder undefined, wenn alles in Ordnung ist. */
export function belegFlaute(erg: AbgabeErgebnis): string | undefined {
  if (erg.belege.length) return undefined
  const strittig = erg.zurueck.filter((z) => z.strittig)
  if (strittig.length < MINDEST) return undefined
  const liste = strittig.map((z) => `${z.titel} (Artikel ${z.artikelId}): ${z.grund}`).join('; ')
  return `Synchro-Belege: 0 Belege bei ${strittig.length} Vorschlägen mit Zuordnungsfehler – ${liste}`
}
