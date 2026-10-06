/** Auswertung der Schnellmessung (`site_probe`): je Stunde Mittel, Höchstwert und Zahl schlechter Messungen der letzten 48 Stunden, dazu die Alarme. */
import { LANGSAM_MS } from '../../shared/schnellmessung-regeln.ts'
import type { Env } from './env.ts'

const STUNDEN = 48

export async function handleVerlauf(env: Env): Promise<Record<string, unknown>> {
  const seit = new Date(Date.now() - STUNDEN * 3_600_000).toISOString()
  const { results: stunden } = await env.DB.prepare(
    `SELECT url, substr(checked_at, 1, 13) AS stunde, COUNT(*) AS messungen, ROUND(AVG(total_ms)) AS mittel_ms, MAX(total_ms) AS max_ms,
            SUM(CASE WHEN ok = 0 OR total_ms > ?2 THEN 1 ELSE 0 END) AS schlecht
       FROM site_probe WHERE checked_at >= ?1 GROUP BY url, stunde ORDER BY stunde DESC, url`,
  )
    .bind(seit, LANGSAM_MS)
    .all()
  const { results: alarme } = await env.DB.prepare('SELECT url, seit, grund, geschlossen_am FROM monitor_alarm ORDER BY id DESC LIMIT 20').all()
  return { stunden: stunden ?? [], alarme: alarme ?? [], langsamAbMs: LANGSAM_MS }
}
