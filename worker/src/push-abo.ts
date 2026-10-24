/**
 * `POST /push/abo` und `POST /push/test` (B4, 24.10.2026): Zähler je IP, nur echte Push-Dienste, Obergrenze der Tabelle.
 *
 * Zeilen je Anfrage (Cloudflare zählt gelesene = gescannte, geschriebene = geänderte Zeilen, Indexzeilen eingeschlossen):
 * - abgewiesen (IP-Zähler voll): 1 gelesen, 0 geschrieben.
 * - fremder Host / ungültig: Zähler 1 gelesen + 1 geschrieben, `push_abo` unberührt.
 * - Abo anlegen oder erneuern: dazu 1 Anweisung auf `push_abo` (Schlüsselzugriff auf den Endpunkt, 1 Zähler-Zeile aus
 *   `push_zaehler`), 1 geschrieben; neu: zusätzlich 1 Zeile `push_zaehler` (Auslöser, Migration 062).
 * - abmelden: 1 Anweisung, höchstens 1 geschrieben (+1 Zählerzeile).
 */
import type { Env } from './env.ts'
import { schreibeFavoriten } from './favoriten-kennung.ts'
import { leererPush } from './push.ts'
import { istPushDienst } from './push-dienst.ts'
import type { Buche } from './anmelde-schutz.ts'

export const GRENZE_JE_IP = 30
export const FENSTER_MIN = 60
/**
 * Obergrenze aktiver Abos (23.10.2026): der Versand ist auf 8 Pushes je Stunde gekappt (`PUSH_JE_LAUF`) = 192 am Tag; bei
 * 0,5 Pushes je Abo und Tag (Annahme A7, Skalierungsplan Abschnitt 1) trägt das 192 / 0,5 = 384, abgerundet 350 Abos.
 */
export const ZEILEN_MAX = 350
/** Fehlercode für den Client: die Oberfläche zeigt dann einen eigenen Hinweis. */
export const CODE_VOLL = 'push_voll'

type Antwort = (body: unknown, status?: number) => Response

/** Legt das Abo an oder führt die Favoriten nach; `false`, wenn die Tabelle voll ist und das Abo neu wäre. */
export async function legeAboAn(env: Env, endpoint: string, favoriten: string, jetzt: string): Promise<boolean> {
  /* Der Zähler `push_zaehler` wird von Auslösern gepflegt, die Abfrage braucht keinen Durchlauf über `push_abo`. */
  const r = await env.DB.prepare(
    `INSERT INTO push_abo (endpoint, favoriten, erstellt, erneuert)
     SELECT ?1, ?2, ?3, ?3
      WHERE EXISTS (SELECT 1 FROM push_abo WHERE endpoint = ?1)
         OR (SELECT anzahl FROM push_zaehler WHERE id = 1) < ?4
     ON CONFLICT(endpoint) DO UPDATE SET favoriten = excluded.favoriten, erneuert = excluded.erneuert`,
  )
    .bind(endpoint, favoriten, jetzt, ZEILEN_MAX)
    .run()
  return (r.meta?.changes ?? 0) > 0
}

async function leseBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

const ipVon = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'unbekannt'

/** Zustell-PoC: schickt genau einen leeren Push an das übergebene Abo zurück, speichert nichts. */
export async function handlePushTest(request: Request, env: Env, buche: Buche, antwort: Antwort): Promise<Response> {
  if (!(await buche(env, `push-test-ip:${ipVon(request)}`, GRENZE_JE_IP, FENSTER_MIN))) return antwort({ error: 'Zu viele Versuche, bitte später.' }, 429)
  const body = await leseBody<{ subscription?: { endpoint?: string } }>(request)
  if (!body) return antwort({ error: 'Ungültige Anfrage.' }, 400)
  const endpoint = body.subscription?.endpoint ?? ''
  if (!endpoint) return antwort({ error: 'Kein Abo übergeben.' }, 400)
  const ergebnis = await leererPush(env, endpoint)
  return antwort({ ok: ergebnis.status >= 200 && ergebnis.status < 300, ...ergebnis })
}

/** Abo anlegen oder Favoriten nachführen. Kein Konto: der Endpunkt ist der Schlüssel. */
export async function handlePushAbo(request: Request, env: Env, buche: Buche, antwort: Antwort): Promise<Response> {
  if (!(await buche(env, `push-abo-ip:${ipVon(request)}`, GRENZE_JE_IP, FENSTER_MIN))) return antwort({ error: 'Zu viele Anfragen.' }, 429)
  const body = await leseBody<{ subscription?: { endpoint?: string }; favoriten?: number[]; abmelden?: boolean; ak?: number }>(request)
  if (!body) return antwort({ error: 'Ungültige Anfrage.' }, 400)
  const endpoint = body.subscription?.endpoint ?? ''
  if (endpoint.length > 1000 || !istPushDienst(endpoint)) return antwort({ error: 'Kein gültiges Abo.' }, 400)
  if (body.abmelden) {
    await env.DB.prepare('DELETE FROM push_abo WHERE endpoint = ?1').bind(endpoint).run()
    return antwort({ ok: true, abgemeldet: true })
  }
  const angelegt = await legeAboAn(env, endpoint, schreibeFavoriten(body.favoriten, body.ak), new Date().toISOString())
  if (!angelegt) return antwort({ error: 'Zurzeit sind keine neuen Benachrichtigungen möglich.', code: CODE_VOLL }, 507)
  return antwort({ ok: true })
}
