/** Schreibt die Ergebnisse eines Wächter-Laufs in die Datenbank. */
import type { CheckResult } from './monitor.ts'

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
