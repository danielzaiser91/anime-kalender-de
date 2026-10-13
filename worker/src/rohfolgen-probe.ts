/**
 * **Probe: die jüngsten Rohfolgen eines Anbieters samt `roh`, auch übernommene** (aus `pruefung-rohfolgen.ts`
 * herausgelöst, 13.10.2026). Netflix und Disney+ legen ihre Rohfolge seit Migration 054 in `pruefung.rohfolge` ab;
 * die Probe liest deshalb beide Tabellen. Ids der Spalte beginnen bei `PRUEFUNG_ID_AB` (wie in `rohfolgen-seiten.ts`).
 * Diagnose, kein Pfad des Baus: Die Abfrage auf `pruefung` hat keinen Index auf `plattform`, liest aber rückwärts
 * über den Primärschlüssel nur, bis fünf Treffer da sind.
 */
import { type Env } from './env.ts'
import { PRUEFUNG_ID_AB } from './rohfolgen-seiten.ts'

type Zeile = { id: number; gemeldet_am: string }

const AUS_PRIME = `SELECT id, url, nummer, titel, erschienen, dauer_sek, plattform, uebernommen, gemeldet_am, roh FROM prime_folge`
const AUS_MELDUNG = `SELECT id + ${PRUEFUNG_ID_AB} AS id, url, json_extract(rohfolge, '$.nummer') AS nummer, json_extract(rohfolge, '$.titel') AS titel,
       json_extract(rohfolge, '$.erschienen') AS erschienen, json_extract(rohfolge, '$.dauer_sek') AS dauer_sek, plattform,
       roh_uebernommen AS uebernommen, gemeldet_am, json_extract(rohfolge, '$.roh') AS roh FROM pruefung`

/** `&id=<n>` holt genau eine Zeile (Daniel am 15.09.2026), sonst die jüngsten fünf mit `roh`, nach Id absteigend. */
export async function probeRohfolgen(env: Env, plattform: string, id: number): Promise<Zeile[]> {
  const anbieter = plattform.slice(0, 20)
  if (Number.isInteger(id) && id > 0) {
    const meldung = id >= PRUEFUNG_ID_AB
    const { results } = await env.DB.prepare(`${meldung ? AUS_MELDUNG : AUS_PRIME} WHERE id = ?1 AND plattform = ?2`)
      .bind(meldung ? id - PRUEFUNG_ID_AB : id, anbieter)
      .all<Zeile>()
    return results ?? []
  }
  const { results: prime } = await env.DB.prepare(`${AUS_PRIME} WHERE plattform = ?1 AND roh IS NOT NULL ORDER BY id DESC LIMIT 5`).bind(anbieter).all<Zeile>()
  const { results: meldung } = await env.DB.prepare(
    `${AUS_MELDUNG} WHERE plattform = ?1 AND json_extract(rohfolge, '$.roh') IS NOT NULL ORDER BY id DESC LIMIT 5`,
  )
    .bind(anbieter)
    .all<Zeile>()
  /* Ids der Spalte liegen über denen von `prime_folge`: absteigend heißt erst die Spalte. */
  return [...(meldung ?? []), ...(prime ?? [])].slice(0, 5)
}
