/**
 * Grenzen der Lighthouse-Messung (`lighthouse-messen.mjs`), je Profil (`pr`: Build ohne Netz-CDN-Cache, `live`: anime-kalender.de) und Seite.
 * Obergrenzen: lcp/tbt in ms, cls, bytes (Übertragung gesamt); Untergrenzen: Kategorien in Punkten. Herleitung und Messtag: docs/wissen/betrieb.md,
 * Abschnitt „Lighthouse und Leerlauf als Wächter“. Ratsche: eine Grenze darf nur strenger werden (Prüfung gegen main im PR).
 */
export const SEITEN = {
  Kalender: '',
  Datenbank: '#/datenbank',
  Titel: '#/datenbank?t=21',
}

const VORLAEUFIG = {
  Kalender: { lcp: 2500, cls: 0.1, tbt: 200, bytes: 400000, performance: 90, accessibility: 90, 'best-practices': 90, seo: 90 },
  Datenbank: { lcp: 15000, cls: 0.1, tbt: 1000, bytes: 3000000, performance: 50, accessibility: 90, 'best-practices': 90, seo: 90 },
  Titel: { lcp: 10000, cls: 0.1, tbt: 1000, bytes: 1500000, performance: 50, accessibility: 90, 'best-practices': 90, seo: 90 },
}

export const GRENZEN = {
  pr: VORLAEUFIG,
  live: VORLAEUFIG,
}
