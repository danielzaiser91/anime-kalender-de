/**
 * **Rohfolgen als übernommen markieren** (13.10.2026 aus `speichereDaten` herausgelöst).
 * Begründung, warum nur Zugeordnetes abgehakt wird: `speichereDaten`.
 *
 * Ids ab `TITEL_ID_AB` gehören Folgen in Titelzeilen (Migration 055, `titelzeile-aufgaben.ts`). Ids ab `PRUEFUNG_ID_AB` gehören Rohfolgen aus `pruefung.rohfolge` (Migration 054) und haken
 * `roh_uebernommen` ab — nicht `uebernommen`, das gehört dem Abhaken der Meldung durch `fetch-pruefungen.ts`.
 */
import { type Env } from './env.ts'
import { PRUEFUNG_ID_AB } from './rohfolgen-seiten.ts'
import { hakeTitelzeilenAb } from './titelzeile-aufgaben.ts'
import { TITEL_ID_AB } from './titelzeile-format.ts'

/* D1 bindet höchstens 100 Werte je Anweisung. */
const STAPEL = 50

/*
  **Ein `batch` je Tabelle, und nur offene Zeilen** (16.10.2026). Bis dahin eine Abfrage je 50 Ids: Der Bau schickt rund
  2.900, das waren über 50 Abfragen in einem Aufruf (Grenze der freien Stufe; ein `batch` zählt als eine), und jeder Bau
  schrieb dieselben rund 2.000 Zeilen erneut, die schon auf 1 standen (D1 zählt jede getroffene Zeile). `= 0` macht eine
  Wiederholung schreibfrei. Ein `json_each` in einer Anweisung las in workerd dreimal so viele Zeilen (12.599 statt 4.200
  bei 2.100 Ids). Wächter: `tools/worker-abhaken.test.ts`.
*/
export function abhakAnweisungen(env: Env, tabelle: string, spalte: string, ids: number[]): D1PreparedStatement[] {
  const anweisungen: D1PreparedStatement[] = []
  for (let i = 0; i < ids.length; i += STAPEL) {
    const teil = ids.slice(i, i + STAPEL)
    anweisungen.push(
      env.DB.prepare(`UPDATE ${tabelle} SET ${spalte} = 1 WHERE ${spalte} = 0 AND id IN (${teil.map(() => '?').join(',')})`).bind(...teil),
    )
  }
  return anweisungen
}

async function hake(env: Env, tabelle: string, spalte: string, ids: number[]): Promise<void> {
  if (ids.length) await env.DB.batch(abhakAnweisungen(env, tabelle, spalte, ids))
}

export async function hakeRohfolgenAb(env: Env, ids: number[]): Promise<void> {
  await hake(env, 'prime_folge', 'uebernommen', ids.filter((id) => id < PRUEFUNG_ID_AB))
  await hake(env, 'pruefung', 'roh_uebernommen', ids.filter((id) => id >= PRUEFUNG_ID_AB && id < TITEL_ID_AB).map((id) => id - PRUEFUNG_ID_AB))
  await hakeTitelzeilenAb(env, ids, 'rohfolge')
}
