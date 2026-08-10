export interface MailEnv {
  MAIL_PROVIDER: string
  MAIL_API_KEY?: string
  FROM_EMAIL: string
  FROM_NAME: string
}

export interface Mail {
  to: string
  subject: string
  html: string
  text: string
  /** Landet als List-Unsubscribe-Header — Mailclients zeigen dann einen eigenen Knopf. */
  unsubscribeUrl?: string
  /**
   * Anzeigename des Absenders, falls er von `FROM_NAME` abweichen soll.
   *
   * Die Adresse bleibt dieselbe — `send.anime-kalender.de` ist die einzige bei
   * Resend verifizierte Domain. Der Name unterscheidet aber die beiden Arten
   * von Post, die dieser Worker verschickt: Newsletter an Abonnenten,
   * Erreichbarkeitsprüfung an den Betreiber. Ohne diese Trennung standen beide
   * als „Anime-Kalender DE" im Posteingang und waren nicht auseinanderzuhalten.
   */
  fromName?: string
}

/**
 * Ein Adapter pro Anbieter. `console` schreibt nur ins Log und ist der
 * Standard für `wrangler dev`, damit beim Entwickeln niemand Post bekommt.
 */
export async function sendMail(env: MailEnv, mail: Mail): Promise<void> {
  const headers: Record<string, string> = {}
  if (mail.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${mail.unsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  const fromName = mail.fromName ?? env.FROM_NAME

  switch (env.MAIL_PROVIDER) {
    case 'resend': {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${env.FROM_EMAIL}>`,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          headers,
        }),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
      return
    }

    case 'brevo': {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.MAIL_API_KEY ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: env.FROM_EMAIL, name: fromName },
          to: [{ email: mail.to }],
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
          headers,
        }),
      })
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`)
      return
    }

    default:
      console.log(`[mail:console] an ${mail.to} — ${mail.subject}\n${mail.text}`)
  }
}
