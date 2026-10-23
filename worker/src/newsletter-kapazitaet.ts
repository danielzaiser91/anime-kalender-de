/**
 * **Newsletter-Kapazität** (B13, 23.10.2026): Die Anmeldung schließt, bevor der Versand bricht.
 *
 * Resend Free erlaubt 100 Mails am Tag und 3.000 im Monat. Rechenweg der Kappen:
 *   - Bestätigungsmails haben ihre eigene Kappe `GRENZE_TAG` = 30 (anmelde-schutz.ts),
 *   - Digest-Kappe je Tag = 100 − 30 = 70, damit eine volle Anmeldung den Digest nie verdrängt,
 *   - Wochen-Abos verteilen sich nach Hash ihrer Kennung auf 7 Versandtage (`wochentagVon`); die Anmeldung
 *     schließt, sobald tägliche Abos + größter Wochentags-Eimer die Digest-Kappe erreichen.
 */
import { addDays, weekdayIndex } from '../../shared/time.ts'
import type { Env } from './env.ts'
import { NEWSLETTER_VOLL } from '../../shared/dienst-pause.ts'
import { EMAIL_RE, GRENZE_TAG } from './anmelde-schutz.ts'
import { fehlerLog } from './werte.ts'

/** Resend Free: 100 Mails am Tag (resend.com/pricing, abgerufen 23.10.2026). */
export const MAIL_TAG_MAX = 100
/** Resend Free: 3.000 Mails im Monat (resend.com/pricing, abgerufen 23.10.2026). */
export const MAIL_MONAT_MAX = 3000
/** Digest je Tag: 100 minus die 30 Bestätigungsmails. */
export const DIGEST_TAG_MAX = MAIL_TAG_MAX - GRENZE_TAG
/** Fehlercode der Anmeldung bei voller Kapazität (Web-Formular zeigt dazu den Hinweis). */
export const CODE_VOLL = NEWSLETTER_VOLL
export const TEXT_VOLL = 'Alle Plätze für den Newsletter sind gerade vergeben.'

/** FNV-1a über die Kennung, stabil und gleichmäßig genug für 7 Eimer; 0 = Montag wie `weekdayIndex`. */
export function wochentagVon(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 7
}

type Wochenabo = { id: string; last_sent_at: string | null; created_at: string }

/** So viele Tage nach dem Eimer-Tag wird ein nicht versandtes Wochen-Abo noch nachgeholt; danach wartet es auf den nächsten Eimer-Tag. */
const NACHHOL_TAGE = 2

/**
 * Ob ein Wochen-Abo heute dran ist: höchstens `NACHHOL_TAGE` nach seinem Eimer-Tag und seit der letzten Mail
 * mindestens 7 Tage (nie zwei Mails in 7 Tagen, auch nicht beim Umzug vom alten Einheitstag). Wer am Eimer-Tag
 * nicht drankam (Kappe, abgewiesener Stapel), ist an den Folgetagen weiter fällig. Ohne frühere Mail zählt
 * jeder Tag ab dem ersten Eimer-Tag nach der Anmeldung.
 */
export function wochenAboFaellig(sub: Wochenabo, iso: string): boolean {
  const seitEimerTag = (weekdayIndex(iso) - wochentagVon(sub.id) + 7) % 7
  if (!sub.last_sent_at) return sub.created_at.slice(0, 10) <= addDays(iso, -seitEimerTag)
  const fruehestens = addDays(sub.last_sent_at.slice(0, 10), 7)
  if (fruehestens > iso) return false
  // Nachholen nur, wenn der Eimer-Tag selbst schon dran gewesen wäre; wer nach dem Umzug oder verspätet bedient
  // wurde, wartet auf seinen nächsten Eimer-Tag (sonst bliebe er dauerhaft am verspäteten Tag hängen).
  return seitEimerTag <= NACHHOL_TAGE && fruehestens <= addDays(iso, -seitEimerTag)
}

/** Tägliche Abos + größter Wochentags-Eimer (aktiv und unbestätigt): so viele Mails braucht der volle Versandtag. */
export function belegung(zeilen: { id: string; frequency: string }[]): number {
  const eimer = new Array<number>(7).fill(0)
  let taeglich = 0
  for (const z of zeilen) {
    if (z.frequency === 'daily') taeglich++
    else eimer[wochentagVon(z.id)]++
  }
  return taeglich + Math.max(...eimer)
}

/** Eine Abfrage, ein Lesezeilen-Posten je Abo (Stand 23.10.2026: höchstens ~500 bis zur Schließung). */
async function leseBelegung(db: D1Database): Promise<number> {
  const { results } = await db
    .prepare("SELECT id, frequency FROM subscribers WHERE status IN ('active', 'pending')")
    .all<{ id: string; frequency: string }>()
  return belegung(results ?? [])
}

const alsAntwort = (kopf: Record<string, string>) =>
  new Response(JSON.stringify({ error: TEXT_VOLL, code: CODE_VOLL }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', ...kopf },
  })

/**
 * Legt die Platzprüfung um den Handler von `/subscribe`: eine neue Adresse bekommt bei voller Kapazität 503
 * `newsletter_voll`, ohne Zeile und ohne Mail. Vorhandene Adressen (Erneuerung, Einstellungen) und ungültige
 * Anfragen gehen unverändert durch.
 */
export function mitPlatzpruefung(
  handler: (request: Request, env: Env) => Promise<Response>,
  kopf: Record<string, string>,
): (request: Request, env: Env) => Promise<Response> {
  return async (request, env) => {
    const body = (await request.clone().json().catch(() => null)) as { email?: unknown } | null
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(email)) return handler(request, env)
    const da = await env.DB.prepare('SELECT 1 AS da FROM subscribers WHERE email = ?1').bind(email).first()
    if (da) return handler(request, env)
    if ((await leseBelegung(env.DB)) >= DIGEST_TAG_MAX) return alsAntwort(kopf)
    return handler(request, env)
  }
}

export type DigestStand = { digestHeute: number; mailsHeute: number; mailsMonat: number; platz: number }

/** Wie viele Digest-Mails heute noch gehen: Rest der Digest-Kappe, des Tages und des Monats; Fehler beim Lesen sperren (0). */
export async function digestStand(env: Pick<Env, 'DB'>, jetzt: Date): Promise<DigestStand> {
  const tag = jetzt.toISOString().slice(0, 10)
  const monat = tag.slice(0, 7)
  try {
    const m = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN tag = ?1 THEN mails ELSE 0 END), 0) AS heute, COALESCE(SUM(mails), 0) AS monat
       FROM schreib_tag WHERE tag LIKE ?2`,
    )
      .bind(tag, `${monat}-%`)
      .first<{ heute: number; monat: number }>()
    const d = await env.DB.prepare(
      "SELECT COALESCE(SUM(recipients), 0) AS n FROM send_log WHERE sent_at >= ?1 AND (run_key LIKE 'daily:%' OR run_key LIKE 'weekly:%')",
    )
      .bind(`${tag}T00:00:00.000Z`)
      .first<{ n: number }>()
    const digestHeute = d?.n ?? 0
    const mailsHeute = m?.heute ?? 0
    const mailsMonat = m?.monat ?? 0
    const platz = Math.max(0, Math.min(DIGEST_TAG_MAX - digestHeute, MAIL_TAG_MAX - mailsHeute, MAIL_MONAT_MAX - mailsMonat))
    return { digestHeute, mailsHeute, mailsMonat, platz }
  } catch (e) {
    fehlerLog('[newsletter-kapazitaet] Stand nicht lesbar, Digest heute gesperrt', e)
    return { digestHeute: 0, mailsHeute: 0, mailsMonat: 0, platz: 0 }
  }
}
