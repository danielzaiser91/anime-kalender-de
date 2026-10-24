/**
 * Schwellen und Bewertung der Kapazitätsmessung (`tools/kapazitaet-messen.mjs`), ohne Netz und ohne Exit,
 * damit `tools/kapazitaet.test.mjs` sie prüft (23.10.2026, Plan `skalierung-100-bis-100k.md`, B1).
 *
 * Free-Stufe: 100.000 Worker-Anfragen und 100.000 geschriebene D1-Zeilen je UTC-Tag und Konto. Rot ab
 * 70 % davon (Luft, bevor die Stufe wirklich sperrt) und bei einem Cron-CPU-p99 über 8 ms (Free-Limit
 * 10 ms je Aufruf). Bewertet wird der schlimmste Tag des Messfensters.
 */
export const KONTINGENT_ANFRAGEN = 100_000
export const KONTINGENT_D1_GESCHRIEBEN = 100_000
export const ANTEIL_GRENZE = 0.7
export const GRENZE_ANFRAGEN = KONTINGENT_ANFRAGEN * ANTEIL_GRENZE
export const GRENZE_D1_GESCHRIEBEN = KONTINGENT_D1_GESCHRIEBEN * ANTEIL_GRENZE
export const GRENZE_CRON_P99_MS = 8

const zahl = (n) => n.toLocaleString('de-DE')

/** Der Tag mit dem größten Wert von `feld` (der erste bei Gleichstand), oder `null` ohne Messwerte. */
function schlimmster(tage, feld) {
  let best = null
  for (const t of tage) {
    if (t[feld] == null) continue
    if (best === null || t[feld] > best[feld]) best = t
  }
  return best
}

/**
 * `tage`: `[{ datum, anfragen, geschrieben, cronP99Ms, ueberCpu }]` (fehlende Messung = `null`).
 * Gibt Befunde (rot) und Warnungen (gelb) zurück.
 */
export function bewerteKapazitaet(tage) {
  const befunde = []
  const warnungen = []
  const a = schlimmster(tage, 'anfragen')
  if (a && a.anfragen > GRENZE_ANFRAGEN) {
    befunde.push(`Kapazität: ${zahl(a.anfragen)} Worker-Anfragen am ${a.datum} über ${zahl(GRENZE_ANFRAGEN)} (70 % von ${zahl(KONTINGENT_ANFRAGEN)})`)
  }
  const g = schlimmster(tage, 'geschrieben')
  if (g && g.geschrieben > GRENZE_D1_GESCHRIEBEN) {
    befunde.push(`Kapazität: ${zahl(g.geschrieben)} D1-Zeilen geschrieben am ${g.datum} über ${zahl(GRENZE_D1_GESCHRIEBEN)} (70 % von ${zahl(KONTINGENT_D1_GESCHRIEBEN)})`)
  }
  const c = schlimmster(tage, 'cronP99Ms')
  if (c && c.cronP99Ms > GRENZE_CRON_P99_MS) {
    befunde.push(`Kapazität: Cron-CPU p99 ${c.cronP99Ms.toFixed(1)} ms am ${c.datum} über ${GRENZE_CRON_P99_MS} ms (Free-Limit 10 ms)`)
  }
  const u = schlimmster(tage, 'ueberCpu')
  if (u && u.ueberCpu > 0) {
    warnungen.push(`Kapazität: ${zahl(u.ueberCpu)} Aufrufe mit überschrittener CPU-Zeit am ${u.datum}`)
  }
  return { befunde, warnungen }
}
