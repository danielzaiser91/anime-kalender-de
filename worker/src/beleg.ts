/**
 * **Beleg-Ablage: privat in R2** (Daniel, 02.10.2026: „Screenshot, privat").
 *
 * Die Datenläufe lesen Artikel, die einen Termin belegen, und legen je Lesung ein Bild und das
 * HTML ab. Fremder Inhalt wird damit nicht veröffentlicht: Der Bucket hat keinen öffentlichen
 * Zugang, Schreiben und Lesen gehen nur über diese Route mit `LAUF_TOKEN`.
 *
 *   POST /beleg?key=<pfad>   Rumpf = Datei, `Content-Type` wird mitgespeichert
 *   GET  /beleg?key=<pfad>   liefert die Datei
 *   GET  /beleg?liste=<präfix>  die ersten 100 Schlüssel darunter
 */
import type { Env } from './env.ts'
import { BELEG_SCHLUESSEL as SCHLUESSEL } from '../../shared/beleg-schluessel.ts'

const HOECHSTENS_BYTES = 15 * 1024 * 1024

function antwort(daten: unknown, status = 200): Response {
  return new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

export async function handleBeleg(request: Request, env: Env, url: URL): Promise<Response> {
  const token = request.headers.get('X-Lauf-Token') ?? url.searchParams.get('token')
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)
  if (!env.BELEGE) return antwort({ error: 'Beleg-Ablage nicht eingerichtet' }, 503)

  const liste = url.searchParams.get('liste')
  if (request.method === 'GET' && liste !== null) {
    const r = await env.BELEGE.list({ prefix: liste, limit: 100 })
    return antwort({ schluessel: r.objects.map((o) => ({ key: o.key, groesse: o.size, am: o.uploaded })) })
  }

  const key = url.searchParams.get('key') ?? ''
  if (!SCHLUESSEL.test(key) || key.includes('..')) return antwort({ error: 'Ungültiger Schlüssel' }, 400)

  if (request.method === 'GET') {
    const objekt = await env.BELEGE.get(key)
    if (!objekt) return antwort({ error: 'Nicht gefunden' }, 404)
    return new Response(objekt.body, {
      headers: { 'content-type': objekt.httpMetadata?.contentType ?? 'application/octet-stream' },
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
