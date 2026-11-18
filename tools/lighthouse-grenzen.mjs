/**
 * Grenzen der Lighthouse-Messung (`lighthouse-messen.mjs`), je Profil (`pr`: Build in der PR-Kette, `live`: anime-kalender.de) und Seite.
 * Obergrenzen: lcp/tbt in ms, cls, bytes (Übertragung gesamt, mit Covern); Untergrenzen: Kategorien in Punkten.
 * Ratsche: eine Grenze darf nur strenger werden (Prüfung gegen main im PR). Herleitung: docs/wissen/betrieb.md, „Lighthouse und Leerlauf als Wächter“.
 *
 * Basis 18.11.2026, je Median aus 3 Läufen auf CI-Runnern: zwei PR-Läufe gegen dist (44259412724, 44260602007) und drei Live-Läufe (44259410560, 44260603953, 44261473268).
 * Budget LCP ≤ 2500, CLS ≤ 0,1, TBT ≤ 200 wo auf jedem Runner eingehalten; sonst Ratsche = höchster Median × 1,15 (LCP, ±10 %) bzw. × 1,3 (TBT).
 * TBT und Performance hängen am Runner: derselbe Stand ergab TBT 228–765 ms (Datenbank), 25–206 ms (Kalender), Performance 71–56 — Lighthouse simuliert 4× CPU auf
 * dem jeweiligen Rechner. Deshalb deckt der Abstand den langsamsten gesehenen Runner. Bytes: höchster Median × 1,15 (Datenwachstum; Kalender zweigipflig,
 * 0,61 oder 1,17 MB, je nachdem, ob das Nachladen der vollen Daten nach ≤ 6 s noch ins Messfenster fällt). Performance: niedrigster Median − 5.
 * Accessibility und SEO deterministisch, ohne Abstand; Best Practices − 4 (die Konsole zählt Fehler fremder Cover-Adressen mit).
 */
export const SEITEN = {
  Kalender: '',
  Datenbank: '#/datenbank',
  Titel: '#/datenbank?t=21',
}

/** Beide Profile messen dieselben Seiten; LCP und Bytes lagen höchstens 12 % auseinander, eine gemeinsame Grenze deckt beide. */
const BASIS_18_11 = {
  // Median pr1/pr2/live1/live2/live3: LCP 923/931/981/981/933, TBT 53/99/25/128/206 (Budget 200 auf langsamem Runner gerissen: Ratsche), Bytes 609 343–1 174 783, Performance 100/99/100/99/97.
  Kalender: { lcp: 2500, cls: 0.1, tbt: 270, bytes: 1350000, performance: 92, accessibility: 96, 'best-practices': 96, seo: 100 },
  // Median pr1/pr2/live1/live2/live3: LCP 12 750/12 359/14 255/14 328/11 481, TBT 228/591/264/751/765, Bytes 2 895 718–2 970 014, Performance 71/60/70/57/56 — über Budget.
  Datenbank: { lcp: 16500, cls: 0.1, tbt: 1000, bytes: 3450000, performance: 51, accessibility: 100, 'best-practices': 96, seo: 100 },
  // Median pr1/pr2/live1/live2/live3: LCP 15 406/13 761/16 518/6 977/16 883, TBT 353/920/375/588/1 083, Bytes ≈ 2 048 000–3 479 058, Performance 66/53/65/61/52 — über Budget.
  Titel: { lcp: 19500, cls: 0.1, tbt: 1410, bytes: 4000000, performance: 47, accessibility: 100, 'best-practices': 96, seo: 100 },
}

export const GRENZEN = {
  pr: BASIS_18_11,
  live: BASIS_18_11,
}
