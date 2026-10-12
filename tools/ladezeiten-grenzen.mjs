/**
 * Zeitgrenzen der Ladezeiten-Überwachung (`ladezeiten-messen.mjs`).
 *
 * Grenze = Median des Messtags × 1,5, Messwert immer „stabil" (Tipp bis Ruhe) bzw. „Kalender sichtbar" (ab Navigationsbeginn),
 * Pixel 7, 4× CPU, aus `dist/` ohne Netz. Die Werte stammen vom Entwicklerrechner; ein langsamerer Rechner reißt sie
 * zuerst. Neu messen und hier eintragen (mit Datum), wenn der Kalender absichtlich mehr leistet oder die Rechnerklasse wechselt.
 */
export const FAKTOR = 1.5

/** Median aus fünf Läufen (je 5 Wiederholungen, 3 Ladungen) vom 12.10.2026, Stand main cb76ca543, in ms. */
export const MESSTAG = '12.10.2026'
export const MEDIAN_HEUTE = {
  'Kalender sichtbar': 896,
  'Woche → Monat': 84,
  'Monat → Woche': 136,
  'Woche vor': 90,
  'Woche zurück': 136,
  'Filter auf': 101,
  'Panel auf': 127,
}

export const grenzeVon = (median) => Math.round(median * FAKTOR)

/** Vergleicht die Einzelwerte mit den Grenzen; liefert je Messgröße Median, Grenze und Urteil. */
export function urteile(werte, medianVon) {
  return Object.keys(MEDIAN_HEUTE).map((name) => {
    const median = medianVon(werte.get(name) ?? [])
    const grenze = grenzeVon(MEDIAN_HEUTE[name])
    return { name, median, grenze, heute: MEDIAN_HEUTE[name], ok: median !== undefined && median <= grenze }
  })
}
