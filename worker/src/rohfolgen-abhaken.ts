/**
 * **Rohfolgen als übernommen markieren** (13.10.2026 aus `speichereDaten` herausgelöst, ohne
 * Verhaltensänderung). Begründung, warum nur Zugeordnetes abgehakt wird: `speichereDaten`.
 */
import { type Env } from './env.ts'

/* Dieselbe Stapelgrenze wie beim Abhaken der Meldungen: D1 bindet höchstens 100 Werte je Anfrage. */
const STAPEL = 50

export async function hakeRohfolgenAb(env: Env, ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += STAPEL) {
    const teil = ids.slice(i, i + STAPEL)
    await env.DB.prepare(`UPDATE prime_folge SET uebernommen = 1 WHERE id IN (${teil.map(() => '?').join(',')})`)
      .bind(...teil)
      .run()
  }
}
