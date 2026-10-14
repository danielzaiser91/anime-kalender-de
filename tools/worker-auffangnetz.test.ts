/**
 * **Auffangnetz des Workers** (14.10.2026): Wirft eine Route, antwortet der Worker mit JSON und
 * CORS-Kopf statt mit Cloudflares „error code: 1101“, das der Browser nur als „Failed to fetch“ meldet.
 *
 * Aufruf: `npx tsx tools/worker-auffangnetz.test.ts`
 */
import worker from '../worker/src/index.ts'
import { mitAuffangnetz } from '../worker/src/auffangnetz.ts'
import type { Env } from '../worker/src/env.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

const D1_LIMIT = new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit.")
const CORS = { 'Access-Control-Allow-Origin': 'https://anime.example' }
const werfe = (e: unknown) => async (): Promise<Response> => {
  throw e
}
const mitternacht = (h: number, m: number, s: number) => new Date(Date.UTC(2026, 9, 14, h, m, s))

async function netz() {
  const limit = await mitAuffangnetz('/prefs', CORS, werfe(D1_LIMIT), mitternacht(23, 59, 30))
  pruefe(limit.status === 503, 'Tageslimit: 503')
  pruefe(limit.headers.get('Retry-After') === '30', 'Tageslimit: Retry-After = Sekunden bis 00:00 UTC')
  pruefe(limit.headers.get('Access-Control-Allow-Origin') === CORS['Access-Control-Allow-Origin'], 'Tageslimit: CORS-Kopf gesetzt')
  const text = ((await limit.json()) as { error: string }).error
  pruefe(/Pause/.test(text) && !/1101|D1|fetch/i.test(text), 'Tageslimit: kurzer deutscher Text ohne Technik')

  const frueh = await mitAuffangnetz('/prefs', CORS, werfe(D1_LIMIT), mitternacht(0, 0, 0))
  pruefe(frueh.headers.get('Retry-After') === '86400', 'Retry-After: gleich nach Mitternacht ein ganzer Tag, nie 0')

  const normal = await mitAuffangnetz('/prefs', CORS, werfe(new Error('kaputt')))
  pruefe(normal.status === 500, 'anderer Fehler bleibt 500')
  pruefe(normal.headers.get('Retry-After') === null, 'anderer Fehler: kein Retry-After')
  pruefe(normal.headers.get('Access-Control-Allow-Origin') === CORS['Access-Control-Allow-Origin'], 'anderer Fehler: trotzdem CORS')
  pruefe(Boolean(((await normal.json()) as { error: string }).error), 'anderer Fehler: JSON mit error')

  const offen = await mitAuffangnetz('/lauf', CORS, werfe(new Error('kaputt')))
  pruefe(offen.status === 500 && offen.headers.get('Access-Control-Allow-Origin') === '*', 'offener Pfad (/lauf): 500 mit CORS *')

  const ok = await mitAuffangnetz('/prefs', CORS, async () => new Response('x', { status: 201 }))
  pruefe(ok.status === 201 && (await ok.text()) === 'x', 'Erfolg wird unverändert durchgereicht')
}

/** Der Aufrufer: `fetch` des Workers muss das Netz wirklich um die Routen legen. */
async function verdrahtung() {
  const db = (e: unknown) => ({ prepare: () => { throw e } }) as unknown as D1Database
  const env = (e: unknown) => ({ DB: db(e), ALLOWED_ORIGIN: 'https://anime.example' }) as unknown as Env
  const ctx = {} as ExecutionContext
  const anfrage = new Request('https://worker.example/status')

  const limit = await worker.fetch(anfrage, env(D1_LIMIT), ctx)
  pruefe(limit.status === 503, 'Worker.fetch: Tageslimit in einer Route -> 503')
  pruefe(Number(limit.headers.get('Retry-After')) > 0, 'Worker.fetch: Retry-After gesetzt')
  pruefe(limit.headers.get('Access-Control-Allow-Origin') === 'https://anime.example', 'Worker.fetch: CORS-Kopf aus ALLOWED_ORIGIN')

  const normal = await worker.fetch(anfrage, env(new Error('kaputt')), ctx)
  pruefe(normal.status === 500, 'Worker.fetch: anderer Fehler -> 500')
  pruefe(normal.headers.get('Access-Control-Allow-Origin') === 'https://anime.example', 'Worker.fetch: 500 trägt CORS')
}

await netz()
await verdrahtung()
if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
