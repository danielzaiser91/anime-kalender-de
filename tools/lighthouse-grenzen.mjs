/**
 * Grenzen der Lighthouse-Messung (`lighthouse-messen.mjs`), je Profil (`pr`: Build in der PR-Kette, `live`: anime-kalender.de) und Seite.
 * Obergrenzen: lcp/tbt in ms, cls, bytes (Übertragung gesamt, mit Covern); Untergrenzen: Kategorien in Punkten.
 * Ratsche: eine Grenze darf nur strenger werden (Prüfung gegen main im PR). Herleitung: docs/wissen/betrieb.md, „Lighthouse und Leerlauf als Wächter“.
 *
 * Basis 18.11.2026, Median aus 3 Läufen, CI-Runner (PR-Kette Lauf 44259412724 gegen dist, Live Lauf 44259410560):
 * Budget LCP ≤ 2500, CLS ≤ 0,1, TBT ≤ 200 wo heute eingehalten; sonst Ratsche = höherer Median der beiden Profile × 1,15 (LCP) bzw. × 1,3 (TBT, streut
 * stärker: Einzelläufe 205–312 ms bei Median 228). Bytes: Median × 1,25 (Kalender: Cover der Woche wechseln) bzw. × 1,15 (Datenbank, Titel).
 * Performance: Median − 5 Punkte (Einzelläufe streuten ±4); Accessibility und SEO deterministisch, ohne Abstand; Best Practices − 4 (die Konsole zählt
 * Fehler fremder Cover-Adressen mit).
 */
export const SEITEN = {
  Kalender: '',
  Datenbank: '#/datenbank',
  Titel: '#/datenbank?t=21',
}

/** Beide Profile messen dieselben Seiten; die Basis lag je Kennzahl höchstens 12 % auseinander, eine gemeinsame Grenze deckt beide. */
const BASIS_18_11 = {
  // Median pr/live: LCP 923/981, TBT 53/25, Bytes 609 343/611 496, Kategorien 100/96/100/100.
  Kalender: { lcp: 2500, cls: 0.1, tbt: 200, bytes: 770000, performance: 95, accessibility: 96, 'best-practices': 96, seo: 100 },
  // Median pr/live: LCP 12 750/14 255, TBT 228/264, Bytes 2 895 718/2 969 651, Performance 71/70 — LCP, TBT und Bytes über Budget (Ratsche).
  Datenbank: { lcp: 16500, cls: 0.1, tbt: 350, bytes: 3450000, performance: 65, accessibility: 100, 'best-practices': 96, seo: 100 },
  // Median pr/live: LCP 15 406/16 518, TBT 353/375, Bytes 3 362 521/3 435 182, Performance 66/65 — LCP, TBT und Bytes über Budget (Ratsche).
  Titel: { lcp: 19000, cls: 0.1, tbt: 490, bytes: 4000000, performance: 60, accessibility: 100, 'best-practices': 96, seo: 100 },
}

export const GRENZEN = {
  pr: BASIS_18_11,
  live: BASIS_18_11,
}
