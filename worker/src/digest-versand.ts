/**
 * Versand des Digests mit fester Zahl an Unteraufrufen. Die Free-Stufe erlaubt 50 je Worker-Aufruf, D1-Abfragen
 * zählen mit; bisher kostete jeder Abonnent drei (Mail + zwei UPDATE), ab 15 brach der Lauf ohne `send_log` ab
 * (daniel-zum-abarbeiten/berichte/digest-subrequest-grenze.md, 14.10.2026). Jetzt: ein UPDATE für alle
 * Sync-Schlüssel, ein Resend-Aufruf je 100 Mails, ein UPDATE für `last_sent_at`.
 */
import type { Env } from './env.ts'
import type { DigestPost } from './digest-inhalt.ts'
import { resendMail, sendMail, type Mail } from './mail.ts'
import { bucheMails } from './mail-zaehler.ts'
import { fehlerLog } from './werte.ts'

/** Resend nimmt höchstens 100 Mails je Stapel (api-reference/emails/send-batch-emails, abgerufen 14.10.2026). */
export const STAPEL_GROESSE = 100
const SYNC_GUELTIG_MS = 30 * 24 * 60 * 60_000

/** Eigener Cron-Trigger nur für den Digest, damit er nicht mit Monitor und Wecker um dieselben 50 Unteraufrufe ringt; Stunden in UTC, 05 = 07:00 Sommerzeit, 06 = 07:00 Winterzeit. Muss Zeichen für Zeichen in wrangler.toml stehen. */
export const DIGEST_CRON = '0 5,6 * * *'

const alsMail = (p: DigestPost): Mail => ({ to: p.sub.email, ...p.mail, unsubscribeUrl: p.unsubUrl })

/** Alle Sync-Schlüssel in einer Abfrage: json_each statt einer Zeile je Abonnent (100 gebundene Werte je Abfrage wären das Limit). */
async function schreibeSyncSchluessel(db: D1Database, posten: DigestPost[], now: Date): Promise<void> {
  const liste = JSON.stringify(posten.map((p) => ({ id: p.sub.id, t: p.syncToken })))
  await db
    .prepare(
      `UPDATE subscribers SET sync_token = neu.t, sync_expires = ?2
       FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.t') AS t FROM json_each(?1)) AS neu
       WHERE subscribers.id = neu.id`,
    )
    .bind(liste, new Date(now.getTime() + SYNC_GUELTIG_MS).toISOString())
    .run()
}

/** Schickt einen Stapel ab und gibt die Kennungen der angenommenen Abonnenten zurück. */
async function sendeStapel(env: Env, teil: DigestPost[]): Promise<string[]> {
  if (env.MAIL_PROVIDER !== 'resend') return sendeEinzeln(env, teil)
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.MAIL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(teil.map((p) => resendMail(env, alsMail(p)))),
  })
  if (!res.ok) throw new Error(`Resend-Stapel ${res.status}: ${await res.text()}`)
  return teil.map((p) => p.sub.id)
}

/** Brevo und `console` kennen hier keinen Stapel: einzeln, ein Fehler trifft nur seine Mail. */
async function sendeEinzeln(env: Env, teil: DigestPost[]): Promise<string[]> {
  const ok: string[] = []
  for (const p of teil) {
    try {
      await sendMail(env, alsMail(p))
      ok.push(p.sub.id)
    } catch (err) {
      fehlerLog('Versand an einen Abonnenten fehlgeschlagen', err)
    }
  }
  return ok
}

/**
 * Verschickt die Mails eines Durchgangs und gibt die Zahl der angenommenen zurück. Wirft nie: `send_log`
 * dahinter wird immer geschrieben. `last_sent_at` erst nach Annahme, sonst gingen Neuzugänge verloren.
 */
export async function versendeDigest(env: Env, posten: DigestPost[], now: Date): Promise<number> {
  if (!posten.length) return 0
  try {
    await schreibeSyncSchluessel(env.DB, posten, now)
  } catch (err) {
    // Ohne gespeicherten Schlüssel führten Abgleich- und Rhythmus-Link der Mail ins Leere.
    fehlerLog('Sync-Schlüssel nicht gespeichert, Digest nicht verschickt', err)
    return 0
  }
  const angenommen: string[] = []
  for (let i = 0; i < posten.length; i += STAPEL_GROESSE) {
    try {
      angenommen.push(...(await sendeStapel(env, posten.slice(i, i + STAPEL_GROESSE))))
    } catch (err) {
      fehlerLog('Digest-Stapel nicht angenommen', err)
    }
  }
  if (!angenommen.length) return 0
  await bucheMails(env, angenommen.length, now)
  try {
    await env.DB.prepare('UPDATE subscribers SET last_sent_at = ?1 WHERE id IN (SELECT value FROM json_each(?2))')
      .bind(now.toISOString(), JSON.stringify(angenommen))
      .run()
  } catch (err) {
    fehlerLog('last_sent_at nicht gespeichert', err)
  }
  return angenommen.length
}
