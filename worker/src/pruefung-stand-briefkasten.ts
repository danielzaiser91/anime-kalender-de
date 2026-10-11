/**
 * **Was im Briefkasten auf die Übernahme wartet** — die Abfrage zum Prüfstand, ohne Rechnung.
 *
 * Aus `pruefung-stand.ts` ausgelagert (11.10.2026); wann ein Ziel damit erledigt ist, steht in
 * `pruefung-stand-anbieter.ts`.
 */
import { type Env } from './env.ts'

/** Meldungen mit `uebernommen = 0`: Adressen je Plattform und Staffeln je Adresse. */
export async function holeWartende(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT plattform, url, staffel FROM pruefung WHERE uebernommen = 0`,
  ).all<{ plattform: string; url: string; staffel: number | null }>()
  const adressen = new Map<string, Set<string>>()
  const staffeln = new Map<string, Set<number>>()
  for (const r of results ?? []) {
    if (!r.url) continue
    const dazu = adressen.get(r.plattform) ?? new Set<string>()
    dazu.add(r.url)
    adressen.set(r.plattform, dazu)
    if (typeof r.staffel !== 'number') continue
    const st = staffeln.get(r.url) ?? new Set<number>()
    st.add(r.staffel)
    staffeln.set(r.url, st)
  }
  return { adressen, staffeln }
}
