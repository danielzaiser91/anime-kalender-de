/**
 * Fenster, Schwellen und Bewertung der D1-Verbrauchsprüfung (`tools/d1-verbrauch.mjs`), ohne Netz und
 * ohne Exit, damit `tools/d1-verbrauch.test.mjs` sie prüfen kann.
 */

export const KONTINGENT_GELESEN = 5_000_000
export const KONTINGENT_GESCHRIEBEN = 100_000

export const GRENZE_GESAMT = 2_500_000
export const GRENZE_EINZELN = 1_000_000
/*
  Schreib-Tageskontingent der freien Stufe: 100.000 Zeilen. Je Anfrage der Meldungs-Route gemessen
  (13.10.2026): 48 geschriebene Zeilen, 11 je Netflix-/Disney+-Folge, 5 je Prime-Rohfolge. Seit
  11.10.2026: ab 50.000 nur eine Warnzeile (Exit 0), rot erst ab 80.000 — der Plan ist unbestätigt, und
  am 11.10.2026 lief der Worker trotz 154.738 Zeilen am Tag weiter.
*/
export const WARNUNG_GESCHRIEBEN = 50_000
export const GRENZE_GESCHRIEBEN = 80_000

/**
 * Migrations-DDL, die `d1 insights` nicht zeigt (13.10.2026: 051 18.194 + 053 20.545 + 052 1 +
 * d1_migrations 7). Die Warnschwelle liegt so tief, dass Insights-Summe plus diese Lücke noch unter
 * dem Kontingent bleibt (Test).
 */
export const DDL_LUECKE_GEMESSEN = 38_747

/** So viele Abfragegruppen holt eine Insights-Anfrage; bei so vielen Gruppen ist die Summe unvollständig. */
export const ABFRAGEN_LIMIT = 1000

/** Insights zählen nach Stunden; der Puffer lässt das Fenster sicher vor 00:00 UTC beginnen (Wranglers Start liegt Sekunden später). */
export const PUFFER_MINUTEN = 5

/**
 * Das Fenster von 00:00 UTC bis jetzt als `--time-period`-Wert in Minuten. Das Kontingent (und unser
 * Deckel) zählt je UTC-Tag; `1d` sind gleitende 24 h und reichen in den Vortag.
 */
export function utcTagMinuten(jetzt) {
  const mitternacht = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate())
  return Math.ceil((jetzt.getTime() - mitternacht) / 60_000) + PUFFER_MINUTEN
}

const zahl = (n) => n.toLocaleString('de-DE')

/**
 * Befunde (rot) und Warnungen (gelb) aus den Summen.
 * `ddl` = geschriebene Zeilen aus Migrationen des Tages (nicht in den Insights, per `--ddl` angegeben);
 * `info` = gleitende 24 h laut `d1 info` (enthält DDL, reicht aber in den Vortag) oder `null`.
 */
export function bewerte({ gelesen, geschrieben, ddl = 0, groesste, info = null }) {
  const befunde = []
  const warnungen = []
  const geschriebenGesamt = geschrieben + ddl
  if (geschriebenGesamt > GRENZE_GESCHRIEBEN) {
    befunde.push(
      `${zahl(geschriebenGesamt)} geschriebene Zeilen über der Grenze ` +
        `${zahl(GRENZE_GESCHRIEBEN)} (Schreib-Kontingent der freien Stufe: ${zahl(KONTINGENT_GESCHRIEBEN)})`,
    )
  } else if (geschriebenGesamt > WARNUNG_GESCHRIEBEN) {
    warnungen.push(
      `${zahl(geschriebenGesamt)} geschriebene Zeilen, ` +
        `Warnschwelle ${zahl(WARNUNG_GESCHRIEBEN)} (rot ab ${zahl(GRENZE_GESCHRIEBEN)})`,
    )
  }
  if (gelesen > GRENZE_GESAMT) {
    befunde.push(`Gesamtverbrauch ${zahl(gelesen)} über der Grenze ${zahl(GRENZE_GESAMT)} (halbes Tageskontingent)`)
  }
  for (const q of groesste) {
    if ((q.totalRowsRead ?? 0) > GRENZE_EINZELN) {
      befunde.push(`eine Abfrage liest ${zahl(q.totalRowsRead)} Zeilen: ${String(q.query ?? '').replace(/\s+/g, ' ').slice(0, 96)}`)
    }
  }
  /* Dieselben Schwellen wie bei den Insights: Die Sperre greift verzögert (14.10.2026: 9,1 Mio. um 09:30 UTC, Worker lief noch um 09:44, 500 spätestens ab 10:16 UTC). */
  if (info && info.gelesen24h > GRENZE_GESAMT) {
    warnungen.push(`d1 info: ${zahl(info.gelesen24h)} gelesene Zeilen in 24 h (gleitend, mit DDL und Vortag; Warnschwelle ${zahl(GRENZE_GESAMT)}, Kontingent ${zahl(KONTINGENT_GELESEN)} je UTC-Tag)`)
  }
  if (info && info.geschrieben24h > WARNUNG_GESCHRIEBEN) {
    warnungen.push(`d1 info: ${zahl(info.geschrieben24h)} geschriebene Zeilen in 24 h (gleitend, mit DDL und Vortag; Warnschwelle ${zahl(WARNUNG_GESCHRIEBEN)}, Kontingent ${zahl(KONTINGENT_GESCHRIEBEN)} je UTC-Tag)`)
  }
  return { befunde, warnungen }
}
