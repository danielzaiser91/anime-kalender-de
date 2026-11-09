/**
 * Schwellen und Bewertung der Kapazitätsmessung (`tools/kapazitaet-messen.mjs`), ohne Netz und ohne Exit,
 * damit `tools/kapazitaet.test.mjs` sie prüft (23.10.2026, Plan `skalierung-100-bis-100k.md`, B1).
 *
 * Free-Stufe: 100.000 Worker-Anfragen und 100.000 geschriebene D1-Zeilen je UTC-Tag und Konto. Rot ab
 * 70 % davon (Luft, bevor die Stufe wirklich sperrt) und bei einem Cron-CPU-p99 über 8 ms (Free-Limit
 * 10 ms je Aufruf). Anfragen und D1-Schreiben zählen nur in den letzten zwei Tagen als Befund (09.11.2026), Cron-CPU über das ganze Fenster.
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

/** Die letzten so vielen UTC-Tage des Fensters sind „frisch“: dort ist eine Überschreitung rot, davor nur eine Warnung. */
export const FRISCHE_TAGE = 2

/** Anfragen je Skript eines Tages; ohne `jeSkript` (ältere Messzeilen) gilt die Summe als ein Eintrag. */
const jeSkript = (t) => (t.jeSkript && Object.keys(t.jeSkript).length ? t.jeSkript : { '(gesamt)': t.anfragen })

/** Überschreitungen von Anfragen (je Skript) und D1-Schreiben je Tag: `{ frisch, alt }` mit fertigen Texten. */
function ueberschreitungen(tage) {
  const frisch = []
  const alt = []
  tage.forEach((t, i) => {
    const liste = i >= tage.length - FRISCHE_TAGE ? frisch : alt
    let einzelnUeber = false
    for (const [name, n] of Object.entries(jeSkript(t))) {
      if (n != null && n > GRENZE_ANFRAGEN) {
        einzelnUeber = true
        liste.push(`${zahl(n)} Worker-Anfragen im Skript ${name} am ${t.datum} über ${zahl(GRENZE_ANFRAGEN)} (70 % von ${zahl(KONTINGENT_ANFRAGEN)})`)
      }
    }
    /* Das Kontolimit zählt die Summe aller Skripte; ein einzelnes Skript über der Grenze ist damit schon gemeldet. */
    if (!einzelnUeber && t.anfragen != null && t.anfragen > GRENZE_ANFRAGEN) {
      liste.push(`${zahl(t.anfragen)} Worker-Anfragen aller Skripte am ${t.datum} über ${zahl(GRENZE_ANFRAGEN)} (70 % von ${zahl(KONTINGENT_ANFRAGEN)})`)
    }
    if (t.geschrieben != null && t.geschrieben > GRENZE_D1_GESCHRIEBEN) {
      liste.push(`${zahl(t.geschrieben)} D1-Zeilen geschrieben am ${t.datum} über ${zahl(GRENZE_D1_GESCHRIEBEN)} (70 % von ${zahl(KONTINGENT_D1_GESCHRIEBEN)})`)
    }
  })
  return { frisch, alt }
}

/**
 * `tage`: `[{ datum, anfragen, jeSkript, geschrieben, cronP99Ms, ueberCpu }]` (älteste zuerst; fehlende Messung = `null`).
 * Gibt Befunde (rot) und Warnungen (gelb) zurück. Anfragen (Grenze je Skript, nicht die Summe, damit ein kleines
 * fremdes Skript wie `ak-adn-gw` nichts mitzählt) und D1-Schreiben sind nur in den letzten `FRISCHE_TAGE` Tagen
 * rot; eine abgeschlossene Spitze davor bleibt als Warnung mit Datum sichtbar, statt die Wache sieben Tage rot zu halten.
 */
export function bewerteKapazitaet(tage) {
  const { frisch, alt } = ueberschreitungen(tage)
  const befunde = frisch.map((m) => `Kapazität: ${m}`)
  const warnungen = alt.map((m) => `Kapazität: ${m} (älter als ${FRISCHE_TAGE} Tage, nicht mehr rot)`)
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
