/**
 * **Die Überschrift des Crunchyroll-Wochenprogramms lesen** (30.09.2026 aus dem Abruf gelöst).
 *
 * Anlass: Am 28.09.2026 wechselte derselbe Artikel auf die kurze Schreibweise
 * („Crunchyrolls aktuelles Wochenprogramm vom 28.9. bis 4.10."). Der Leser kannte nur
 * ausgeschriebene Monate, warf seither einen Fehler, und `data/crunchyroll-woche.json` blieb drei
 * Tage lang auf der Vorwoche stehen — niemandem fiel es auf (der Lauf selbst blieb grün).
 *
 * Eigene Datei, damit der Prüflauf beide Schreibweisen festhalten kann, ohne den Browser-Abruf zu
 * laden: `check-logic` importiert diese Datei, nicht das Skript mit Playwright.
 */
export const MONATE: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
}

const iso = (j: number, m: number, t: number) => `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`

/** Ein Monat als Wort („September") oder als Zahl („9."). */
function monatAus(name?: string, zahl?: string): number | undefined {
  if (zahl) {
    const n = Number(zahl)
    return n >= 1 && n <= 12 ? n : undefined
  }
  return name ? MONATE[name.toLowerCase()] : undefined
}

/**
 * **„… vom 21. bis 27. September", „… vom 28.9. bis 4.10.", auch gemischt** → Montag als ISO-Datum.
 *
 * Der erste Monat darf fehlen („vom 21. bis 27. September") — dann gilt der zweite.
 */
export function wocheAus(ueberschrift: string, jahr: number): string | null {
  const m = /vom\s+(\d{1,2})\.\s*(?:([A-Za-zäöü]+)|(\d{1,2})\.)?\s*bis\s+(\d{1,2})\.\s*([A-Za-zäöü]+|\d{1,2})/i.exec(ueberschrift)
  if (!m) return null
  const zweiter = m[5]
  const monatBis = monatAus(/^[A-Za-zäöü]+$/.test(zweiter) ? zweiter : undefined, /^\d+$/.test(zweiter) ? zweiter : undefined)
  const monatVon = monatAus(m[2], m[3]) ?? monatBis
  if (!monatVon || !monatBis) return null
  /* Eine Woche über den Jahreswechsel („vom 29. Dezember bis 4. Januar") beginnt im Vorjahr. */
  return iso(monatVon === 12 && monatBis === 1 ? jahr - 1 : jahr, monatVon, Number(m[1]))
}
