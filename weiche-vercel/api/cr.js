// Crunchyroll-Weiche auf Vercel (Frankfurt). Leitet nur an beta-api.crunchyroll.com weiter,
// verlangt X-Weiche-Token; ?diag=1 nennt das Land, das Crunchyroll sieht.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
async function handler(req) {
  if (!process.env.WEICHE_TOKEN || req.headers.get('x-weiche-token') !== process.env.WEICHE_TOKEN) {
    return new Response('nicht erlaubt', { status: 403 })
  }
  const such = new URL(req.url).searchParams
  if (such.has('diag')) {
    const t = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa('noaihdevm_6iyg0a8l0q:'), 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: 'grant_type=client_id',
    }).then((r) => r.json())
    return Response.json({ region: process.env.VERCEL_REGION, crunchyroll: t.country })
  }
  let ziel
  try { ziel = new URL(such.get('ziel') ?? '') } catch { return new Response('url fehlt', { status: 400 }) }
  if (ziel.protocol !== 'https:' || ziel.hostname !== 'beta-api.crunchyroll.com') return new Response('nur beta-api.crunchyroll.com', { status: 400 })
  const headers = new Headers({ 'User-Agent': UA })
  for (const n of ['authorization', 'content-type']) if (req.headers.get(n)) headers.set(n, req.headers.get(n))
  const a = await fetch(ziel, { method: req.method === 'POST' ? 'POST' : 'GET', headers, body: req.method === 'POST' ? await req.text() : undefined })
  return new Response(a.body, { status: a.status, headers: { 'content-type': a.headers.get('content-type') ?? 'application/json' } })
}

export const GET = handler
export const POST = handler
