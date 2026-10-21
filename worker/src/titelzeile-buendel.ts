/**
 * **Titelzeilen gesammelt lesen** (Auslagerung aus `titelzeile-aufgaben.ts`, 21.10.2026).
 */
import { type Env } from './env.ts'
import { type Zeile } from './titelzeile-zeile.ts'

export type Gelesen = Zeile & { url: string; plattform: string }

/** Höchstens so viele Anweisungen je `batch` (D1 nimmt Stapel dieser Größe, siehe `titelzeile-aufgaben.ts`). */
export const JE_STAPEL = 100

/**
 * Die Zeile zu jeder Titelnummer, in einer Abfrage über den Index `titel_zeile_nr`. Die Nummern reisen als ein
 * JSON-Wert: D1 bindet höchstens 100 Werte, mit einem `?` je Nummer scheiterte jedes Abhaken ab 101 Titeln
 * („too many SQL variables“, HTTP 500 in jedem Bestandsbau bis 16.10.2026).
 */
export async function adressen(env: Env, nummern: number[]): Promise<Gelesen[]> {
  if (!nummern.length) return []
  const { results } = await env.DB.prepare('SELECT nr, url, plattform, version, daten FROM titel_zeile WHERE nr IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(nummern))
    .all<Gelesen>()
  return results ?? []
}
