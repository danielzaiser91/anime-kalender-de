/*
  **Welche Prime-Einträge der Durchgang öffnen kann** — eigene Datei, weil `amazon.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `amazon.js`.
*/
globalThis.akPrimeHatTitelseite = (eintrag) => /\/detail\//.test(String(eintrag?.url ?? ''))
