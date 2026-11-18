/**
 * **`POST /pruefung?zurueck=1`: die Erweiterung meldet ihre zurückgestellten Titel** (15.11.2026, Token wie die Meldungen).
 * Rumpf `{ plattform, eintraege: { <kennung>: { grund, bis } } }`; gespeichert wird die ganze Menge (`pruefung-zurueck.ts`).
 * Läuft unter dem Tagesdeckel wie jede schreibende Route.
 */
import { type Env } from './env.ts'
import { ablehnungLoggen } from './pruefung-ablehnung.ts'
import { erweiterungVersion } from './erweiterung-version.ts'
import { mitTagesdeckel } from './tagesdeckel.ts'
import { pruefeZurueck, speichereZurueck } from './pruefung-zurueck.ts'

type Kontext = {
  request: Request
  env: Env
  antwort: (body: unknown, status?: number) => Response
}

export async function beantworteZurueck(kontext: Kontext): Promise<Response> {
  let roh: unknown
  try {
    roh = await kontext.request.json()
  } catch {
    return kontext.antwort({ error: 'Kein gültiges JSON' }, 400)
  }
  const jetzt = new Date()
  const geprueft = pruefeZurueck(roh, jetzt.getTime())
  if ('status' in geprueft) {
    ablehnungLoggen('pruefung-zurueck', geprueft)
    return kontext.antwort({ error: geprueft.grund }, geprueft.status)
  }
  return await mitTagesdeckel({ env: kontext.env, antwort: kontext.antwort }, async (k) => {
    try {
      await speichereZurueck(k.env, geprueft.plattform, geprueft.eintraege, jetzt, erweiterungVersion(roh as Record<string, unknown>))
    } catch (e) {
      if (!/no such table/i.test(String((e as Error)?.message ?? e))) throw e
      const grund = 'Tabelle pruefung_zurueck fehlt (Migration 064)'
      ablehnungLoggen('pruefung-zurueck', { status: 503, grund })
      return k.antwort({ ok: false, error: grund }, 503)
    }
    return k.antwort({ ok: true, eintraege: Object.keys(geprueft.eintraege).length })
  })
}
