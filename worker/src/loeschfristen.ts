/** Nur das, was der Löschlauf von der Datenbank braucht — so lässt sich das Modul auch ohne Cloudflare-Typen (Root-`tsc`, `check:logic`) prüfen. */
type Env = { DB: { prepare(sql: string): { bind(...werte: string[]): { run(): Promise<{ meta?: { changes?: number } }> } } } }

/** Die Fristen stehen so in der Datenschutzerklärung (`web/src/components/Datenschutz.tsx`); beide Stellen zusammen ändern. */
/** Der Löschlauf läuft stündlich: eine Zeile lebt 60 bis 120 Minuten, der Text sagt „bis zu zwei Stunden". */
export const RATE_LIMIT_MINUTEN = 60
export const UNBESTAETIGT_TAGE = 7

export const SQL_RATE_LIMIT_LOESCHEN = 'DELETE FROM rate_limit WHERE window_start < ?1'
export const SQL_UNBESTAETIGT_LOESCHEN = "DELETE FROM subscribers WHERE status = 'pending' AND created_at < ?1"

/**
 * Stündlicher Löschlauf: abgelaufene Ratenbegrenzungs-Zähler (enthalten IPs) und Anmeldungen,
 * die nie bestätigt wurden (E-Mail + IP ohne Einwilligung). Gibt die Zahl gelöschter Zeilen zurück.
 */
export async function loescheAbgelaufenes(env: Env, jetzt: Date): Promise<{ rateLimit: number; unbestaetigt: number }> {
  try {
    return await loesche(env, jetzt)
  } catch (e) {
    console.error('[loeschen] fehlgeschlagen', e)
    return { rateLimit: 0, unbestaetigt: 0 }
  }
}

async function loesche(env: Env, jetzt: Date): Promise<{ rateLimit: number; unbestaetigt: number }> {
  const rateGrenze = new Date(jetzt.getTime() - RATE_LIMIT_MINUTEN * 60_000).toISOString()
  const anmeldeGrenze = new Date(jetzt.getTime() - UNBESTAETIGT_TAGE * 86_400_000).toISOString()
  const rl = await env.DB.prepare(SQL_RATE_LIMIT_LOESCHEN).bind(rateGrenze).run()
  const un = await env.DB.prepare(SQL_UNBESTAETIGT_LOESCHEN).bind(anmeldeGrenze).run()
  const n = { rateLimit: rl.meta?.changes ?? 0, unbestaetigt: un.meta?.changes ?? 0 }
  console.log(`[loeschen] Ratenbegrenzung ${n.rateLimit}, unbestätigte Anmeldungen ${n.unbestaetigt}`)
  return n
}
