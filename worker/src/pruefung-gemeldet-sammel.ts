/**
 * **`?gemeldet-liste=` — `?gemeldet=` für viele Adressen in einer Anfrage** (16.11.2026, Issue 4058).
 *
 * Anlass: Der Prüflisten-Dialog der Erweiterung stellte je offenem Titel eine eigene Anfrage (98 bis 230 je Klick) und
 * wartete bis zu 1,5 s darauf. Die Antwort je Adresse ist dieselbe wie bei `?gemeldet=` (`nummern`, `paare`), gesammelt
 * unter ihrer Adresse. Die Einzelroute bleibt bestehen.
 *
 * Aufruf: `?gemeldet-liste=<Endung,Endung,…>&vor=<gemeinsamer Anfang>` (Adresse = `vor` + Endung). Eine Adresse
 * ohne Meldung antwortet leer, wie `?gemeldet=`. Kosten je Adresse: eine Schlüsselabfrage auf `titel_zeile`, für Adressen
 * ohne Titelzeile eine auf `pruefung` (Index `url`); alle in `DB.batch`, also wenige Unteranfragen statt einer je Adresse.
 */
import { type AusCache } from './cache-kurz.ts'
import { type Env } from './env.ts'
import { gemeldetAlt, gemeldetAusZeilen, type ZeileAlt } from './pruefung-gemeldet.ts'
import { gemeldetAusDaten } from './titelzeile-lesen.ts'

/** Mehr Adressen je Anfrage gibt es nicht (Riegel; die größte Liste der Erweiterung hat 230 Titel). */
export const SAMMEL_MAX = 250
/** Haltedauer der Sammelantwort im Edge-Cache; eine eigene Meldung überbrückt die Erweiterung (`meldungenMerken`). */
export const SAMMEL_SEKUNDEN = 120
/** Anweisungen je `DB.batch`. */
const JE_BATCH = 50

/** Die Adressen der Anfrage; `null`: kein Sammelaufruf, `'zuviele'`: über dem Riegel. */
export function adressenAusAnfrage(suche: URLSearchParams): string[] | 'zuviele' | null {
  const roh = suche.get('gemeldet-liste')
  if (roh === null) return null
  const vor = suche.get('vor') ?? ''
  const adressen = [...new Set(roh.split(',').filter(Boolean).map((e) => vor + e))]
  return adressen.length > SAMMEL_MAX ? 'zuviele' : adressen
}

async function inBatches<T>(db: D1Database, anweisungen: D1PreparedStatement[]): Promise<T[][]> {
  const alle: T[][] = []
  for (let i = 0; i < anweisungen.length; i += JE_BATCH) {
    const teil = await db.batch<T>(anweisungen.slice(i, i + JE_BATCH))
    for (const r of teil) alle.push(r.results ?? [])
  }
  return alle
}

/** Die Antwort auf `?gemeldet-liste=`; `null`: die Anfrage ist keine Sammelanfrage. */
export async function beantworteSammel({ request, env, antwort, ausCache }: {
  request: Request
  env: Env
  antwort: (body: unknown, status?: number) => Response
  ausCache: AusCache
}): Promise<Response | null> {
  const adressen = adressenAusAnfrage(new URL(request.url).searchParams)
  if (adressen === 'zuviele') return antwort({ error: `höchstens ${SAMMEL_MAX} Adressen` }, 400)
  if (!adressen) return null
  return ausCache(async () => antwort({ adressen: await leseGemeldetSammel(env, adressen) }), SAMMEL_SEKUNDEN)
}

async function leseGemeldetSammel(env: Env, adressen: string[]) {
  const antwort: Record<string, { nummern: unknown[]; paare: unknown[] }> = {}
  if (!adressen.length) return antwort
  const zeilen = await inBatches<{ daten: string }>(
    env.DB,
    adressen.map((a) => env.DB.prepare('SELECT daten FROM titel_zeile WHERE url = ?1').bind(a)),
  )
  const ohne: string[] = []
  adressen.forEach((a, i) => {
    const z = zeilen[i]?.[0]
    if (z) antwort[a] = gemeldetAusDaten(z.daten)
    else ohne.push(a)
  })
  const alt = await inBatches<ZeileAlt>(env.DB, ohne.map((a) => gemeldetAlt(env.DB, a)))
  ohne.forEach((a, i) => {
    antwort[a] = gemeldetAusZeilen(alt[i] ?? [])
  })
  return antwort
}
