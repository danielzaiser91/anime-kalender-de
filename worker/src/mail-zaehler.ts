/**
 * **Zähler für versendete Mails je UTC-Tag** (23.10.2026), Spalte `schreib_tag.mails` (Migration 059).
 * Gezählt wird, was der Anbieter angenommen hat; ein abgewiesener Versand, der Anbieter `console` und
 * ein Fehler beim Zählen ändern nichts (der Zähler ist eine Messung, keine Voraussetzung des Versands).
 */
import type { Env } from './env.ts'
import { sendMail, type Mail, type MailEnv } from './mail.ts'
import { fehlerLog } from './werte.ts'

/** Der UTC-Tag, auf den auch das Kontingent zurückgesetzt wird (wie `utcTag` in tagesdeckel.ts, das nur die Deckel-Routen einbinden). */
const utcTag = (jetzt: Date) => jetzt.toISOString().slice(0, 10)

type ZaehlerEnv = MailEnv & { DB: D1Database }

/** Ob `sendMail` mit diesem Anbieter wirklich etwas verschickt. */
const verschickt = (env: ZaehlerEnv) => env.MAIL_PROVIDER === 'resend' || env.MAIL_PROVIDER === 'brevo'

/** Bucht `anzahl` angenommene Mails auf den Tag von `jetzt`; wirft nie. */
export async function bucheMails(env: ZaehlerEnv, anzahl: number, jetzt = new Date()): Promise<void> {
  if (anzahl <= 0 || !verschickt(env)) return
  try {
    await env.DB.prepare(
      `INSERT INTO schreib_tag (tag, zeilen, mails) VALUES (?1, 0, ?2)
       ON CONFLICT(tag) DO UPDATE SET mails = mails + ?2`,
    )
      .bind(utcTag(jetzt), anzahl)
      .run()
  } catch (e) {
    fehlerLog('[mail-zaehler] Mails nicht gebucht (Migration 059 eingespielt?)', e)
  }
}

/** `sendMail` und danach eine gebuchte Mail; schlägt der Versand fehl, wirft es und bucht nichts. */
export async function sendeUndZaehle(env: ZaehlerEnv, mail: Mail): Promise<void> {
  await sendMail(env, mail)
  await bucheMails(env, 1)
}

/** Der Tagesstand für `/health`: geschriebene und gelesene D1-Zeilen und versendete Mails; `null`, wenn der Zähler nicht lesbar ist. */
export async function tagesstand(env: Pick<Env, 'DB'>, jetzt = new Date()): Promise<{ tag: string; geschrieben: number; gelesen: number; mails: number } | null> {
  const tag = utcTag(jetzt)
  try {
    const z = await env.DB.prepare('SELECT zeilen, gelesen, mails FROM schreib_tag WHERE tag = ?1')
      .bind(tag)
      .first<{ zeilen: number; gelesen: number; mails: number }>()
    return { tag, geschrieben: z?.zeilen ?? 0, gelesen: z?.gelesen ?? 0, mails: z?.mails ?? 0 }
  } catch {
    return null
  }
}
