/**
 * **Die Titelzeile lesen und mit Versionsprüfung schreiben** (13.10.2026, Migration 055). Begründung der
 * Version: Kopf von `titelzeile-speichern.ts`.
 */
import { type Env } from './env.ts'
import { juengsteMeldung, lies, zaehleOffene, type TitelDaten } from './titelzeile-format.ts'

export type Zeile = { nr: number; version: number; daten: string }

/** Wie oft eine Änderung nach einem Zusammenstoß mit einer gleichzeitigen neu versucht wird. */
export const VERSUCHE = 6

/** Die gelesene Zeile steht im Tageszähler (`zaehlendeDb` zählt `all()` und seit 15.10.2026 auch `first()`). */
export async function ladeZeile(env: Env, url: string, plattform: string): Promise<Zeile | null> {
  const { results } = await env.DB.prepare('SELECT nr, version, daten FROM titel_zeile WHERE url = ?1 AND plattform = ?2')
    .bind(url, plattform)
    .all<Zeile>()
  return results?.[0] ?? null
}

/** Das `UPDATE` einer gelesenen Zeile gegen ihre Version (einzeln in `schreibe`, gesammelt in `titelzeile-aufgaben.ts`). */
export function aktualisierung(env: Env, zeile: Zeile & { url: string; plattform: string }, neu: TitelDaten): D1PreparedStatement {
  const offen = zaehleOffene(neu)
  return env.DB.prepare(
    'UPDATE titel_zeile SET daten = ?3, version = version + 1, gemeldet_am = ?4, offen_meldung = ?6, offen_rohfolge = ?7 WHERE url = ?1 AND plattform = ?2 AND version = ?5',
  ).bind(zeile.url, zeile.plattform, JSON.stringify(neu), juengsteMeldung(neu), zeile.version, offen.meldung, offen.rohfolge)
}

/** Schreibt gegen die gelesene Version; `false`, wenn jemand dazwischen geschrieben (oder dieselbe Nummer vergeben) hat. */
async function schreibe(env: Env, url: string, plattform: string, zeile: Zeile | null, neu: TitelDaten): Promise<boolean> {
  const text = JSON.stringify(neu)
  const am = juengsteMeldung(neu)
  const offen = zaehleOffene(neu)
  const r = zeile
    ? await aktualisierung(env, { url, plattform, ...zeile }, neu).run()
    : await env.DB.prepare(
        'INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_meldung, offen_rohfolge) VALUES (?1, ?2, (SELECT IFNULL(MAX(nr), 0) + 1 FROM titel_zeile), ?3, ?4, ?5, ?6) ON CONFLICT DO NOTHING',
      )
        .bind(url, plattform, text, am, offen.meldung, offen.rohfolge)
        .run()
  return Number(r.meta?.changes ?? 0) > 0
}

/**
 * Die Titelzeile ändern: `aendere` bekommt den gelesenen Stand (`null` = noch keine Zeile) und gibt den neuen zurück,
 * oder `null` für „nichts zu schreiben". Bei einem Zusammenstoß wird neu gelesen und `aendere` noch einmal gerufen.
 * `ziel.zeile` ist eine schon gelesene Zeile für den ersten Versuch (`undefined` = lesen).
 */
export async function aendereTitelzeile(
  env: Env,
  ziel: { url: string; plattform: string; zeile?: Zeile | null },
  aendere: (alt: TitelDaten | null) => Promise<TitelDaten | null>,
): Promise<'geschrieben' | 'unveraendert' | 'belegt'> {
  for (let versuch = 0; versuch < VERSUCHE; versuch++) {
    const zeile = versuch === 0 && ziel.zeile !== undefined ? ziel.zeile : await ladeZeile(env, ziel.url, ziel.plattform)
    const neu = await aendere(zeile ? lies(zeile.daten) : null)
    if (neu === null) return 'unveraendert'
    if (await schreibe(env, ziel.url, ziel.plattform, zeile, neu)) return 'geschrieben'
  }
  return 'belegt'
}
