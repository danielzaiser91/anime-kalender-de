/** Antwort-Helfer des Workers: CORS-Kopf, JSON-Antwort, eigene Basisadresse. */
import { type Env } from './env.ts'

export function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Beleg-Token, Authorization',
  }
}

export function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  })
}

export function baseUrl(request: Request): string {
  const u = new URL(request.url)
  return `${u.protocol}//${u.host}`
}
