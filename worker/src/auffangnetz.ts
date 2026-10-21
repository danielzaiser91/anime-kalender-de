import { DIENST_PAUSE } from '../../shared/dienst-pause.ts'
import { EXPORT_PAUSE_SEKUNDEN, EXPORT_PAUSE_TEXT, istD1Export, istD1Tageslimit, sekundenBisMitternachtUtc } from './d1-limit.ts'
import { type Env } from './env.ts'
import { mitLesedeckel } from './lesedeckel.ts'

/** Pfade, die auch aus einer Datei (Ursprung `null`) gelesen werden und daher CORS `*` bekommen. */
export const OFFENE_PFADE = ['/lauf', '/pruefung', '/netzfund', '/vorfall']

/** JSON-Kopf einer Antwort, die nicht aus der Route kommt; `OFFENE_PFADE` bekommen CORS `*`. */
export function kopfFuer(pfad: string, cors: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(OFFENE_PFADE.includes(pfad) ? { 'Access-Control-Allow-Origin': '*' } : cors),
  }
}

/**
 * Fängt, was die Routen werfen. Ohne dieses Netz antwortet Cloudflare mit „error code: 1101“ ohne
 * CORS-Kopf, und der Browser meldet nur „Failed to fetch“ (14.10.2026, leeres D1-Tageskontingent).
 * Das Tageslimit wird zu 503 mit `Retry-After` bis 00:00 UTC, ein laufender D1-Export (`istD1Export`)
 * zu 503 mit `Retry-After` von `EXPORT_PAUSE_SEKUNDEN`, jeder andere Fehler bleibt 500.
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
    const pause = d1Pause(e, jetzt)
    if (!pause) console.error('[fetch] Fehler', pfad, e)
    /* Eine Zeile je Export-Abweisung, damit die Klasse im Log zählbar bleibt (Telemetrie-Abfrage, betrieb.md). */
    if (istD1Export(e)) console.warn(JSON.stringify({ ereignis: 'd1_export_abgewiesen', pfad }))
    const kopf = kopfFuer(pfad, cors)
    if (pause) kopf['Retry-After'] = String(pause.sekunden)
    const text = pause?.text ?? 'Das hat gerade nicht geklappt. Versuch es später noch einmal.'
    return new Response(JSON.stringify({ error: text }), { status: pause ? 503 : 500, headers: kopf })
  }
}

/** Vorübergehende Abweisung durch D1: Wartezeit und Satz für die Antwort, sonst `null`. */
function d1Pause(e: unknown, jetzt: Date): { sekunden: number; text: string } | null {
  if (istD1Tageslimit(e)) return { sekunden: sekundenBisMitternachtUtc(jetzt), text: DIENST_PAUSE }
  return istD1Export(e) ? { sekunden: EXPORT_PAUSE_SEKUNDEN, text: EXPORT_PAUSE_TEXT } : null
}

/** Der Eingang jeder Anfrage: Lese-Deckel (`lesedeckel.ts`) innerhalb des Auffangnetzes. */
export async function mitEingang(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  lauf: (env: Env) => Promise<Response>,
): Promise<Response> {
  const pfad = new URL(request.url).pathname
  return await mitAuffangnetz(pfad, cors, () => mitLesedeckel(request, env, kopfFuer(pfad, cors), lauf))
}
