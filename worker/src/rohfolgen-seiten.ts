/**
 * **Eine Seite Rohfolgen aus `prime_folge`** (13.10.2026 aus `pruefung-rohfolgen.ts` herausgelöst, ohne
 * Verhaltensänderung): die offenen für den Zuordner und alle Beobachtungen für Stufe 2/3.
 */
import { type Env } from './env.ts'

/** Zeilen je Seite; eine volle Seite trägt die Fortsetzung (`weiter`). */
export const SEITE = 5000

export type Seite = { zeilen: { id: number; url: string }[]; weiter: number | null }

const mitWeiter = (zeilen: { id: number; url: string }[]): Seite => ({
  zeilen,
  weiter: zeilen.length === SEITE ? zeilen[zeilen.length - 1]!.id : null,
})

/**
 * Die offenen Rohfolgen ab `nach`. Gesperrte Folgen (`vorhanden = 'nein'`, Migration 035) liest erst Stufe 2 —
 * bis dahin sähe der Zuordner ihre leeren Tonspuren als „kein Deutsch". Entfällt mit Stufe 2.
 */
export async function offeneRohfolgen(env: Env, nach: number): Promise<Seite> {
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.url, f.asin, f.gti, f.nummer, f.titel, f.erschienen, f.dauer_sek,
            f.sprachen, f.untertitel, f.staffel_text, f.staffel_nr, f.gemeldet_am,
            f.titel_id, f.plattform, f.seiten_kennung
       FROM prime_folge f
      WHERE f.uebernommen = 0 AND f.id > ?1
        AND (f.vorhanden IS NULL OR f.vorhanden <> 'nein')
      ORDER BY f.id
      LIMIT ${SEITE}`,
  )
    .bind(Number.isFinite(nach) ? nach : 0)
    .all()
  return mitWeiter((results ?? []) as Seite['zeilen'])
}

/**
 * `&alle=1`: eine Seite jeder Beobachtung ohne `roh` (Menge), fortsetzbar über `nach`.
 * Nur `angenommen` wird aus `roh` gelöst (Netflix-Randprobe, 12.10.2026): Eine angenommene Folge darf in
 * `fetch-urteile.ts` nicht als gemessen zählen.
 */
export async function alleRohfolgen(env: Env, nach: number): Promise<Seite> {
  const { results } = await env.DB.prepare(
    `SELECT id, plattform, url, asin, gti, nummer, titel, erschienen, staffel_nr, titel_id,
            seiten_kennung, gemeldet_am, vorhanden, ton_de, sprachen,
            CASE WHEN plattform = 'netflix' AND json_valid(roh) THEN json_extract(roh, '$.angenommen') END AS angenommen
       FROM prime_folge WHERE id > ?1 ORDER BY id LIMIT ${SEITE}`,
  )
    .bind(Number.isFinite(nach) ? nach : 0)
    .all()
  return mitWeiter((results ?? []) as Seite['zeilen'])
}
