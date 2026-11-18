/**
 * Grenzen der Lighthouse-Messung (`lighthouse-messen.mjs`), je Profil (`pr`: Build in der PR-Kette, `live`: anime-kalender.de) und Seite.
 * Obergrenzen: lcp/tbt in ms, cls, bytes (Übertragung gesamt, mit Covern); Untergrenzen: Kategorien in Punkten.
 * Ratsche: eine Grenze darf nur strenger werden (Prüfung gegen main im PR). Herleitung: docs/wissen/betrieb.md, „Lighthouse und Leerlauf als Wächter“.
 *
 * Basis 18.11.2026, je Median aus 3 Läufen auf CI-Runnern: zwei PR-Läufe gegen dist (44259412724, 44260602007) und ein Live-Lauf (44259410560).
 * Budget LCP ≤ 2500, CLS ≤ 0,1, TBT ≤ 200 wo heute eingehalten; sonst Ratsche = höchster Median × 1,15 (LCP, zwischen Läufen ±10 %) bzw. × 1,3 (TBT).
 * TBT und Performance hängen am Runner: derselbe Stand ergab TBT 228 und 591 ms (Datenbank), Performance 71 und 60 — Lighthouse simuliert 4× CPU auf
 * dem jeweiligen Rechner. Deshalb deckt der Abstand den langsamsten gesehenen Runner. Bytes: Median × 1,25 (Kalender: Cover der Woche wechseln)
 * bzw. × 1,15 (Datenbank, Titel). Performance: niedrigster Median − 5. Accessibility und SEO deterministisch, ohne Abstand; Best Practices − 4
 * (die Konsole zählt Fehler fremder Cover-Adressen mit).
 */
export const SEITEN = {
  Kalender: '',
  Datenbank: '#/datenbank',
  Titel: '#/datenbank?t=21',
}

/** Beide Profile messen dieselben Seiten; LCP und Bytes lagen höchstens 12 % auseinander, eine gemeinsame Grenze deckt beide. */
const BASIS_18_11 = {
  // Median pr1/pr2/live: LCP 923/931/981, TBT 53/99/25, Bytes 609 343/609 389/611 496, Performance 100/99/100, A11y 96.
  Kalender: { lcp: 2500, cls: 0.1, tbt: 200, bytes: 770000, performance: 94, accessibility: 96, 'best-practices': 96, seo: 100 },
  // Median pr1/pr2/live: LCP 12 750/12 359/14 255, TBT 228/591/264, Bytes 2 895 718/2 895 879/2 969 651, Performance 71/60/70 — LCP, TBT, Bytes über Budget.
  Datenbank: { lcp: 16500, cls: 0.1, tbt: 770, bytes: 3450000, performance: 55, accessibility: 100, 'best-practices': 96, seo: 100 },
  // Median pr1/pr2/live: LCP 15 406/13 761/16 518, TBT 353/920/375, Bytes 3 362 521/3 406 613/3 435 182, Performance 66/53/65 — LCP, TBT, Bytes über Budget.
  Titel: { lcp: 19000, cls: 0.1, tbt: 1200, bytes: 4000000, performance: 48, accessibility: 100, 'best-practices': 96, seo: 100 },
}

export const GRENZEN = {
  pr: BASIS_18_11,
  live: BASIS_18_11,
}
