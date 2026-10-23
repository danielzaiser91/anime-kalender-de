/** `POST /push/abo` und `POST /push/test`: aus `index.ts` verschoben (Umbau, Verhalten unverändert). */
import type { Env } from './env.ts'
import { schreibeFavoriten } from './favoriten-kennung.ts'
import { leererPush } from './push.ts'
import type { Buche } from './anmelde-schutz.ts'

type Antwort = (body: unknown, status?: number) => Response

/*
  Zustell-PoC (18.09.2026): schickt genau einen leeren Push an das übergebene
  Abo zurück. Kein Speichern, gedeckelt auf 20 Versuche je Stunde insgesamt.
*/
export async function handlePushTest(request: Request, env: Env, buche: Buche, antwort: Antwort): Promise<Response> {
  if (!(await buche(env, 'push-test', 20, 60))) return antwort({ error: 'Zu viele Versuche, bitte später.' }, 429)
  let body: { subscription?: { endpoint?: string } }
  try {
    body = await request.json()
  } catch {
    return antwort({ error: 'Ungültige Anfrage.' }, 400)
  }
  const endpoint = body.subscription?.endpoint ?? ''
  if (!endpoint) return antwort({ error: 'Kein Abo übergeben.' }, 400)
  const ergebnis = await leererPush(env, endpoint)
  return antwort({ ok: ergebnis.status >= 200 && ergebnis.status < 300, ...ergebnis })
}

/** Abo anlegen oder Favoriten nachführen. Kein Konto: der Endpunkt ist der Schlüssel. */
export async function handlePushAbo(request: Request, env: Env, buche: Buche, antwort: Antwort): Promise<Response> {
  if (!(await buche(env, 'push-abo', 300, 60))) return antwort({ error: 'Zu viele Anfragen.' }, 429)
  let body: { subscription?: { endpoint?: string }; favoriten?: number[]; abmelden?: boolean; ak?: number }
  try {
    body = await request.json()
  } catch {
    return antwort({ error: 'Ungültige Anfrage.' }, 400)
  }
  const endpoint = body.subscription?.endpoint ?? ''
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return antwort({ error: 'Kein gültiges Abo.' }, 400)
  if (body.abmelden) {
    await env.DB.prepare('DELETE FROM push_abo WHERE endpoint = ?1').bind(endpoint).run()
    return antwort({ ok: true, abgemeldet: true })
  }
  const favoriten = schreibeFavoriten(body.favoriten, body.ak)
  await env.DB.prepare(
    `INSERT INTO push_abo (endpoint, favoriten, erstellt) VALUES (?1, ?2, ?3)
     ON CONFLICT(endpoint) DO UPDATE SET favoriten = excluded.favoriten`,
  )
    .bind(endpoint, favoriten, new Date().toISOString())
    .run()
  return antwort({ ok: true })
}
