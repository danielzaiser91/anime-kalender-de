/**
 * **Beleg-Ablage: privat in R2** (Daniel, 02.10.2026: „Screenshot, privat").
 *
 * Die Datenläufe lesen Artikel, die einen Termin belegen, und legen je Lesung ein Bild und das
 * HTML ab. Fremder Inhalt wird damit nicht veröffentlicht: Der Bucket hat keinen öffentlichen
 * Zugang. Schreiben und Auflisten gehen nur mit `LAUF_TOKEN` (Header `X-Lauf-Token`); **Lesen** einer Datei auch mit
 * `BELEG_LESETOKEN` (Header `X-Beleg-Token`), den der Prüfer im Browser hält, damit die Oberfläche das Bild zeigen
 * kann. Kein Schlüssel in der Adresse (04.10.2026).
 *
 *   POST /beleg?key=<pfad>   Rumpf = Datei, `Content-Type` wird mitgespeichert
 *   GET  /beleg?key=<pfad>   liefert die Datei
 *   GET  /beleg?liste=<präfix>  die ersten 100 Schlüssel darunter
 */
import type { Env } from './env.ts'
import { BELEG_SCHLUESSEL as SCHLUESSEL } from '../../shared/beleg-schluessel.ts'

const HOECHSTENS_BYTES = 15 * 1024 * 1024

function antwort(daten: unknown, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': origin } })
}

export async function handleBeleg(request: Request, env: Env, url: URL): Promise<Response> {
  const origin = env.ALLOWED_ORIGIN || '*'
  const darfSchreiben = Boolean(env.LAUF_TOKEN) && request.headers.get('X-Lauf-Token') === env.LAUF_TOKEN
  const darfLesen = darfSchreiben || (Boolean(env.BELEG_LESETOKEN) && request.headers.get('X-Beleg-Token') === env.BELEG_LESETOKEN)
  if (!darfLesen) return antwort({ error: 'Nicht erlaubt' }, 403, origin)
  if (request.method === 'GET' && url.searchParams.get('key') === null && !darfSchreiben) return antwort({ error: 'Nicht erlaubt' }, 403, origin)
  if (request.method === 'POST' && !darfSchreiben) return antwort({ error: 'Nicht erlaubt' }, 403, origin)
  if (!env.BELEGE) return antwort({ error: 'Beleg-Ablage nicht eingerichtet' }, 503)

  const liste = url.searchParams.get('liste')
  if (request.method === 'GET' && liste !== null) {
    const r = await env.BELEGE.list({ prefix: liste, limit: 100 })
    return antwort({ schluessel: r.objects.map((o) => ({ key: o.key, groesse: o.size, am: o.uploaded })) })
  }

  const key = url.searchParams.get('key') ?? ''
  if (!SCHLUESSEL.test(key) || key.includes('..')) return antwort({ error: 'Ungültiger Schlüssel' }, 400, origin)

  if (request.method === 'GET') {
    const objekt = await env.BELEGE.get(key)
    if (!objekt) return antwort({ error: 'Nicht gefunden' }, 404, origin)
    return new Response(objekt.body, {
      headers: { 'content-type': objekt.httpMetadata?.contentType ?? 'application/octet-stream', 'Access-Control-Allow-Origin': origin, 'Cache-Control': 'private, no-store' },
    })
  }
  if (request.method !== 'POST') return antwort({ error: 'GET oder POST erwartet' }, 405)
  const laenge = Number(request.headers.get('content-length') ?? 0)
  if (!laenge || laenge > HOECHSTENS_BYTES) return antwort({ error: 'Leer oder größer als 15 MB' }, 413)
  await env.BELEGE.put(key, request.body, {
    httpMetadata: { contentType: request.headers.get('content-type') ?? 'application/octet-stream' },
  })
  return antwort({ ok: true, key })
}
