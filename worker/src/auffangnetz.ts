import { istD1Tageslimit, sekundenBisMitternachtUtc } from './d1-limit.ts'

/** Pfade, die auch aus einer Datei (Ursprung `null`) gelesen werden und daher CORS `*` bekommen. */
export const OFFENE_PFADE = ['/lauf', '/pruefung', '/netzfund', '/vorfall']

/**
 * Fängt, was die Routen werfen. Ohne dieses Netz antwortet Cloudflare mit „error code: 1101“ ohne
 * CORS-Kopf, und der Browser meldet nur „Failed to fetch“ (14.10.2026, leeres D1-Tageskontingent).
 * Das Tageslimit wird zu 503 mit `Retry-After` bis 00:00 UTC, jeder andere Fehler bleibt 500.
 */
export async function mitAuffangnetz(
  pfad: string,
  cors: Record<string, string>,
  lauf: () => Promise<Response>,
  jetzt: Date = new Date(),
): Promise<Response> {
  try {
    return await lauf()
  } catch (e) {
    const limit = istD1Tageslimit(e)
    if (!limit) console.error('[fetch] Fehler', pfad, e)
    const kopf: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(OFFENE_PFADE.includes(pfad) ? { 'Access-Control-Allow-Origin': '*' } : cors),
    }
    if (limit) kopf['Retry-After'] = String(sekundenBisMitternachtUtc(jetzt))
    const text = limit ? 'Der Dienst macht gerade Pause. Versuch es später noch einmal.' : 'Das hat gerade nicht geklappt. Versuch es später noch einmal.'
    return new Response(JSON.stringify({ error: text }), { status: limit ? 503 : 500, headers: kopf })
  }
}
