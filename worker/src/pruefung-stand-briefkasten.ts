/**
 * **Was im Briefkasten auf die Übernahme wartet** — die Abfrage zum Prüfstand, ohne Rechnung.
 *
 * Aus `pruefung-stand.ts` ausgelagert (11.10.2026); wann ein Ziel damit erledigt ist, steht in
 * `pruefung-stand-anbieter.ts`.
 *
 * **Eine halbe Stunde im Cache, getrennt vom Stand** (12.10.2026). Die Abfrage liest alle offenen
 * Meldungen (Ø 2.979 Zeilen, 543 Aufrufe am Tag = 1,6 Mio. gelesene Zeilen). Der Stand selbst hält
 * nur fünf Minuten, weil `pruefstand.json` stündlich neu entsteht — und die Erweiterung fragt genau
 * im Fünf-Minuten-Takt, trifft den Cache also kaum. Was hier wartet, ändert sich nur, wenn ein Lauf
 * Meldungen übernimmt; Meldungen seit dem Listenbau zieht `pruefung-stand.ts` ohnehin frisch ab.
 * Nicht verworfen, nur abgelaufen (Lehre vom 28.09.2026, siehe `pruefung.ts`).
 *
 * **Seit 12.10.2026 zwei Stunden** (vorher 30 Minuten), ebenso `?zaehlen=1`: Eine Meldung der letzten Stunden
 * zeigt `jemals` in `pruefung-stand.ts` ohnehin frisch; nur „übernommen" kommt bis zu zwei Stunden später an.
 * Entwurf `d1-umbau-entwurf-2026-10-12.md` Maßnahme 4a: höchstens 12 Neuberechnungen je Rechenzentrum und Tag statt 48.
 */
import { type Env } from './env.ts'
import { type AusCache } from './cache-kurz.ts'
import { offeneZeilen } from './titelzeile-lesen.ts'

export const WARTEND_SEKUNDEN = 7200

/** Der Cache-Schlüssel dieses Teilergebnisses: eine eigene Adresse neben dem Stand. */
export function wartendSchluessel(basis: string): string {
  const u = new URL(basis)
  u.search = '?wartend=1'
  return u.toString()
}

type Wartende = { adressen: Map<string, Set<string>>; staffeln: Map<string, Set<number>> }

/** Meldungen mit `uebernommen = 0`: Adressen je Plattform und Staffeln je Adresse. */
async function leseWartende(env: Env): Promise<Wartende> {
  const results = await offeneZeilen(env)
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

/** Mengen als Listen, damit die Antwort in den Cache der Edge passt (JSON). */
const alsJson = (w: Wartende) => ({
  adressen: [...w.adressen].map(([k, v]) => [k, [...v]]),
  staffeln: [...w.staffeln].map(([k, v]) => [k, [...v]]),
})

function ausJson(roh: ReturnType<typeof alsJson>): Wartende {
  return {
    adressen: new Map((roh.adressen as [string, string[]][]).map(([k, v]) => [k, new Set(v)])),
    staffeln: new Map((roh.staffeln as [string, number[]][]).map(([k, v]) => [k, new Set(v)])),
  }
}

/** Mit `zwischen` aus dem Cache der Edge, sonst (Tests, lokal) direkt aus der Datenbank. */
export async function holeWartende(env: Env, zwischen?: { ausCache: AusCache; schluessel: string }) {
  if (!zwischen) return await leseWartende(env)
  const bauen = async () => Response.json(alsJson(await leseWartende(env)))
  const antwort = await zwischen.ausCache(bauen, WARTEND_SEKUNDEN, zwischen.schluessel)
  return ausJson(await antwort.json())
}
