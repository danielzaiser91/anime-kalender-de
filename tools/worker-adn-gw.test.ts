/**
 * ADN-Durchreiche (`worker/src/adn-gw.ts`) und Wegwahl (`pipeline/lib/adn-weg.ts`).
 *
 * Aufruf: `npx tsx tools/worker-adn-gw.test.ts`
 */
import { handleAdnGw } from '../worker/src/adn-gw.ts'
import { readFileSync } from 'node:fs'
import eingangWorker from '../worker/src/adn-gw-eingang.ts'
import { adnWeg } from '../pipeline/lib/adn-weg.ts'
import type { Env } from '../worker/src/env.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const env = { LAUF_TOKEN: 'geheim-1' } as unknown as Env
const ECHT_FETCH = globalThis.fetch
const gesehen: { url: string; kopf: Headers }[] = []
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  gesehen.push({ url, kopf: new Headers(init?.headers) })
  return new Response('{"videos":[{"languages":["vostde","vde"]}]}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

const frage = (pfad: string, kopf: Record<string, string> = {}, methode = 'GET') =>
  handleAdnGw(new Request(`https://w.example/adn-gw${pfad}`, { method: methode, headers: kopf }), env)
const mitToken = { Authorization: 'Bearer geheim-1', 'X-Target-Distribution': 'de', 'Accept-Language': 'de', 'User-Agent': 'ak-test', Cookie: 'x=1' }

const ok = await frage('/video/show/1125?limit=100&offset=0', mitToken)
pruefe(ok.status === 200 && (await ok.text()).includes('vde'), 'Serie: 200 und Antwort durchgereicht')
pruefe(gesehen[0]?.url === 'https://gw.api.animationdigitalnetwork.com/video/show/1125?limit=100&offset=0', 'Serie: Ziel und Query unverändert')
pruefe(gesehen[0]?.kopf.get('X-Target-Distribution') === 'de' && gesehen[0]?.kopf.get('Accept-Language') === 'de', 'Köpfe des Laufs gehen mit')
pruefe(!gesehen[0]?.kopf.has('Authorization') && !gesehen[0]?.kopf.has('Cookie'), 'Token und Cookie gehen nie zu ADN')

for (const pfad of ['/video/calendar?date=2026-11-03', '/show?limit=100&offset=0']) {
  const n = gesehen.length
  const r = await frage(pfad, mitToken)
  pruefe(r.status === 200 && gesehen.length === n + 1, `erlaubter Pfad ${pfad.split('?')[0]}`)
}

const n = gesehen.length
const ohne = await frage('/video/show/1125', {})
pruefe(ohne.status === 403 && gesehen.length === n, 'ohne Token: 403, kein Abruf')
const falsch = await frage('/video/show/1125', { Authorization: 'Bearer geheim-2' })
pruefe(falsch.status === 403 && gesehen.length === n, 'falscher Token: 403, kein Abruf')
const leer = await handleAdnGw(new Request('https://w.example/adn-gw/show', { headers: { Authorization: 'Bearer ' } }), {} as Env)
pruefe(leer.status === 403 && gesehen.length === n, 'Worker ohne Geheimnis: 403')
const post = await frage('/show', mitToken, 'POST')
pruefe(post.status === 405 && gesehen.length === n, 'POST: 405, kein Abruf')
for (const pfad of ['/user/me', '/video/show/abc', '/video/show/1/../../x', '/show/5', '/video/calendar/x']) {
  const r = await frage(pfad, mitToken)
  pruefe(r.status === 404 && gesehen.length === n, `Pfad ${pfad} nicht erlaubt`)
}

// Verdrahtung: der Eingang des eigenen Workers (`adn-gw-eingang.ts`) ruft die Durchreiche auf.
const vorher = gesehen.length
const eingang = await eingangWorker.fetch(new Request('https://w.example/adn-gw/video/show/1125?limit=100&offset=0', { headers: mitToken }), env)
pruefe(eingang.status === 200 && gesehen.length === vorher + 1, 'Eingang: /adn-gw wird durchgereicht')
const eingang403 = await eingangWorker.fetch(new Request('https://w.example/adn-gw/show'), env)
pruefe(eingang403.status === 403, 'Eingang: ohne Token 403')
const fremd = await eingangWorker.fetch(new Request('https://w.example/show', { headers: mitToken }), env)
pruefe(fremd.status === 404 && gesehen.length === vorher + 1, 'Eingang: Pfad ohne /adn-gw/ gar nicht erst abgerufen')

// Ohne Platzierung läuft der Worker im Colo des Runners (IAD) und ADN antwortet französisch (Messung 03.11.2026).
const toml = readFileSync(new URL('../worker/adn-gw.wrangler.toml', import.meta.url), 'utf8')
pruefe(/^\[placement\]\s*\nregion = "aws:eu-central-1"/m.test(toml), 'Platzierung Frankfurt in adn-gw.wrangler.toml')
pruefe(/^main = "src\/adn-gw-eingang\.ts"/m.test(toml), 'adn-gw.wrangler.toml startet den ADN-Eingang')

const direkt = adnWeg({})
pruefe(direkt.base === 'https://gw.api.animationdigitalnetwork.com' && Object.keys(direkt.auth).length === 0, 'ohne AK_ADN_PROXY: direkt, ohne Token')
pruefe(adnWeg({ AK_ADN_PROXY: '', LAUF_TOKEN: 't' }).auth.Authorization === undefined, 'leerer AK_ADN_PROXY: direkt, Token bleibt zu Hause')
const proxy = adnWeg({ AK_ADN_PROXY: 'https://w.example/adn-gw/', LAUF_TOKEN: 't1' })
pruefe(proxy.base === 'https://w.example/adn-gw' && proxy.auth.Authorization === 'Bearer t1', 'mit AK_ADN_PROXY: Worker, Bearer-Token, kein Schrägstrich am Ende')
let wurf = ''
try { adnWeg({ AK_ADN_PROXY: 'https://w.example/adn-gw' }) } catch (e) { wurf = (e as Error).message }
pruefe(wurf.includes('LAUF_TOKEN fehlt'), 'Proxy ohne Token: harter Fehler statt stillem Direktabruf')

globalThis.fetch = ECHT_FETCH
console.log(fehler ? `✖ ${fehler} Fall/Fälle rot` : '✔ ADN-Durchreiche: alle Fälle grün')
process.exit(fehler ? 1 : 0)
