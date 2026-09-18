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
