import { pushText, pushZiel, type PushEreignis, type WeitererAnbieter } from './push-text.ts'
import { ladeKennungen, leseFavoriten, type Kennungen } from './favoriten-kennung.ts'

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
  SITE_URL: string
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
 * So viele Pushes (Abrufe beim Push-Dienst) höchstens je stündlichem Aufruf (23.10.2026). Die Free-Stufe erlaubt 50 Unteraufrufe
 * je Aufruf, der stündliche Cron braucht ohne Push schon 35 (`docs/wissen/betrieb.md`, Abschnitt „Worker-Cron“); dazu kommen
 * Abfrage der Abos, Kennungen und zwei Stapel. Die übrigen Abos mit Neuigkeiten behalten ihren Stand (`zuletzt`) und bekommen
 * ihren Push im nächsten Lauf, das am längsten wartende zuerst.
 */
export const PUSH_JE_LAUF = 8

interface AboZeile {
  endpoint: string
  favoriten: string
  zuletzt: string | null
  gemeldet: string
}

/** Was ein Abo in diesem Lauf bekommt: neuen Stand, bei Neuigkeiten dazu Text und Ziel. */
interface AboPlan {
  endpoint: string
  gemeldet: string
  text: string | null
  ziel: string | null
}

const weiterSchluessel = (w: WeitererAnbieter) => `${w.id}:${w.anbieter}`

function planeAbo(
  abo: AboZeile,
  kennungen: Kennungen,
  jetzt: Date,
  ereignisse: PushEreignis[],
  istErschienen: (e: PushEreignis, zeit: Date) => boolean,
  weitere: WeitererAnbieter[],
): AboPlan {
  const favoriten = leseFavoriten(abo.favoriten, kennungen)
  const gemeldet = abo.gemeldet ? abo.gemeldet.split('\n') : []
  const bekannt = new Set(gemeldet)
  const auchBei = weitere.filter((w) => favoriten.has(w.id) && !bekannt.has(weiterSchluessel(w)))
  const vermerkt = [...gemeldet, ...auchBei.map(weiterSchluessel)].slice(-200).join('\n')
  /* Der erste Lauf eines Abos merkt sich nur den Zeitpunkt. */
  if (!abo.zuletzt) return { endpoint: abo.endpoint, gemeldet: vermerkt, text: null, ziel: null }
  const seit = new Date(abo.zuletzt)
  const neu = ereignisse.filter((e) => favoriten.has(e.titleId) && istErschienen(e, jetzt) && !istErschienen(e, seit))
  const text = pushText(neu, auchBei)
  return { endpoint: abo.endpoint, gemeldet: vermerkt, text: text || null, ziel: text ? pushZiel(neu, auchBei) : null }
}

/**
 * **Der stündliche Versand** (18.09.2026, Zustellung am selben Tag in Edge belegt).
 *
 * Je Abo: Folgen der Favoriten, die seit dem letzten Lauf erschienen sind (`istErschienen`
 * mit belegter Uhrzeit, sonst 23:59). Höchstens ein Push je Abo und Lauf, gebündelt. Der
 * erste Lauf eines neuen Abos merkt sich nur den Zeitpunkt — sonst käme als Erstes eine
 * Nachricht über alles, was vor dem Abonnieren erschienen ist. Meldet der Push-Dienst 404
 * oder 410, ist das Abo erloschen und wird gelöscht.
 *
 * Dazu „Jetzt auch bei X“ aus den News (`weiterer`-Meldungen). Die tragen nur ein Datum,
 * deshalb merkt sich das Abo in `gemeldet`, was es schon bekommen hat — sonst käme
 * dieselbe Meldung einen Tag lang jede Stunde. Auch hier gilt: Was beim ersten Lauf
 * schon da war, wird nur vermerkt, nicht geschickt.
 *
 * Unteraufrufe (23.10.2026): alle Stände in einem Stapel, davor die Abfrage der Abos, danach höchstens ein Stapel für
 * erloschene Abos; dazwischen ein Abruf je Push, höchstens `PUSH_JE_LAUF`. Unabhängig von der Zahl der Abos ohne Neuigkeit.
 */
export async function pushVersand(
  env: PushEnv & { DB: D1Database },
  jetzt: Date,
  ereignisse: PushEreignis[],
  istErschienen: (e: PushEreignis, zeit: Date) => boolean,
  weitere: WeitererAnbieter[] = [],
): Promise<string> {
  const { results } = await env.DB.prepare('SELECT endpoint, favoriten, zuletzt, gemeldet FROM push_abo ORDER BY zuletzt ASC').all<AboZeile>()
  const abos = results ?? []
  if (!abos.length) return '0 Abos, 0 Pushes, 0 erloschen'
  const kennungen = await ladeKennungen(env)
  const plaene: AboPlan[] = []
  let aufgeschoben = 0
  for (const abo of abos) {
    const plan = planeAbo(abo, kennungen, jetzt, ereignisse, istErschienen, weitere)
    if (plan.text && plaene.filter((p) => p.text).length >= PUSH_JE_LAUF) aufgeschoben++
    else plaene.push(plan)
  }
  /* Text und Ziel stehen vor dem Abruf: der Service Worker holt beides in einem Zug ab. */
  await env.DB.batch(
    plaene.map((p) =>
      env.DB.prepare('UPDATE push_abo SET zuletzt = ?1, gemeldet = ?2, offen = COALESCE(?3, offen), offen_ziel = COALESCE(?4, offen_ziel) WHERE endpoint = ?5').bind(
        jetzt.toISOString(),
        p.gemeldet,
        p.text,
        p.ziel,
        p.endpoint,
      ),
    ),
  )
  const erloschen: string[] = []
  let gesendet = 0
  for (const plan of plaene.filter((p) => p.text)) {
    const antwort = await leererPush(env, plan.endpoint)
    if (antwort.status === 404 || antwort.status === 410) erloschen.push(plan.endpoint)
    else if (antwort.status < 300) gesendet++
  }
  if (erloschen.length) await env.DB.batch(erloschen.map((endpoint) => env.DB.prepare('DELETE FROM push_abo WHERE endpoint = ?1').bind(endpoint)))
  return `${abos.length} Abos, ${gesendet} Pushes, ${erloschen.length} erloschen, ${aufgeschoben} aufgeschoben`
}
