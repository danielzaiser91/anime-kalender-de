import { fehlerLog } from './werte.ts'
/** Nur das, was der Löschlauf von der Datenbank braucht — so lässt sich das Modul auch ohne Cloudflare-Typen (Root-`tsc`, `check:logic`) prüfen. */
type Env = { DB: { prepare(sql: string): { bind(...werte: string[]): { run(): Promise<{ meta?: { changes?: number } }> } } } }

/** Die Fristen stehen so in der Datenschutzerklärung (`web/src/components/Datenschutz.tsx`); beide Stellen zusammen ändern. */
/** Der Löschlauf läuft stündlich: eine Zeile lebt 60 bis 120 Minuten, der Text sagt „bis zu zwei Stunden". */
export const RATE_LIMIT_MINUTEN = 60
export const UNBESTAETIGT_TAGE = 7
/** Push-Abos, deren Browser sich so lange nicht gemeldet hat (die Seite erneuert bei jedem Start); der Durchlauf läuft einmal täglich zur angegebenen UTC-Stunde. */
export const PUSH_TOT_TAGE = 90
export const PUSH_TOT_STUNDE_UTC = 3

export const SQL_RATE_LIMIT_LOESCHEN = 'DELETE FROM rate_limit WHERE window_start < ?1'
export const SQL_PUSH_TOT_LOESCHEN = 'DELETE FROM push_abo WHERE COALESCE(erneuert, erstellt) < ?1'
export const SQL_UNBESTAETIGT_LOESCHEN = "DELETE FROM subscribers WHERE status = 'pending' AND created_at < ?1"

export type Geloescht = { rateLimit: number; unbestaetigt: number; pushTot: number }

/**
 * Stündlicher Löschlauf: abgelaufene Ratenbegrenzungs-Zähler (enthalten IPs) und Anmeldungen,
 * die nie bestätigt wurden (E-Mail + IP ohne Einwilligung). Gibt die Zahl gelöschter Zeilen zurück.
 */
export async function loescheAbgelaufenes(env: Env, jetzt: Date): Promise<Geloescht> {
  try {
    return await loesche(env, jetzt)
  } catch (e) {
    fehlerLog('[loeschen] fehlgeschlagen', e)
    return { rateLimit: 0, unbestaetigt: 0, pushTot: 0 }
  }
}

async function loesche(env: Env, jetzt: Date): Promise<Geloescht> {
  const rateGrenze = new Date(jetzt.getTime() - RATE_LIMIT_MINUTEN * 60_000).toISOString()
  const anmeldeGrenze = new Date(jetzt.getTime() - UNBESTAETIGT_TAGE * 86_400_000).toISOString()
  const rl = await env.DB.prepare(SQL_RATE_LIMIT_LOESCHEN).bind(rateGrenze).run()
  const un = await env.DB.prepare(SQL_UNBESTAETIGT_LOESCHEN).bind(anmeldeGrenze).run()
  const pushTot = await loeschePushTot(env, jetzt)
  const n = { rateLimit: rl.meta?.changes ?? 0, unbestaetigt: un.meta?.changes ?? 0, pushTot }
  console.log(`[loeschen] Ratenbegrenzung ${n.rateLimit}, unbestätigte Anmeldungen ${n.unbestaetigt}, tote Push-Abos ${n.pushTot}`)
  return n
}

/** Einmal am Tag (ein Durchlauf über `push_abo`, nicht stündlich): Abos ohne Erneuerung seit 90 Tagen. */
async function loeschePushTot(env: Env, jetzt: Date): Promise<number> {
  if (jetzt.getUTCHours() !== PUSH_TOT_STUNDE_UTC) return 0
  const grenze = new Date(jetzt.getTime() - PUSH_TOT_TAGE * 86_400_000).toISOString()
  const r = await env.DB.prepare(SQL_PUSH_TOT_LOESCHEN).bind(grenze).run()
  return r.meta?.changes ?? 0
}
