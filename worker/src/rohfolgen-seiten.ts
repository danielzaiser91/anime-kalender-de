/**
 * **Eine Seite Rohfolgen** — aus `prime_folge` und aus der Spalte `pruefung.rohfolge`.
 *
 * Netflix und Disney+ legen ihre Rohfolge seit Migration 054 in der Zeile der Meldung ab
 * (`pruefung-rohfolge-spalte.ts`); ältere Rohfolgen und alle von Prime stehen in `prime_folge`. Die Route
 * liefert beide in derselben Gestalt: erst `prime_folge`, danach die Spalte, mit Ids ab
 * `PRUEFUNG_ID_AB` + `pruefung.id` (so bleibt `nach`/`weiter` eine einzige Zahl, und das Abhaken kennt den Ursprung).
 */
import { type Env } from './env.ts'
import { ROH_FELDER } from './pruefung-rohfolgen-speichern.ts'
import { vereint, SEITE, type Quelle, type Seite, type Zeile } from './seiten-vereint.ts'
import { NICHT_VERDRAENGT } from './titelzeile-lesen.ts'
import { TITEL_ID_AB } from './titelzeile-format.ts'

export { SEITE, type Seite }

/** Ids von Rohfolgen aus `pruefung.rohfolge` beginnen hier; `prime_folge` hat nach heutigem Wachstum nie so viele. */
export const PRUEFUNG_ID_AB = 1_000_000_000

/** Ein Feld der Rohfolge aus der Spalte; die Namen sind die von `ROH_FELDER`, nie Eingaben. */
const feld = (name: (typeof ROH_FELDER)[number]) => `json_extract(rohfolge, '$.${name}') AS ${name}`

function offenAusPrime(env: Env): Quelle {
  return {
    ab: 0,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT f.id, f.url, f.asin, f.gti, f.nummer, f.titel, f.erschienen, f.dauer_sek,
                f.sprachen, f.untertitel, f.staffel_text, f.staffel_nr, f.gemeldet_am,
                f.titel_id, f.plattform, f.seiten_kennung
           FROM prime_folge f
          WHERE f.uebernommen = 0 AND f.id > ?1
            AND (f.vorhanden IS NULL OR f.vorhanden <> 'nein') AND f.${NICHT_VERDRAENGT}
          ORDER BY f.id
          LIMIT ?2`,
      )
        .bind(von, anzahl)
        .all()
      return (results ?? []) as Zeile[]
    },
  }
}

function offenAusMeldung(env: Env): Quelle {
  return {
    ab: PRUEFUNG_ID_AB,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT id + ?2 AS id, gemeldet_am, ${ROH_FELDER.filter((n) => n !== 'roh' && n !== 'vorhanden' && n !== 'ton_de').map(feld).join(', ')}
           FROM pruefung
          WHERE id > ?1 AND roh_uebernommen = 0 AND ${NICHT_VERDRAENGT}
            AND (json_extract(rohfolge, '$.vorhanden') IS NULL OR json_extract(rohfolge, '$.vorhanden') <> 'nein')
          ORDER BY id
          LIMIT ?3`,
      )
        .bind(von, PRUEFUNG_ID_AB, anzahl)
        .all()
      return (results ?? []) as Zeile[]
    },
  }
}

/** Offene Rohfolgen der Titelzeilen (Migration 055), in der Gestalt von `prime_folge`; Ids ab `TITEL_ID_AB`. */
function offenAusTitel(env: Env): Quelle {
  return {
    ab: TITEL_ID_AB,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT id, url, NULL AS asin, gti, folge_nr AS nummer, folge AS titel, NULL AS erschienen, NULL AS dauer_sek,
                sprachen, NULL AS untertitel, NULL AS staffel_text, staffel AS staffel_nr, gemeldet_am,
                titel_id, plattform, NULL AS seiten_kennung
           FROM pruefung_titel
          WHERE offen_rohfolge > 0 AND id > ?1 AND roh_uebernommen = 0 AND gti IS NOT NULL AND (vorhanden IS NULL OR vorhanden <> 'nein')
          ORDER BY id LIMIT ?2`,
      )
        .bind(von + TITEL_ID_AB, anzahl)
        .all()
      return (results ?? []) as Zeile[]
    },
  }
}

/**
 * Die offenen Rohfolgen ab `nach`. Gesperrte Folgen (`vorhanden = 'nein'`, Migration 035) liest erst Stufe 2 —
 * bis dahin sähe der Zuordner ihre leeren Tonspuren als „kein Deutsch". Entfällt mit Stufe 2.
 */
export async function offeneRohfolgen(env: Env, nach: number): Promise<Seite> {
  return await vereint(nach, [offenAusPrime(env), offenAusMeldung(env), offenAusTitel(env)])
}

function alleAusPrime(env: Env): Quelle {
  return {
    ab: 0,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT id, plattform, url, asin, gti, nummer, titel, erschienen, staffel_nr, titel_id,
                seiten_kennung, gemeldet_am, vorhanden, ton_de, sprachen,
                CASE WHEN plattform = 'netflix' AND json_valid(roh) THEN json_extract(roh, '$.angenommen') END AS angenommen
           FROM prime_folge WHERE id > ?1 AND ${NICHT_VERDRAENGT} ORDER BY id LIMIT ?2`,
      )
        .bind(von, anzahl)
        .all()
      return (results ?? []) as Zeile[]
    },
  }
}

function alleAusMeldung(env: Env): Quelle {
  return {
    ab: PRUEFUNG_ID_AB,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT id + ?2 AS id, gemeldet_am, ${ROH_FELDER.filter((n) => !['roh', 'untertitel', 'dauer_sek', 'staffel_text'].includes(n)).map(feld).join(', ')},
                CASE WHEN plattform = 'netflix' AND json_valid(json_extract(rohfolge, '$.roh'))
                     THEN json_extract(json_extract(rohfolge, '$.roh'), '$.angenommen') END AS angenommen
           FROM pruefung WHERE id > ?1 AND rohfolge IS NOT NULL AND ${NICHT_VERDRAENGT} ORDER BY id LIMIT ?3`,
      )
        .bind(von, PRUEFUNG_ID_AB, anzahl)
        .all()
      return (results ?? []) as Zeile[]
    },
  }
}

/** Alle Rohfolgen der Titelzeilen (Migration 055), in der Gestalt von `prime_folge`; `angenommen` gibt es dort nicht. */
function alleAusTitel(env: Env): Quelle {
  return {
    ab: TITEL_ID_AB,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT id, plattform, url, NULL AS asin, gti, folge_nr AS nummer, folge AS titel, NULL AS erschienen,
                staffel AS staffel_nr, titel_id, NULL AS seiten_kennung, gemeldet_am, vorhanden, ton_de, sprachen,
                NULL AS angenommen
           FROM pruefung_titel WHERE id > ?1 AND gti IS NOT NULL ORDER BY id LIMIT ?2`,
      )
        .bind(von + TITEL_ID_AB, anzahl)
        .all()
      return (results ?? []) as Zeile[]
    },
  }
}

/**
 * `&alle=1`: eine Seite jeder Beobachtung ohne `roh` (Menge), fortsetzbar über `nach`.
 * Nur `angenommen` wird aus `roh` gelöst (Netflix-Randprobe, 12.10.2026): Eine angenommene Folge darf in
 * `fetch-urteile.ts` nicht als gemessen zählen.
 */
export async function alleRohfolgen(env: Env, nach: number): Promise<Seite> {
  return await vereint(nach, [alleAusPrime(env), alleAusMeldung(env), alleAusTitel(env)])
}
