import { pushText, pushZiel, type PushEreignis, type WeitererAnbieter } from './push-text.ts'
import { fehlerLog } from './werte.ts'
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
  erstellt: string
  zuletzt: string | null
  gemeldet: string
  offen: string | null
  offen_ziel: string | null
}

/** Was ein Abo mit Neuigkeit in diesem Lauf bekommt: neuen Stand, Text und Ziel; dazu der alte Stand für den Fall eines Netzfehlers. */
interface AboPlan {
  endpoint: string
  gemeldet: string
  text: string
  ziel: string
  vorherZuletzt: string | null
  vorherGemeldet: string
  vorherOffen: string | null
  vorherOffenZiel: string | null
}

/** Globaler Stand des Versands (Tabelle `push_marke`, eine Zeile): bis wohin alle Abos bedient sind und welche „Jetzt auch bei“-Meldungen schon durch sind. */
interface Marke {
  zuletzt: string
  gemeldet: string[]
  /** Beginn der laufenden Netzfehler-Serie, sonst null. */
  fehlerSeit: string | null
}

const weiterSchluessel = (w: WeitererAnbieter) => `${w.id}:${w.anbieter}`
const MERKLISTE = 200
/** So lange wird ein gescheiterter Push stündlich neu versucht; danach rückt die Marke vor und das Ereignis ist für dieses Abo verfallen. */
const FEHLER_FRIST_MS = 24 * 3600_000

async function leseMarke(db: D1Database): Promise<Marke | null> {
  const zeile = await db
    .prepare('SELECT zuletzt, gemeldet, fehler_seit FROM push_marke WHERE id = 1')
    .first<{ zuletzt: string; gemeldet: string; fehler_seit: string | null }>()
  return zeile ? { zuletzt: zeile.zuletzt, gemeldet: zeile.gemeldet ? zeile.gemeldet.split('\n') : [], fehlerSeit: zeile.fehler_seit } : null
}

/** Bedingter Upsert: bei gleichem Inhalt keine Schreibzeile. Löscht dabei den Fehlerbeginn. */
export async function schreibeMarke(db: D1Database, jetzt: Date, gemeldet: string[]): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_marke (id, zuletzt, gemeldet) VALUES (1, ?1, ?2)
       ON CONFLICT(id) DO UPDATE SET zuletzt = excluded.zuletzt, gemeldet = excluded.gemeldet, fehler_seit = NULL
       WHERE push_marke.zuletzt IS NOT excluded.zuletzt OR push_marke.gemeldet IS NOT excluded.gemeldet OR push_marke.fehler_seit IS NOT NULL`,
    )
    .bind(jetzt.toISOString(), gemeldet.slice(-MERKLISTE).join('\n'))
    .run()
}

/**
 * Netzfehler halten die Marke nur kurz: ein Abo, dessen Abruf dauerhaft wirft, soll die Abo-Lesezeilen nicht für immer zurückbringen.
 * Die Frist zählt ab dem ersten Fehlschlag (`fehler_seit`), nicht ab dem Alter der Marke, die in ruhigen Tagen alt wird.
 */
async function entscheideMarke(db: D1Database, jetzt: Date, marke: Marke, gescheitert: boolean, gemeldet: string[]): Promise<void> {
  if (!gescheitert) return schreibeMarke(db, jetzt, gemeldet)
  if (!marke.fehlerSeit) {
    await db.prepare('UPDATE push_marke SET fehler_seit = ?1 WHERE id = 1').bind(jetzt.toISOString()).run()
    return
  }
  if (jetzt.getTime() - Date.parse(marke.fehlerSeit) >= FEHLER_FRIST_MS) await schreibeMarke(db, jetzt, gemeldet)
}

/** Ab wann Ereignisse für dieses Abo neu sind: nie vor der globalen Marke, nie vor Anmeldung oder letztem Push des Abos. */
function seitWann(marke: Marke, abo: AboZeile): Date {
  const zeiten = [marke.zuletzt, abo.erstellt, abo.zuletzt].map((z) => (z ? Date.parse(z) : 0)).filter((t) => Number.isFinite(t))
  return new Date(Math.max(...zeiten))
}

/** Nur Abos mit Neuigkeit bekommen einen Plan; alle anderen bleiben unberührt (kein Schreiben). */
function planeAbo(
  abo: AboZeile,
  marke: Marke,
  kennungen: Kennungen,
  neueEreignisse: PushEreignis[],
  neueWeitere: WeitererAnbieter[],
  istErschienen: (e: PushEreignis, zeit: Date) => boolean,
): AboPlan | null {
  const favoriten = leseFavoriten(abo.favoriten, kennungen)
  const gemeldet = abo.gemeldet ? abo.gemeldet.split('\n') : []
  const seit = seitWann(marke, abo)
  const neu = neueEreignisse.filter((e) => favoriten.has(e.titleId) && !istErschienen(e, seit))
  const auchBei = neueWeitere.filter((w) => favoriten.has(w.id) && !gemeldet.includes(weiterSchluessel(w)))
  const text = pushText(neu, auchBei)
  if (!text) return null
  const vermerkt = [...gemeldet, ...auchBei.map(weiterSchluessel)].slice(-MERKLISTE).join('\n')
  return { endpoint: abo.endpoint, gemeldet: vermerkt, text, ziel: pushZiel(neu, auchBei), vorherZuletzt: abo.zuletzt, vorherGemeldet: abo.gemeldet, vorherOffen: abo.offen, vorherOffenZiel: abo.offen_ziel }
}

/** Alle Stände in einer Anweisung (`json_each` wie im Digest): ein Unteraufruf, egal wie viele Abos. */
async function schreibeStaende(db: D1Database, jetzt: Date, plaene: AboPlan[]): Promise<void> {
  const zeilen = plaene.map((p) => ({ e: p.endpoint, g: p.gemeldet, o: p.text, z: p.ziel }))
  await db
    .prepare(
      `UPDATE push_abo SET zuletzt = ?1, gemeldet = neu.g, offen = neu.o, offen_ziel = neu.z
       FROM (SELECT json_extract(value, '$.e') AS e, json_extract(value, '$.g') AS g, json_extract(value, '$.o') AS o, json_extract(value, '$.z') AS z FROM json_each(?2)) AS neu
       WHERE push_abo.endpoint = neu.e`,
    )
    .bind(jetzt.toISOString(), JSON.stringify(zeilen))
    .run()
}

/** Nimmt den Stand von Abos zurück, deren Push nicht abgerufen werden konnte: alter Zeitpunkt, alte Merkliste, der frühere (noch nicht abgeholte) Text. */
async function setzeStaendeZurueck(db: D1Database, plaene: AboPlan[]): Promise<void> {
  const zeilen = plaene.map((p) => ({ e: p.endpoint, z: p.vorherZuletzt, g: p.vorherGemeldet, o: p.vorherOffen, t: p.vorherOffenZiel }))
  await db
    .prepare(
      `UPDATE push_abo SET zuletzt = neu.z, gemeldet = neu.g, offen = neu.o, offen_ziel = neu.t
       FROM (SELECT json_extract(value, '$.e') AS e, json_extract(value, '$.z') AS z, json_extract(value, '$.g') AS g, json_extract(value, '$.o') AS o, json_extract(value, '$.t') AS t FROM json_each(?1)) AS neu
       WHERE push_abo.endpoint = neu.e`,
    )
    .bind(JSON.stringify(zeilen))
    .run()
}

/** Ruft die Pushes ab; erloschene Endpunkte und Abos mit Netzfehler kommen getrennt zurück. */
async function sendeAlle(env: PushEnv, plaene: AboPlan[]) {
  const erloschen: string[] = []
  const gescheitert: AboPlan[] = []
  let gesendet = 0
  for (const plan of plaene) {
    try {
      const antwort = await leererPush(env, plan.endpoint)
      if (antwort.status === 404 || antwort.status === 410) erloschen.push(plan.endpoint)
      else if (antwort.status < 300) gesendet++
    } catch (err) {
      /* Netzfehler: dieses Abo behält seinen alten Stand und ist im nächsten Lauf wieder dran, die übrigen Pushes laufen weiter. */
      fehlerLog('[push] Abruf fehlgeschlagen', err)
      gescheitert.push(plan)
    }
  }
  return { erloschen, gescheitert, gesendet }
}

/**
 * **Der stündliche Versand** (18.09.2026, Zustellung am selben Tag in Edge belegt).
 *
 * Eine globale Marke (`push_marke`) hält fest, bis wann alle Abos bedient sind. Gibt es seit der Marke weder ein neu
 * erschienenes Ereignis noch eine neue „Jetzt auch bei X“-Meldung, endet der Lauf nach dem Lesen dieser einen Zeile:
 * 0 Lesezeilen aus `push_abo`, 0 Schreibzeilen (24.10.2026; vorher las und schrieb jeder Lauf jedes Abo). Sonst werden die Abos
 * gelesen und nur die mit passendem Titel geschrieben (Worker-Schleife statt SQL-Filter: die Favoriten stehen bis zum
 * 05.11.2026 noch in zwei Schreibweisen, `leseFavoriten` übersetzt sie). Der erste Lauf überhaupt setzt nur die Marke — sonst käme
 * als Erstes eine Nachricht über alles, was vor dem Start erschienen ist; ein neues Abo bekommt nur Ereignisse nach seiner Anmeldung.
 * Meldet der Push-Dienst 404 oder 410, ist das Abo erloschen und wird gelöscht.
 *
 * Höchstens ein Push je Abo und Lauf, gebündelt. Bleibt ein Abo wegen der Kappe `PUSH_JE_LAUF` oder eines Netzfehlers
 * ohne Push, rückt die Marke nicht vor (die bedienten Abos tragen ihren eigenen Stand `zuletzt`, bekommen also nichts doppelt).
 *
 * Unteraufrufe (23.10.2026): Marke lesen; bei Neuigkeit Abos, Kennungen, ein Stapel für alle Stände, ein Abruf je Push
 * (höchstens `PUSH_JE_LAUF`), ein Stapel für erloschene Abos, die Marke. Unabhängig von der Zahl der Abos ohne Neuigkeit.
 */
export async function pushVersand(
  env: PushEnv & { DB: D1Database },
  jetzt: Date,
  ereignisse: PushEreignis[],
  istErschienen: (e: PushEreignis, zeit: Date) => boolean,
  weitere: WeitererAnbieter[] = [],
): Promise<string> {
  const marke = await leseMarke(env.DB)
  if (!marke) {
    await schreibeMarke(env.DB, jetzt, weitere.map(weiterSchluessel))
    return 'Erstlauf: Marke gesetzt, 0 Abos gelesen'
  }
  const seit = new Date(marke.zuletzt)
  const neueEreignisse = ereignisse.filter((e) => istErschienen(e, jetzt) && !istErschienen(e, seit))
  const neueWeitere = weitere.filter((w) => !marke.gemeldet.includes(weiterSchluessel(w)))
  if (!neueEreignisse.length && !neueWeitere.length) return '0 Abos gelesen, nichts Neues'
  const { results } = await env.DB.prepare('SELECT endpoint, favoriten, erstellt, zuletzt, gemeldet, offen, offen_ziel FROM push_abo ORDER BY zuletzt ASC').all<AboZeile>()
  const abos = results ?? []
  const kennungen = await ladeKennungen(env)
  const plaene: AboPlan[] = []
  let aufgeschoben = 0
  for (const abo of abos) {
    const plan = planeAbo(abo, marke, kennungen, neueEreignisse, neueWeitere, istErschienen)
    if (!plan) continue
    if (plaene.length >= PUSH_JE_LAUF) aufgeschoben++
    else plaene.push(plan)
  }
  /* Text und Ziel stehen vor dem Abruf: der Service Worker holt beides in einem Zug ab. */
  if (plaene.length) await schreibeStaende(env.DB, jetzt, plaene)
  const { erloschen, gescheitert, gesendet } = await sendeAlle(env, plaene)
  if (gescheitert.length) await setzeStaendeZurueck(env.DB, gescheitert)
  if (erloschen.length) await env.DB.prepare('DELETE FROM push_abo WHERE endpoint IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(erloschen)).run()
  if (!aufgeschoben) await entscheideMarke(env.DB, jetzt, marke, gescheitert.length > 0, [...marke.gemeldet, ...neueWeitere.map(weiterSchluessel)])
  return `${abos.length} Abos gelesen, ${gesendet} Pushes, ${erloschen.length} erloschen, ${aufgeschoben} aufgeschoben`
}
