/**
 * **Eine Einzelmeldung speichern, mit Protokoll** (11.10.2026): jede Ablehnung und jede Ausnahme
 * kommt ins Protokoll (siehe pruefung-ablehnung.ts). Eine Ausnahme wird zu einer 500-Antwort mit
 * Grund und CORS statt Cloudflares nackter Fehlerseite, bei der die Erweiterung nur
 * „Failed to fetch" sah. Ausnahme: Ein laufender D1-Export geht nach dem Protokoll ans Auffangnetz (503).
 */
import { speicherePruefung } from './pruefung-speichern.ts'
import { ablehnungLoggen, ausnahmeAls } from './pruefung-ablehnung.ts'

type Kontext = Parameters<typeof speicherePruefung>[0]

const ROUTE = 'pruefung'

export async function speichereMitProtokoll(kontext: Kontext): Promise<Response> {
  /* Der Rumpf wird beim Speichern verbraucht; fürs Protokoll (Plattform, Kennung) braucht es eine Kopie. */
  const kopie = kontext.request.clone()
  let antwort: Response
  try {
    antwort = await speicherePruefung(kontext)
  } catch (e) {
    const abgelehnt = ausnahmeAls(e)
    ablehnungLoggen(ROUTE, abgelehnt, await kopie.json().catch(() => null))
    /* Ein laufender D1-Export beantwortet das Auffangnetz (503 mit `Retry-After`, `auffangnetz.ts`). */
    if (abgelehnt.status === 503) throw e
    return kontext.antwort({ ok: false, grund: abgelehnt.grund, error: abgelehnt.grund }, 500)
  }
  if (antwort.status >= 400) {
    const inhalt = (await antwort.clone().json().catch(() => ({}))) as { error?: string }
    const abgelehnt = { status: antwort.status, grund: inhalt.error ?? 'ohne Grund' }
    ablehnungLoggen(ROUTE, abgelehnt, await kopie.json().catch(() => null))
  }
  return antwort
}
