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
    // Eine Abfrage für alle Seiten: jede Anweisung eines Stapels kann als eigener Unteraufruf zählen (Grenze 50 je Aufruf).
    const zeilen = JSON.stringify(results.map((r) => [r.site.url, r.ok ? 1 : 0, r.ms]))
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO site_history (url, checked_at, ok, ms)
           SELECT json_extract(value, '$[0]'), ?2, json_extract(value, '$[1]'), json_extract(value, '$[2]') FROM json_each(?1)`,
        )
        .bind(zeilen, nowIso),
      ...(aufraeumen ? [db.prepare('DELETE FROM site_history WHERE checked_at < ?1').bind(grenze)] : []),
    ])
  } catch (err) {
    fehlerLog('Messverlauf nicht gespeichert', err)
  }
}

/**
 * Schreibt den Stand je Seite fort, alle Seiten in einer Abfrage: 19 einzelne Upserts kosteten 19 der 50
 * Unteraufrufe, die sich der stündliche Cron-Aufruf teilt (Messung 14.10.2026). `WHERE true` braucht SQLite,
 * damit `ON CONFLICT` nach einem SELECT nicht als Join-Bedingung gelesen wird.
 */
export async function schreibeStaende(
  db: D1Database,
  results: CheckResult[],
  failStreaks: number[],
  letzteOk: Map<string, string | null>,
  nowIso: string,
): Promise<void> {
  const zeilen = results.map((r, i) => ({
    url: r.site.url,
    name: r.site.name,
    ok: r.ok ? 1 : 0,
    status: r.status,
    ms: r.ms,
    reason: r.reason ?? null,
    lastOk: r.ok ? nowIso : (letzteOk.get(r.site.url) ?? null),
    streak: failStreaks[i],
  }))
  const feld = (name: string) => `json_extract(value, '$.${name}')`
  await db
    .prepare(
      `INSERT INTO site_status (url, name, ok, status, ms, reason, checked_at, last_ok_at, fail_streak)
       SELECT ${['url', 'name', 'ok', 'status', 'ms', 'reason'].map(feld).join(', ')}, ?2, ${feld('lastOk')}, ${feld('streak')}
       FROM json_each(?1) WHERE true
       ON CONFLICT(url) DO UPDATE SET
         name = excluded.name, ok = excluded.ok, status = excluded.status, ms = excluded.ms,
         reason = excluded.reason, checked_at = excluded.checked_at,
         last_ok_at = excluded.last_ok_at, fail_streak = excluded.fail_streak`,
    )
    .bind(JSON.stringify(zeilen), nowIso)
    .run()
}
