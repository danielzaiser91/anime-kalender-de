/**
 * Schwellen und Bewertung der Kapazitätsmessung (`tools/kapazitaet-messen.mjs`), ohne Netz und ohne Exit,
 * damit `tools/kapazitaet.test.mjs` sie prüft (23.10.2026, Plan `skalierung-100-bis-100k.md`, B1).
 *
 * Free-Stufe: 100.000 Worker-Anfragen und 100.000 geschriebene D1-Zeilen je UTC-Tag und Konto. Rot ab
 * 70 % davon (Luft, bevor die Stufe wirklich sperrt) und bei einem Cron-CPU-p99 über 8 ms (Free-Limit
 * 10 ms je Aufruf). Rot nur für den schlimmsten Tag ab gestern, ältere Tage sind Warnung.
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

/** Der Tag vor `heute` (beide `JJJJ-MM-TT`, UTC). */
export function gestern(heute) {
  return new Date(Date.parse(`${heute}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

const REGELN = [
  ['anfragen', GRENZE_ANFRAGEN, (t) => `${zahl(t.anfragen)} Worker-Anfragen am ${t.datum} über ${zahl(GRENZE_ANFRAGEN)} (70 % von ${zahl(KONTINGENT_ANFRAGEN)})`],
  ['geschrieben', GRENZE_D1_GESCHRIEBEN, (t) => `${zahl(t.geschrieben)} D1-Zeilen geschrieben am ${t.datum} über ${zahl(GRENZE_D1_GESCHRIEBEN)} (70 % von ${zahl(KONTINGENT_D1_GESCHRIEBEN)})`],
  ['cronP99Ms', GRENZE_CRON_P99_MS, (t) => `Cron-CPU p99 ${t.cronP99Ms.toFixed(1)} ms am ${t.datum} über ${GRENZE_CRON_P99_MS} ms (Free-Limit 10 ms)`],
]

/**
 * `tage`: `[{ datum, anfragen, geschrieben, cronP99Ms, ueberCpu }]` (fehlende Messung = `null`); `heute`: UTC-Datum.
 * Befund (rot) nur für Tage ab gestern; ältere Tage über der Schwelle sind eine Warnung (Altbefund), sonst
 * hielt eine behobene Spitze die Wache sieben Tage rot und verdeckte jede neue (08.11.2026).
 */
export function bewerteKapazitaet(tage, heute) {
  const grenzeTag = gestern(heute)
  const frisch = tage.filter((t) => t.datum >= grenzeTag)
  const alt = tage.filter((t) => t.datum < grenzeTag)
  const befunde = []
  const warnungen = []
  for (const [feld, grenze, text] of REGELN) {
    const f = schlimmster(frisch, feld)
    if (f && f[feld] > grenze) befunde.push(`Kapazität: ${text(f)}`)
    for (const a of alt) {
      if (a[feld] != null && a[feld] > grenze) warnungen.push(`Kapazität (Altbefund, älter als gestern): ${text(a)}`)
    }
  }
  const u = schlimmster(tage, 'ueberCpu')
  if (u && u.ueberCpu > 0) {
    warnungen.push(`Kapazität: ${zahl(u.ueberCpu)} Aufrufe mit überschrittener CPU-Zeit am ${u.datum}`)
  }
  return { befunde, warnungen }
}
