export interface MailEnv {
  MAIL_PROVIDER: string
  MAIL_API_KEY?: string
  FROM_EMAIL: string
  FROM_NAME: string
  /**
   * Antwortadresse. Ohne sie gehen Antworten an `FROM_EMAIL` — und das ist
   * `send.anime-kalender.de`, eine reine Versand-Subdomain ohne Postfach.
   * Antworten liefen dort ins Leere (30.09.2026 aufgefallen). Mit gesetztem
   * Wert steht die Adresse als Reply-To im Kopf, die Antwort kommt also dort an.
   */
  REPLY_TO?: string
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

/** Abmelde-Kopfzeilen (RFC 8058): Mailclients zeigen damit einen eigenen Abmeldeknopf. */
function abmeldeKopf(mail: Mail): Record<string, string> {
  const headers: Record<string, string> = {}
  if (mail.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${mail.unsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  return headers
}

/** Eine Mail im Format der Resend-API — Einzel- und Stapelversand nehmen dasselbe Objekt. */
export function resendMail(env: MailEnv, mail: Mail): Record<string, unknown> {
  return {
    from: `${mail.fromName ?? env.FROM_NAME} <${env.FROM_EMAIL}>`,
    to: [mail.to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: abmeldeKopf(mail),
    ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
  }
}

/**
 * Ein Adapter pro Anbieter. `console` schreibt nur ins Log und ist der
 * Standard für `wrangler dev`, damit beim Entwickeln niemand Post bekommt.
 */
export async function sendMail(env: MailEnv, mail: Mail): Promise<void> {
  const headers = abmeldeKopf(mail)
  const fromName = mail.fromName ?? env.FROM_NAME

  switch (env.MAIL_PROVIDER) {
    case 'resend': {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendMail(env, mail)),
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
          ...(env.REPLY_TO ? { replyTo: { email: env.REPLY_TO } } : {}),
        }),
      })
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`)
      return
    }

    default:
      console.log('[mail:console] Mail nicht versendet (Anbieter console)')
  }
}
