/**
 * **Stundensicht der Kapazitätsmessung** (09.11.2026): Anfragen je Skript und UTC-Stunde aus
 * `workersInvocationsAdaptive` (Dimension `datetimeHour`, dieselbe Zeitdimension wie `datetimeMinute` in der
 * GraphQL-Analytics-Doku, Seite „data-sets“; am echten Konto noch nicht gemessen, darum fail-soft: ein
 * Fehler der Abfrage ist eine Warnung, nie rot). Cloudflare hält Stundendaten nur wenige Tage; das Protokoll
 * ist deshalb die Aufbewahrung — Anlass: Spitze 06./07.11.2026 im Skript `newsletter`, Pfad unbekannt.
 */
export const STUNDEN_ABFRAGE =
  'query($konto:String!,$von:Time!,$bis:Time!){viewer{accounts(filter:{accountTag:$konto}){' +
  'workersInvocationsAdaptive(limit:5000,filter:{datetime_geq:$von,datetime_lt:$bis}){dimensions{scriptName datetimeHour} sum{requests}}' +
  '}}}'

/** Rohzeilen → `{ skript: { 'YYYY-MM-DD': [24 Zahlen] } }`; Zeilen ohne Stunde oder Skript werden übergangen. */
export function stundenTabelle(zeilen) {
  const tabelle = {}
  for (const z of zeilen ?? []) {
    const name = z.dimensions?.scriptName
    const zeit = z.dimensions?.datetimeHour
    if (!name || typeof zeit !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d/.test(zeit)) continue
    const tag = zeit.slice(0, 10)
    const reihe = ((tabelle[name] ??= {})[tag] ??= Array(24).fill(0))
    reihe[Number(zeit.slice(11, 13))] += z.sum?.requests ?? 0
  }
  return tabelle
}

/** Protokollzeilen: je Skript und Tag eine Zeile mit den 24 Stundenwerten (Tage ohne Anfragen entfallen). */
export function stundenZeilen(tabelle) {
  const zeilen = []
  for (const name of Object.keys(tabelle).sort()) {
    for (const tag of Object.keys(tabelle[name]).sort()) {
      const reihe = tabelle[name][tag]
      const gesamt = reihe.reduce((a, n) => a + n, 0)
      if (gesamt > 0) zeilen.push(`  Stunden ${name} ${tag} (00–23 UTC, gesamt ${gesamt}): ${reihe.join(' ')}`)
    }
  }
  return zeilen.length ? ['Anfragen je Skript und UTC-Stunde:', ...zeilen] : []
}
