/**
 * **Rohfolgen als übernommen markieren** (13.10.2026 aus `speichereDaten` herausgelöst).
 * Begründung, warum nur Zugeordnetes abgehakt wird: `speichereDaten`.
 *
 * Ids ab `PRUEFUNG_ID_AB` gehören Rohfolgen aus `pruefung.rohfolge` (Migration 054) und haken
 * `roh_uebernommen` ab — nicht `uebernommen`, das gehört dem Abhaken der Meldung durch `fetch-pruefungen.ts`.
 */
import { type Env } from './env.ts'
import { PRUEFUNG_ID_AB } from './rohfolgen-seiten.ts'

/* Dieselbe Stapelgrenze wie beim Abhaken der Meldungen: D1 bindet höchstens 100 Werte je Anfrage. */
const STAPEL = 50

async function hake(env: Env, tabelle: string, spalte: string, ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += STAPEL) {
    const teil = ids.slice(i, i + STAPEL)
    await env.DB.prepare(`UPDATE ${tabelle} SET ${spalte} = 1 WHERE id IN (${teil.map(() => '?').join(',')})`)
      .bind(...teil)
      .run()
  }
}

export async function hakeRohfolgenAb(env: Env, ids: number[]): Promise<void> {
  await hake(env, 'prime_folge', 'uebernommen', ids.filter((id) => id < PRUEFUNG_ID_AB))
  await hake(env, 'pruefung', 'roh_uebernommen', ids.filter((id) => id >= PRUEFUNG_ID_AB).map((id) => id - PRUEFUNG_ID_AB))
}
