/**
 * **Web-Push ohne Nutzlast — der Zustell-PoC** (18.09.2026, Plan in status.md).
 *
 * Ein Push ohne Body braucht keine Verschlüsselung nach RFC 8291, nur einen VAPID-Kopf
 * (RFC 8292): ein ES256-signiertes JWT mit `aud` = Ursprung des Push-Dienstes. WebCrypto
 * liefert die Signatur bereits im JWS-Format (r‖s, 64 Byte). Den Text holt der Service
 * Worker beim `push`-Ereignis selbst ab.
 */
export interface PushEnv {
  VAPID_PRIVATE_JWK?: string
  VAPID_PUBLIC?: string
}

const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function vapidKopf(env: PushEnv, endpoint: string): Promise<string> {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) throw new Error('VAPID-Schlüssel fehlen')
  const schluessel = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const enc = new TextEncoder()
  const kopf = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const inhalt = b64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: 'https://anime-kalender.de',
      }),
    ),
  )
  const signatur = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, schluessel, enc.encode(`${kopf}.${inhalt}`))
  return `vapid t=${kopf}.${inhalt}.${b64url(signatur)}, k=${env.VAPID_PUBLIC}`
}

/** Schickt einen leeren Push. Gibt den Status des Push-Dienstes zurück (201 = angenommen). */
export async function leererPush(env: PushEnv, endpoint: string): Promise<{ status: number; text: string }> {
  const url = new URL(endpoint)
  /* Nur echte Push-Dienste — sonst wäre der Endpunkt ein offener Weiterleiter. */
  const erlaubt = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-', 'notify.windows.com']
  if (url.protocol !== 'https:' || !erlaubt.some((h) => url.hostname.includes(h))) {
    return { status: 400, text: 'kein bekannter Push-Dienst' }
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidKopf(env, endpoint), TTL: '600', Urgency: 'normal', 'Content-Length': '0' },
  })
  return { status: res.status, text: (await res.text()).slice(0, 300) }
}

/**
 * **Der stündliche Versand** (18.09.2026, Zustellung am selben Tag in Edge belegt).
 *
 * Je Abo: Folgen der Favoriten, die seit dem letzten Lauf erschienen sind (`istErschienen`
 * mit belegter Uhrzeit, sonst 23:59). Höchstens ein Push je Abo und Lauf, gebündelt. Der
 * erste Lauf eines neuen Abos merkt sich nur den Zeitpunkt — sonst käme als Erstes eine
 * Nachricht über alles, was vor dem Abonnieren erschienen ist. Meldet der Push-Dienst 404
 * oder 410, ist das Abo erloschen und wird gelöscht.
 */
export interface PushEreignis {
  titleId: number
  name: string
  date: string
  time?: string
  episode?: number
  verpasst?: { erschienenAm?: string }
}

export async function pushVersand(
  env: PushEnv & { DB: D1Database },
  jetzt: Date,
  ereignisse: PushEreignis[],
  istErschienen: (e: PushEreignis, zeit: Date) => boolean,
): Promise<string> {
  const { results } = await env.DB.prepare('SELECT endpoint, favoriten, zuletzt FROM push_abo').all<{
    endpoint: string
    favoriten: string
    zuletzt: string | null
  }>()
  let gesendet = 0
  let geloescht = 0
  for (const abo of results ?? []) {
    if (!abo.zuletzt) {
      await env.DB.prepare('UPDATE push_abo SET zuletzt = ?1 WHERE endpoint = ?2').bind(jetzt.toISOString(), abo.endpoint).run()
      continue
    }
    const seit = new Date(abo.zuletzt)
    const favoriten = new Set(abo.favoriten.split(',').filter(Boolean).map(Number))
    const neu = ereignisse.filter((e) => favoriten.has(e.titleId) && istErschienen(e, jetzt) && !istErschienen(e, seit))
    await env.DB.prepare('UPDATE push_abo SET zuletzt = ?1 WHERE endpoint = ?2').bind(jetzt.toISOString(), abo.endpoint).run()
    if (!neu.length) continue
    const zeile = (e: PushEreignis) => (e.episode ? `${e.name} – Folge ${e.episode}` : e.name)
    const text =
      neu.length === 1 ? `Jetzt auf Deutsch: ${zeile(neu[0]!)}` : `${neu.length} neue Folgen: ${neu.slice(0, 3).map(zeile).join(' · ')}`
    await env.DB.prepare('UPDATE push_abo SET offen = ?1 WHERE endpoint = ?2').bind(text, abo.endpoint).run()
    const antwort = await leererPush(env, abo.endpoint)
    if (antwort.status === 404 || antwort.status === 410) {
      await env.DB.prepare('DELETE FROM push_abo WHERE endpoint = ?1').bind(abo.endpoint).run()
      geloescht++
    } else if (antwort.status < 300) gesendet++
  }
  return `${results?.length ?? 0} Abos, ${gesendet} Pushes, ${geloescht} erloschen`
}
