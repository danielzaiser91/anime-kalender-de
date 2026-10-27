/**
 * **Die Titelzeilen neben `pruefung` lesen** (13.10.2026, Migration 055).
 *
 * Jeder Leser, der Meldungen aus `pruefung` bekam, fragt zusätzlich die Sicht `pruefung_titel` (jede Folge einer
 * Titelzeile als Zeile mit den Spalten von `pruefung`) und lässt die Altzeilen der Adressen mit Titelzeile weg
 * (`NICHT_VERDRAENGT`). Die Sicht liest je Titel eine Zeile; die Tabelle `pruefung` bleibt wie sie war.
 *
 * Seitenweise Auszüge (`?alle=1`, Rohfolgen) setzen über Id-Bereiche fort (`seiten-vereint.ts`); Auszüge ohne
 * Fortsetzung führen beide Ergebnisse zusammen.
 */
import { type Env } from './env.ts'
import { AM, ausId, lies, NUMMER, STAFFEL, TITEL_ID_AB } from './titelzeile-format.ts'
import { vereint, type Quelle, type Seite } from './seiten-vereint.ts'

/** Bedingung für Abfragen auf `pruefung`: nur Adressen ohne Titelzeile (deren Folgen stehen in der Sicht). */
export const NICHT_VERDRAENGT = 'url NOT IN (SELECT url FROM titel_zeile)'

/**
 * `?gemeldet=<Adresse>` aus der Titelzeile: der ganze Titel in einer gelesenen Zeile, im Worker gelesen (rund 0,5 ms
 * für 400 Folgen). Über die Sicht kostete dieselbe Antwort eine gelesene Zeile je Folge. `null`: keine Titelzeile.
 */
export async function gemeldetAusTitelzeile(env: Env, url: string) {
  const { results } = await env.DB.prepare('SELECT daten FROM titel_zeile WHERE url = ?1').bind(url).all<{ daten: string }>()
  if (!results?.length) return null
  const mitNummer = lies(results[0]!.daten).f.filter((e) => e[NUMMER] !== null)
  return {
    nummern: [...new Set(mitNummer.map((e) => e[NUMMER]))],
    paare: mitNummer.map((e) => ({ nummer: e[NUMMER], staffel: e[STAFFEL] ?? 1, staffelBekannt: e[STAFFEL] !== null, folge: e[2], am: e[AM] })),
  }
}

/**
 * Seitenweise über die Sicht (Migration 058): `id` beginnt mit der Titelnummer, also ordnet `titel_nr, id` wie `id`. So liest
 * SQLite die Titel über `titel_zeile_nr` ab dem Titel der Marke und hört in D1 nach `LIMIT` auf (workerd gemessen), statt je
 * Seite alle Folgen auszupacken und zu sortieren. Platzhalter: ?1 Marke, ?2 Anzahl, ?3 Titelnummer der Marke (`titelSeite`).
 */
export const TITEL_AB_MARKE = 'titel_nr >= ?3 AND id > ?1'
export const TITEL_REIHE = 'ORDER BY titel_nr, id LIMIT ?2'
export const titelSeite = (von: number, anzahl: number) => [von + TITEL_ID_AB, anzahl, ausId(von + TITEL_ID_AB).nr]

const ALLE_SPALTEN = `id, plattform, url, befund, folge_nr, staffel, staffeln, folgen, teil_von, teil_bis,
                titel, serientitel, titel_id, notiz, abos, gemeldet_am, vorhanden, ton_de, art`

/** `?alle=1`: jede Meldung, seitenweise — erst `pruefung` (ohne verdrängte Adressen), dann die Titelzeilen. */
export async function allePruefungen(env: Env, nach: number): Promise<Seite> {
  const altzeilen: Quelle = {
    ab: 0,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(`SELECT ${ALLE_SPALTEN} FROM pruefung WHERE id > ?1 AND ${NICHT_VERDRAENGT} ORDER BY id LIMIT ?2`)
        .bind(von, anzahl)
        .all()
      return (results ?? []) as { id: number; url: string }[]
    },
  }
  const titelzeilen: Quelle = {
    ab: TITEL_ID_AB,
    lies: async (von, anzahl) => {
      const { results } = await env.DB.prepare(
        `SELECT id, plattform, url, befund, folge_nr, staffel, staffeln, folgen, NULL AS teil_von, NULL AS teil_bis,
                titel, serientitel, titel_id, notiz, NULL AS abos, gemeldet_am, vorhanden, ton_de, art
           FROM pruefung_titel WHERE ${TITEL_AB_MARKE} ${TITEL_REIHE}`,
      )
        .bind(...titelSeite(von, anzahl))
        .all()
      return (results ?? []) as { id: number; url: string }[]
    },
  }
  return await vereint(nach, [altzeilen, titelzeilen])
}

const OFFEN_SPALTEN = `id, plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln,
                serientitel, notiz, teil_von, teil_bis, gemeldet_am, seiten_kennung, titel_id, folge`

/**
 * Fenster der offenen Meldungen je Bau (18.10.2026: 500 → 5000, wie `SEITE`). Mit 500 füllten 499 liegende Meldungen auf 38
 * Adressen das Fenster vom 12. bis 16.10.2026, und keine neue kam mehr an; 5000 Zeilen sind gemessen 4,5 MB Antwort.
 */
export const OFFEN_FENSTER = 5000

/** Die offenen Meldungen für den Bau: die ältesten `OFFEN_FENSTER`, aus `pruefung` und den Titelzeilen zusammen. */
export async function offenePruefungen(env: Env, plattform: string | null): Promise<unknown[]> {
  const je = plattform ? ' AND plattform = ?1' : ''
  const binde = (sql: string) => (plattform ? env.DB.prepare(sql).bind(plattform) : env.DB.prepare(sql))
  const { results: alt } = await binde(
    `SELECT ${OFFEN_SPALTEN} FROM pruefung WHERE uebernommen = 0${je} AND ${NICHT_VERDRAENGT} ORDER BY gemeldet_am LIMIT ${OFFEN_FENSTER}`,
  ).all<{ gemeldet_am: string }>()
  const { results: titel } = await binde(
    `SELECT id, plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln, serientitel, notiz,
            NULL AS teil_von, NULL AS teil_bis, gemeldet_am, NULL AS seiten_kennung, titel_id, folge
       FROM pruefung_titel WHERE offen_meldung > 0 AND uebernommen = 0${je} ORDER BY gemeldet_am LIMIT ${OFFEN_FENSTER}`,
  ).all<{ gemeldet_am: string }>()
  return [...(alt ?? []), ...(titel ?? [])].sort((a, b) => (a.gemeldet_am < b.gemeldet_am ? -1 : a.gemeldet_am > b.gemeldet_am ? 1 : 0)).slice(0, OFFEN_FENSTER)
}

type Folge = { plattform: string; url: string; folge_nr: number | null; staffel: number | null }

/** Die offenen Meldungen (Zähler, Wartende): nur die Spalten, die Zähler und Stand brauchen. */
export async function offeneZeilen(env: Env): Promise<Folge[]> {
  const { results } = await env.DB.prepare(`SELECT plattform, url, folge_nr, staffel FROM pruefung WHERE uebernommen = 0 AND ${NICHT_VERDRAENGT}`).all<Folge>()
  const { results: titel } = await env.DB.prepare('SELECT plattform, url, folge_nr, staffel FROM pruefung_titel WHERE offen_meldung > 0 AND uebernommen = 0').all<Folge>()
  return [...(results ?? []), ...(titel ?? [])]
}

/** Adressen und Staffeln, zu denen seit `seit` (ohne Angabe: je) gemeldet wurde — `pruefung-stand.ts`. */
export async function staffelnSeit(env: Env, seit: string | null): Promise<{ plattform: string; url: string; staffel: number | null }[]> {
  const bedingung = seit ? ' AND gemeldet_am > ?1' : ''
  /* Titel ohne Meldung seit dem Listenbau (`gemeldet_am` = jüngste Folge, `juengsteMeldung`) startet `json_each` gar nicht erst. */
  const sql = (tabelle: string, mehr: string) =>
    `SELECT DISTINCT plattform, url, staffel FROM ${tabelle} WHERE url IS NOT NULL AND url != ''${bedingung}${mehr}`
  const binde = (s: string) => (seit ? env.DB.prepare(s).bind(seit) : env.DB.prepare(s))
  type Zeile = { plattform: string; url: string; staffel: number | null }
  const { results: alt } = await binde(sql('pruefung', ` AND ${NICHT_VERDRAENGT}`)).all<Zeile>()
  const { results: titel } = await binde(sql('pruefung_titel', seit ? ' AND titel_am > ?1' : '')).all<Zeile>()
  return [...(alt ?? []), ...(titel ?? [])]
}

/** Adressen, unter denen je (seit `seit`) etwas gemeldet wurde — `pruefung-zaehlen.ts`, Spalte `url`. */
export async function gemeldeteAdressen(env: Env, seit: string | null, altzeilen: D1PreparedStatement): Promise<string[]> {
  const { results: alt } = await altzeilen.all<{ url: string }>()
  const sql = `SELECT url FROM titel_zeile WHERE url != ''${seit ? ' AND gemeldet_am > ?1' : ''}`
  const { results: titel } = await (seit ? env.DB.prepare(sql).bind(seit) : env.DB.prepare(sql)).all<{ url: string }>()
  return [...(alt ?? []), ...(titel ?? [])].map((r) => r.url)
}

/** Serienname je Adresse aus den Kopfdaten der Titelzeilen (`?rohfolgen=1&namen=1`), auf `urls` beschränkt, wenn angegeben. */
export async function namenAusTitelzeilen(env: Env, urls?: string[]): Promise<{ url: string; titel: string }[]> {
  const sql = `SELECT url, json_extract(daten, '$.t') AS titel FROM titel_zeile WHERE json_extract(daten, '$.t') IS NOT NULL${urls ? ' AND url IN (SELECT value FROM json_each(?1))' : ''}`
  const { results } = await (urls ? env.DB.prepare(sql).bind(JSON.stringify(urls)) : env.DB.prepare(sql)).all<{ url: string; titel: string }>()
  return results ?? []
}
