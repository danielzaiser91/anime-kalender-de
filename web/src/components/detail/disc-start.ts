import type { Dataset } from '../../lib/data.ts'

/**
 * **Startet der Stream/Disc-Umschalter auf „Disc"?**
 *
 * Über einen Termin aus dem Bereich „Im Handel" geöffnet ja: „der toggle
 * zwischen stream/disc wählt bei einem klick vom im handel heraus nicht automatisch disc aus".
 * Der Wert dient zugleich als `key` des Kastens: Beim Wechsel Disc ↔ Stream baut React ihn neu
 * auf, damit der Startwert greift — ein Effekt würde auch eine bewusste Wahl überschreiben.
 * Eigene Datei, damit `DetailPanel` nicht weiter wächst (Codegestalt).
 */
export function startetMitDisc(data: Dataset, releaseSlug: string | undefined): boolean {
  return Boolean(releaseSlug && data.releaseBySlug.get(releaseSlug)?.releaseType === 'disc')
}
