/**
 * ADN-Durchreiche für die Datenläufe.
 *
 * Seit 28.10.2026 14:01 UTC liefert ADN dem GitHub-Runner nur noch den französischen Katalog (vostf/vf), obwohl die Anfrage
 * `X-Target-Distribution: de` trägt. Ein Worker im Colo des Runners (IAD) bekommt ihn ebenfalls französisch; mit Platzierung
 * `aws:eu-central-1` (`adn-gw.wrangler.toml`) geht der Abruf von Frankfurt aus und kommt mit vostde/vde zurück (Messung aus dem
 * Runner 03.11.2026). Der Lauf fragt deshalb über diese Route; sie reicht nur lesende ADN-Pfade der Datenläufe durch.
 */
import { type Env } from './env.ts'
import { tokenAusKopf, tokenGleich } from './lauf-token.ts'

const ADN = 'https://gw.api.animationdigitalnetwork.com'
export const ADN_PRAEFIX = '/adn-gw'

/** Nur die Pfade, die `pipeline/fetch-adn.ts` abruft. */
const ERLAUBT = [/^\/video\/calendar$/, /^\/video\/show\/\d+$/, /^\/show$/]
/** Kopfzeilen, die der Lauf bestimmt (Katalog, Titelsprache, Kennung). */
const KOEPFE = ['User-Agent', 'X-Target-Distribution', 'Accept-Language', 'Accept']

export async function handleAdnGw(request: Request, env: Env): Promise<Response> {
  if (!env.LAUF_TOKEN || !tokenGleich(tokenAusKopf(request), env.LAUF_TOKEN)) {
    return new Response('Nicht erlaubt', { status: 403 })
  }
  if (request.method !== 'GET') return new Response('GET erwartet', { status: 405 })
  const url = new URL(request.url)
  const pfad = url.pathname.slice(ADN_PRAEFIX.length)
  if (!url.pathname.startsWith(`${ADN_PRAEFIX}/`) || !ERLAUBT.some((m) => m.test(pfad))) return new Response('Pfad nicht erlaubt', { status: 404 })

  const kopf = new Headers()
  for (const name of KOEPFE) {
    const wert = request.headers.get(name)
    if (wert) kopf.set(name, wert)
  }
  const res = await fetch(`${ADN}${pfad}${url.search}`, { headers: kopf, signal: AbortSignal.timeout(20000) })
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' },
  })
}
