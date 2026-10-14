import { type Env } from './env.ts'
import { namenAusTitelzeilen } from './titelzeile-lesen.ts'

/**
 * **Der Serienname je Adresse — einmal je Adresse nachgeschlagen, nicht je Rohfolge** (12.10.2026).
 *
 * Der Titel der jüngsten Meldung mit Titel unter derselben Adresse. Als korrelierte Unterabfrage je
 * Rohfolge (`pruefung_url_zeit`, bis zu 5.000 je Seite) las die Seitenabfrage 26.101 Zeilen je Aufruf,
 * 56 Aufrufe am Tag = 1,46 Mio. Eine Prime-Seite trägt rund 90 Folgen unter einer Adresse.
 * Die Adressen reisen als JSON in einem Parameter (`json_each`): eine Abfrage, egal wie viele.
 */
export async function serientitelJeAdresse(env: Env, adressen: string[]): Promise<Map<string, string>> {
  const einzigartig = [...new Set(adressen)]
  const titel = new Map<string, string>()
  if (!einzigartig.length) return titel
  const { results } = await env.DB.prepare(
    `WITH u(url) AS (SELECT value FROM json_each(?1))
     SELECT u.url AS url,
            (SELECT p.titel FROM pruefung p
              WHERE p.url = u.url AND p.titel IS NOT NULL
              ORDER BY p.gemeldet_am DESC LIMIT 1) AS titel
       FROM u`,
  )
    .bind(JSON.stringify(einzigartig))
    .all<{ url: string; titel: string | null }>()
  for (const r of results ?? []) if (r.titel !== null) titel.set(r.url, r.titel)
  /* Adressen mit Titelzeile (Migration 055): der Titel steht im Kopf der Zeile, ihre Altzeilen zählen nicht mehr. */
  for (const r of await namenAusTitelzeilen(env, einzigartig)) titel.set(r.url, r.titel)
  return titel
}
