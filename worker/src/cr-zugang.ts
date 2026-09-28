/**
 * Das Crunchyroll-Zugangspaket — geholt, gespeichert, herausgegeben.
 *
 * Eigenes Modul seit dem 28.09.2026 (vorher in `index.ts`, das über die Dateigrenze wuchs).
 * Inhalt unverändert.
 */
import { type Env } from './env.ts'
import { jetztIso } from './werte.ts'

/**
 * Das Crunchyroll-Zugangspaket beschaffen und herausgeben.
 *
 * ## Der Kunstgriff
 *
 * Crunchyroll leitet die Region aus der IP ab. Ein Cloudflare Worker läuft
 * dort, wo die **eingehende** Anfrage ankommt — gemessen am 22.08.2026: von
 * Daniels Leitung aus in London, und Crunchyroll gibt ihm `DE`; von einem
 * GitHub-Runner aufgerufen in San Jose, und er bekommt `US`.
 *
 * Daraus wird eine Lösung, die niemanden beschäftigt: Daniels Statusanzeige
 * fragt diesen Worker ohnehin im Sekundentakt ab und startet bei ihm mit dem
 * Anmelden. Bei jeder dieser Anfragen prüft er nebenbei, ob sein Paket noch
 * frisch ist, und holt sonst ein neues — mit deutscher Sicht, weil die Anfrage
 * aus Deutschland kam. Der Lauf in der Cloud holt es sich später hier ab.
 *
 * ## Die Regel, die dabei nicht fallen darf
 *
 * Gespeichert wird **nur ein Paket mit `country: DE`**. Ein Paket aus der
 * falschen Region wäre schlimmer als keines: Der Lauf liefe durch und läse
 * still den falschen Katalog.
 */

/** Wie alt ein Paket werden darf, bevor nebenbei ein neues geholt wird. */
const ZUGANG_FRISCH_STUNDEN = 6

interface CrPaket {
  land: string
  bucket: string
  policy: string
  signature: string
  key_pair_id: string
  gilt_bis: string
}

/** Holt ein anonymes Zugangspaket — von dort, wo dieser Worker gerade läuft. */
async function holeCrPaket(): Promise<CrPaket | { fehler: string }> {
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
  const tokenAntwort = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
    method: 'POST',
    headers: {
      authorization: 'Basic Y3Jfd2ViOg==',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': UA,
    },
    body: 'grant_type=client_id',
  })
  if (!tokenAntwort.ok) return { fehler: `Token: HTTP ${tokenAntwort.status}` }
  const token = (await tokenAntwort.json()) as { access_token: string; country: string }
  if (token.country !== 'DE') return { fehler: `Region ${token.country}, nicht DE` }

  const indexAntwort = await fetch('https://beta-api.crunchyroll.com/index/v2', {
    headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': UA },
  })
  if (!indexAntwort.ok) return { fehler: `index/v2: HTTP ${indexAntwort.status}` }
  const index = (await indexAntwort.json()) as {
    cms?: Record<string, string>
    cms_web?: Record<string, string>
  }
  const cms = index.cms ?? index.cms_web
  if (!cms?.bucket) return { fehler: 'kein Bucket in der Antwort' }

  return {
    land: token.country,
    bucket: cms.bucket,
    policy: cms.policy,
    signature: cms.signature,
    key_pair_id: cms.key_pair_id,
    gilt_bis: cms.expires,
  }
}

/**
 * Nebenbei auffrischen, wenn die Gelegenheit da ist.
 *
 * Wird aus dem Statusabruf heraus aufgerufen und läuft im Hintergrund weiter,
 * damit die Anzeige nicht darauf wartet. Schlägt es fehl, bleibt das alte Paket
 * stehen — ein abgelaufenes ist immer noch ehrlicher als ein falsches.
 */
export async function crZugangAuffrischen(env: Env, colo?: string): Promise<void> {
  const stand = await env.DB.prepare('SELECT geholt_am, gilt_bis FROM cr_zugang WHERE id = 1').first<{
    geholt_am: string
    gilt_bis: string
  }>()
  if (stand) {
    const alterStunden = (Date.now() - Date.parse(stand.geholt_am)) / 3600_000
    if (alterStunden < ZUGANG_FRISCH_STUNDEN) return
  }

  const paket = await holeCrPaket()
  if ('fehler' in paket) {
    console.log(`[cr-zugang] nicht aufgefrischt: ${paket.fehler} (colo ${colo ?? '?'})`)
    return
  }
  await env.DB.prepare(
    `INSERT INTO cr_zugang (id, land, paket, geholt_am, gilt_bis, colo)
     VALUES (1, ?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(id) DO UPDATE SET
       land = excluded.land, paket = excluded.paket,
       geholt_am = excluded.geholt_am, gilt_bis = excluded.gilt_bis, colo = excluded.colo`,
  )
    .bind(paket.land, JSON.stringify(paket), jetztIso(), paket.gilt_bis, colo ?? null)
    .run()
  console.log(`[cr-zugang] frisches Paket aus ${colo ?? '?'}, gültig bis ${paket.gilt_bis}`)
}

/** Gibt das gespeicherte Paket heraus — hinter demselben Token wie alles andere. */
export async function handleCrZugang(request: Request, env: Env): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const token = request.headers.get('X-Lauf-Token') ?? new URL(request.url).searchParams.get('token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) {
    return new Response(JSON.stringify({ error: 'Nicht erlaubt' }), { status: 403, headers: kopf })
  }

  const zeile = await env.DB.prepare(
    'SELECT land, paket, geholt_am, gilt_bis, colo FROM cr_zugang WHERE id = 1',
  ).first<{ land: string; paket: string; geholt_am: string; gilt_bis: string; colo: string }>()

  if (!zeile) {
    return new Response(
      JSON.stringify({ error: 'Noch kein Paket geholt — die Statusanzeige muss einmal gelaufen sein' }),
      { status: 404, headers: kopf },
    )
  }
  const abgelaufen = Date.parse(zeile.gilt_bis) < Date.now()
  return new Response(
    JSON.stringify({ ...JSON.parse(zeile.paket), geholt_am: zeile.geholt_am, colo: zeile.colo, abgelaufen }),
    { status: abgelaufen ? 410 : 200, headers: kopf },
  )
}

