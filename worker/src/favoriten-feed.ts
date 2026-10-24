import { type Env } from './env.ts'
import { ausEdgeCache } from './cache-kurz.ts'
import { ladeKennungen, leseFavoriten } from './favoriten-kennung.ts'
import { schneideFeed } from './favoriten-feed-schnitt.ts'

const FEED_SEKUNDEN = 900

async function ladeAlleIcs(env: Pick<Env, 'SITE_URL'>): Promise<string> {
  const url = new URL('data/feeds/all.ics', env.SITE_URL).toString()
  const res = await fetch(url, { cf: { cacheTtl: FEED_SEKUNDEN } } as RequestInit)
  if (!res.ok) throw new Error(`Sammelfeed nicht abrufbar (${url}): HTTP ${res.status}`)
  return res.text()
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

async function baueFeed(k: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const row = await env.DB.prepare("SELECT favorites FROM subscribers WHERE feed_token = ?1 AND status = 'active'")
    .bind(k)
    .first<{ favorites: string | null }>()
  if (!row) return text('Zu dieser Adresse gibt es kein aktives Abo mehr.', 404)
  const favoriten = leseFavoriten(row.favorites, await ladeKennungen(env))
  const ics = schneideFeed(await ladeAlleIcs(env), favoriten, 'Anime-Kalender DE – Meine Favoriten')
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="favoriten.ics"',
      'Cache-Control': `public, max-age=${FEED_SEKUNDEN}`,
      ...cors,
    },
  })
}

/**
 * Die Antwort bleibt 15 Minuten im Edge-Cache (Schlüssel: Feed-Adresse, `caches.default` gilt je Rechenzentrum): ein
 * Kalender-Dienst, der alle paar Minuten abruft, trifft D1 so nicht bei jedem Abruf. Folge: geänderte Favoriten oder eine
 * ersetzte Adresse wirken im Feed bis zu 15 Minuten später (der Kalender-Client hält die Datei ohnehin so lange).
 */
export function handleFavoritenFeed(request: Request, env: Env, ctx: ExecutionContext | undefined, cors: Record<string, string>): Promise<Response> {
  const k = (new URL(request.url).searchParams.get('k') ?? '').trim()
  if (!k) return Promise.resolve(text('Die Adresse ist unvollständig.', 400))
  const schluessel = `https://feed-cache.invalid/favoriten/${encodeURIComponent(k)}`
  return ausEdgeCache(request, ctx, FEED_SEKUNDEN, () => baueFeed(k, env, cors), schluessel)
}
