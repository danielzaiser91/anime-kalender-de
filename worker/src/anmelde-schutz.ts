/**
 * Schutz von `POST /subscribe`: begrenzt, wie viele Bestätigungsmails die Anmeldung auslösen kann.
 *
 * Zähler liegen in `rate_limit` (Migration 004), gelesen wird zuerst nur: eine abgewiesene Anfrage
 * schreibt 0 Zeilen. Gebucht wird erst, wenn sie durchgeht (IP: 1 Zeile; mit Mail: zusätzlich Tag und Adresse).
 */
import type { Env } from './env.ts'

export const GRENZE_IP = 5
export const FENSTER_IP_MIN = 60
export const FENSTER_ADRESSE_MIN = 15
export const GRENZE_TAG = 30
export const FENSTER_TAG_MIN = 24 * 60
export const TEXT_TAG = 'Heute sind keine Anmeldungen mehr möglich. Bitte versuche es morgen noch einmal.'
export const TEXT_IP = 'Zu viele Anmeldungen von deinem Anschluss. Bitte versuche es später noch einmal.'

/** Buchung eines Zählers (`imRahmen` des Workers); `false`, wenn kein Platz mehr ist. */
export type Buche = (env: Env, key: string, grenze: number, fensterMinuten: number) => Promise<boolean>

export type Abgewiesen = { art: 'ip' | 'tag'; text: string; retryAfter: number }
export type Urteil = { art: 'senden' } | { art: 'adresse' } | Abgewiesen

type Stand = { count: number; window_start: string }

/** Offener Zählerstand oder `null`, wenn es keinen gibt oder das Fenster vorbei ist; Rest in Sekunden. */
async function lies(env: Env, key: string, fensterMinuten: number, jetzt: number) {
  const z = await env.DB.prepare('SELECT count, window_start FROM rate_limit WHERE key = ?1').bind(key).first<Stand>()
  if (!z) return null
  const rest = Date.parse(z.window_start) + fensterMinuten * 60_000 - jetzt
  return rest > 0 ? { count: z.count, restSek: Math.ceil(rest / 1000) } : null
}

const schluessel = (ip: string, email: string) => ({
  keyIp: `subscribe-ip:${ip}`,
  keyAdresse: `subscribe-mail:${email}`,
  keyTag: 'subscribe-tag',
})

/** Scheitert der Versand, zählt die Anmeldung nicht: Adresse frei, Tag und IP um eins zurück. */
async function gibFrei(env: Env, ip: string, email: string): Promise<void> {
  const { keyIp, keyAdresse, keyTag } = schluessel(ip, email)
  await env.DB.prepare('DELETE FROM rate_limit WHERE key = ?1').bind(keyAdresse).run()
  await env.DB.prepare('UPDATE rate_limit SET count = MAX(count - 1, 0) WHERE key IN (?1, ?2)').bind(keyIp, keyTag).run()
}

export async function pruefeAnmeldung(env: Env, ip: string, email: string, jetzt: number, buche: Buche): Promise<Urteil> {
  const { keyIp, keyAdresse, keyTag } = schluessel(ip, email)

  const ipStand = await lies(env, keyIp, FENSTER_IP_MIN, jetzt)
  if (ipStand && ipStand.count >= GRENZE_IP) return { art: 'ip', text: TEXT_IP, retryAfter: ipStand.restSek }

  const tagStand = await lies(env, keyTag, FENSTER_TAG_MIN, jetzt)
  if (tagStand && tagStand.count >= GRENZE_TAG) return { art: 'tag', text: TEXT_TAG, retryAfter: tagStand.restSek }

  const adresseStand = await lies(env, keyAdresse, FENSTER_ADRESSE_MIN, jetzt)
  await buche(env, keyIp, GRENZE_IP, FENSTER_IP_MIN)
  if (adresseStand) return { art: 'adresse' }

  await buche(env, keyTag, GRENZE_TAG, FENSTER_TAG_MIN)
  await buche(env, keyAdresse, 1, FENSTER_ADRESSE_MIN)
  return { art: 'senden' }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/**
 * Legt den Schutz um den Handler von `/subscribe`: liest die Adresse aus einer Kopie der Anfrage.
 * Ungültige Anfragen gehen unverändert an den Handler (er antwortet 400, ohne zu schreiben).
 */
export async function mitAnmeldeSchutz(
  request: Request,
  env: Env,
  handler: (request: Request, env: Env) => Promise<Response>,
  buche: Buche,
  kopf: Record<string, string>,
): Promise<Response> {
  const body = (await request.clone().json().catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) return handler(request, env)

  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const urteil = await pruefeAnmeldung(env, ip, email, Date.now(), buche)
  if (urteil.art === 'senden') {
    const antwort = await handler(request, env)
    if (!antwort.ok) await gibFrei(env, ip, email)
    return antwort
  }
  if (urteil.art === 'adresse') {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...kopf } })
  }
  return abweisung(urteil, kopf)
}

/** 429 mit `Retry-After` für Abweisungen von IP und Tageskappe. */
export function abweisung(urteil: Abgewiesen, kopf: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: urteil.text }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', ...kopf, 'Retry-After': String(urteil.retryAfter) },
  })
}
