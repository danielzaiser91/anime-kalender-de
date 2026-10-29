/**
 * Suchadressen, zu denen seit dem Prüfstand gemeldet wurde (Prime). Wer über eine Suche einen Treffer
 * findet, meldet unter der Titeladresse; die Suche steht sonst bis zum nächsten Datenbau im Stand.
 */
import { type Env } from './env.ts'

export async function suchenSeit(env: Env, seit: string | null): Promise<{ plattform: string; such_url: string }[]> {
  const sql = `SELECT DISTINCT plattform, such_url FROM pruefung WHERE such_url IS NOT NULL AND such_url != ''${seit ? ' AND gemeldet_am > ?1' : ''}`
  const { results } = await (seit ? env.DB.prepare(sql).bind(seit) : env.DB.prepare(sql)).all<{ plattform: string; such_url: string }>()
  return results ?? []
}
