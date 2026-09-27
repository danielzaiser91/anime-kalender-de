/**
 * Fassung des Vorschaubild-Aussehens. `build-og.ts` zeichnet alle Bilder neu, wenn sie sich ändert;
 * die Teilen-Seiten hängen sie als `?v=` an die Bildadresse. Messenger halten Vorschauen tage- bis
 * wochenlang — nur eine neue Adresse holt das neue Bild (Daniel, 27.09.2026: Startseite zeigte in
 * der Vorschau noch das alte Design, obwohl der Server längst das neue auslieferte).
 * Bei jeder Änderung an `og-karte.ts` hochzählen.
 */
export const OG_FASSUNG = 'poster-1'
