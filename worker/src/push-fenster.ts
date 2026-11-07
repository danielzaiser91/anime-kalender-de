import { berlinParts } from './werte.ts'

/**
 * Vorfilter über das Datum (Stringvergleich): nur Termine vom Berliner Tag vor `von` bis zum Berliner Tag nach `bis`.
 * Was außerhalb liegt, ist zu beiden Zeitpunkten gleich erschienen (oder gleich nicht) und kann nie „neu“ sein. Spart die
 * Zeitzonenrechnung (`berlinToUtc`, Intl) für die übrigen Tausende Termine der Datei: CPU je Aufruf von ~90 ms auf ~1 ms.
 */
export function imTagesfenster<T extends { date: string }>(ereignisse: T[], von: Date, bis: Date): T[] {
  const ab = berlinParts(new Date(von.getTime() - 86_400_000)).iso
  const zu = berlinParts(new Date(bis.getTime() + 86_400_000)).iso
  return ereignisse.filter((e) => e.date >= ab && e.date <= zu)
}
