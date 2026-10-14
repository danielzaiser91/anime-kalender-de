/**
 * Schwellen und Bewertung der D1-Verbrauchsprüfung (`tools/d1-verbrauch.mjs`), ohne Netz und ohne Exit,
 * damit `tools/d1-verbrauch.test.mjs` sie prüfen kann.
 */

export const GRENZE_GESAMT = 2_500_000
export const GRENZE_EINZELN = 1_000_000
/*
  Schreib-Tageskontingent der freien Stufe: 100.000 Zeilen; jede Meldung kostet rund 14. Seit 11.10.2026:
  ab 50.000 nur eine Warnzeile (Exit 0), rot erst ab 80.000 — der Plan ist unbestätigt, und am
  11.10.2026 lief der Worker trotz 154.738 Zeilen am Tag weiter.
*/
export const WARNUNG_GESCHRIEBEN = 50_000
export const GRENZE_GESCHRIEBEN = 80_000

const zahl = (n) => n.toLocaleString('de-DE')

/** Befunde (rot) und Warnungen (gelb) aus den Summen. */
export function bewerte({ gelesen, geschrieben, groesste }) {
  const befunde = []
  const warnungen = []
  if (geschrieben > GRENZE_GESCHRIEBEN) {
    befunde.push(
      `${zahl(geschrieben)} geschriebene Zeilen über der Grenze ` +
        `${zahl(GRENZE_GESCHRIEBEN)} (Schreib-Kontingent der freien Stufe: 100.000)`,
    )
  } else if (geschrieben > WARNUNG_GESCHRIEBEN) {
    warnungen.push(
      `${zahl(geschrieben)} geschriebene Zeilen, ` +
        `Warnschwelle ${zahl(WARNUNG_GESCHRIEBEN)} (rot ab ${zahl(GRENZE_GESCHRIEBEN)})`,
    )
  }
  if (gelesen > GRENZE_GESAMT) {
    befunde.push(`Gesamtverbrauch ${zahl(gelesen)} über der Grenze ${zahl(GRENZE_GESAMT)} (halbes Tageskontingent)`)
  }
  for (const q of groesste) {
    if ((q.totalRowsRead ?? 0) > GRENZE_EINZELN) {
      befunde.push(`eine Abfrage liest ${zahl(q.totalRowsRead)} Zeilen: ${String(q.query ?? '').replace(/\s+/g, ' ').slice(0, 96)}`)
    }
  }
  return { befunde, warnungen }
}
