/**
 * Fassung des Vorschaubild-Aussehens. `build-og.ts` zeichnet alle Bilder neu, wenn sie sich ändert;
 * die Teilen-Seiten hängen sie als `?v=` an die Bildadresse. Messenger halten Vorschauen tage- bis
 * wochenlang — nur eine neue Adresse holt das neue Bild (Daniel, 27.09.2026: Startseite zeigte in
 * der Vorschau noch das alte Design, obwohl der Server längst das neue auslieferte).
 * Bei jeder Änderung an `og-karte.ts` oder `og-termin.ts` (Beschriftung der Datumszeile) hochzählen; betrifft eine Textänderung nur wenige Bilder,
 * stattdessen die betroffenen gezielt neu zeichnen (`build-og.ts --nur <slug>`, 14.10.2026: „Nächste Folgen") und die Fassung lassen.
 */
export const OG_FASSUNG = 'kino-1'
