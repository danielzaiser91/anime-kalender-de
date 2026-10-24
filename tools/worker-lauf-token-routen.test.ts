/**
 * Prüf-Token an den Routen `/land`, `/netzfund` (GET, POST), `/vorfall` (GET, POST, DELETE), `/debug/digest` und
 * `/debug/monitor`: Bearer gilt, `?token=` übergangsweise, falscher oder fehlender Token -> 403. Läuft über `worker.fetch`.
 *
 * Aufruf: `npx tsx tools/worker-lauf-token-routen.test.ts`
 */
import assert from 'node:assert/strict'
import worker from '../worker/src/index.ts'
import type { Env } from '../worker/src/env.ts'
import { festeUhr } from './feste-uhr.ts'
import { fetchAttrappe, neueDatenbank, testEnv } from './worker-unteraufrufe-attrappe.ts'

festeUhr('2026-10-12T12:00:00Z')
fetchAttrappe('2026-10-12')
console.error = () => {}
console.log = () => {}
const ausgabe = (zeile: string) => process.stdout.write(`${zeile}\n`)

const env = { ...testEnv(neueDatenbank(), 7), LAUF_TOKEN: 'lauf-1', DEBUG_TOKEN: 'debug-1' } as Env
const ohneSecret = { ...env, LAUF_TOKEN: undefined, DEBUG_TOKEN: undefined } as unknown as Env

const rufe = (e: Env, pfad: string, kopf: Record<string, string> = {}, methode = 'GET') =>
  worker
    .fetch(
      new Request(`https://w.example.invalid${pfad}`, { method: methode, headers: kopf, body: methode === 'GET' ? undefined : '{}' }),
      e,
      { waitUntil() {} } as unknown as ExecutionContext,
    )
    .then((r) => r.status)

let faelle = 0
/** Eine Lese-Route: Bearer und Query ok (nicht 403), falsch/fehlend/leer/ohne Secret 403. */
async function leseRoute(pfad: string, geheim: string) {
  const mit = pfad.includes('?') ? '&' : '?'
  const nicht403 = async (status: Promise<number>, text: string) => {
    assert.notEqual(await status, 403, `${pfad}: ${text}`)
    faelle++
  }
  const ist403 = async (status: Promise<number>, text: string) => {
    assert.equal(await status, 403, `${pfad}: ${text}`)
    faelle++
  }
  await nicht403(rufe(env, pfad, { Authorization: `Bearer ${geheim}` }), 'Bearer ok')
  await nicht403(rufe(env, `${pfad}${mit}token=${geheim}`), 'Query übergangsweise ok')
  await ist403(rufe(env, pfad, { Authorization: 'Bearer falsch' }), 'falscher Bearer')
  await ist403(rufe(env, `${pfad}${mit}token=falsch`), 'falsche Query')
  await ist403(rufe(env, pfad), 'ohne Token')
  await ist403(rufe(env, pfad, { Authorization: 'Bearer ' }), 'leerer Bearer')
  await ist403(rufe(env, `${pfad}${mit}token=${geheim}`, { Authorization: 'Bearer falsch' }), 'falscher Kopf schlägt Query')
  await ist403(rufe(ohneSecret, pfad, { Authorization: `Bearer ${geheim}` }), 'ohne Secret nie')
}

/** Schreibende Methoden: nur X-Lauf-Token (kein Bearer-Zwang), falsch/fehlend 403. */
async function schreibRoute(pfad: string, methode: string) {
  const status = (e: Env, kopf: Record<string, string>) => rufe(e, pfad, kopf, methode)
  assert.notEqual(await status(env, { 'X-Lauf-Token': 'lauf-1' }), 403, `${methode} ${pfad}: richtiger Token`)
  assert.equal(await status(env, { 'X-Lauf-Token': 'falsch' }), 403, `${methode} ${pfad}: falscher Token`)
  assert.equal(await status(env, {}), 403, `${methode} ${pfad}: ohne Token`)
  assert.equal(await status(ohneSecret, { 'X-Lauf-Token': 'lauf-1' }), 403, `${methode} ${pfad}: ohne Secret`)
  faelle += 4
}

await leseRoute('/land', 'lauf-1')
await leseRoute('/netzfund', 'lauf-1')
await leseRoute('/vorfall', 'lauf-1')
await leseRoute('/debug/digest?frequency=daily', 'debug-1')
await leseRoute('/debug/monitor', 'debug-1')
assert.equal(await rufe(env, '/land', { Authorization: 'Bearer lauf-1' }), 200, '/land liefert die Messung')
assert.equal(await rufe(env, '/debug/digest', { Authorization: 'Bearer lauf-1' }), 403, 'LAUF_TOKEN öffnet /debug nicht')
assert.equal(await rufe(env, '/land', { Authorization: 'Bearer debug-1' }), 403, 'DEBUG_TOKEN öffnet /land nicht')

await schreibRoute('/netzfund', 'POST')
await schreibRoute('/vorfall', 'POST')
await schreibRoute('/vorfall', 'DELETE')

ausgabe(`worker-lauf-token-routen.test: ${faelle} Fälle grün (/land, /netzfund, /vorfall, /debug/digest, /debug/monitor)`)
