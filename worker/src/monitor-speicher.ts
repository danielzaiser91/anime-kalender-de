/** Schreibt die Ergebnisse eines Wächter-Laufs in die Datenbank. */
import type { CheckResult } from './monitor.ts'
import { fehlerLog } from './werte.ts'

const VERLAUF_TAGE = 60
/** Die UTC-Stunde, in der der stündliche Lauf aufräumt: einmal am Tag genügt (ohne Index auf `checked_at` liest jedes Aufräumen die Tabelle, 1,6 bis 3,5 k Zeilen). */
const AUFRAEUM_STUNDE_UTC = 3

/**
 * Hängt die Messung dieses Laufs an den Verlauf und räumt Altes weg (einmal am Tag). Ein Fehler
 * hier darf den Lauf nicht abbrechen — der Verlauf ist Beiwerk, die Prüfung nicht.
 */
export async function schreibeVerlauf(db: D1Database, results: CheckResult[], nowIso: string): Promise<void> {
  try {
    const grenze = new Date(Date.parse(nowIso) - VERLAUF_TAGE * 86_400_000).toISOString()
    const aufraeumen = new Date(nowIso).getUTCHours() === AUFRAEUM_STUNDE_UTC
    await db.batch([
      ...results.map((r) =>
        db
          .prepare('INSERT OR IGNORE INTO site_history (url, checked_at, ok, ms) VALUES (?1, ?2, ?3, ?4)')
          .bind(r.site.url, nowIso, r.ok ? 1 : 0, r.ms),
      ),
      ...(aufraeumen ? [db.prepare('DELETE FROM site_history WHERE checked_at < ?1').bind(grenze)] : []),
    ])
  } catch (err) {
    fehlerLog('Messverlauf nicht gespeichert', err)
  }
}

/**
 * Schreibt den Stand je Seite fort. Einzeln statt gebündelt, damit ein Fehler
 * bei einer Zeile nicht die übrigen mitreißt.
 */
export async function schreibeStaende(
  db: D1Database,
  results: CheckResult[],
  failStreaks: number[],
  letzteOk: Map<string, string | null>,
  nowIso: string,
): Promise<void> {
  for (const [i, r] of results.entries()) {
    await db
      .prepare(
        `INSERT INTO site_status (url, name, ok, status, ms, reason, checked_at, last_ok_at, fail_streak)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(url) DO UPDATE SET
         name = excluded.name, ok = excluded.ok, status = excluded.status, ms = excluded.ms,
         reason = excluded.reason, checked_at = excluded.checked_at,
         last_ok_at = excluded.last_ok_at, fail_streak = excluded.fail_streak`,
      )
      .bind(
        r.site.url,
        r.site.name,
        r.ok ? 1 : 0,
        r.status,
        r.ms,
        r.reason ?? null,
        nowIso,
        r.ok ? nowIso : (letzteOk.get(r.site.url) ?? null),
        failStreaks[i],
      )
      .run()
  }
}
