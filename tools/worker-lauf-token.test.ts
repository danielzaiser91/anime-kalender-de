/**
 * Prüf-Token: Header `Authorization: Bearer` gilt, `?token=` gilt nicht mehr, falscher oder fehlender Token wird abgewiesen.
 * Läuft die echten Handler (`/cr-zugang`, `/debug/…` über den Eingang, Lese-Deckel), nicht nur den Helfer.
 *
 * Aufruf: `npx tsx tools/worker-lauf-token.test.ts`
 */
import assert from 'node:assert/strict'
import { tokenAusKopf, tokenGleich } from '../worker/src/lauf-token.ts'
import { adminAnfrage } from '../web/src/lib/admin-aufruf.ts'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { handleCrZugang } from '../worker/src/cr-zugang.ts'
import { GEDECKELT, istFrei } from '../worker/src/lesedeckel.ts'
import { type Env } from '../worker/src/env.ts'

const GEHEIM = 'geheim-1'
const db = { prepare: () => ({ first: async () => null }) }
const env = { LAUF_TOKEN: GEHEIM, DEBUG_TOKEN: 'debug-1', DB: db } as unknown as Env
const anfrage = (suche: string, kopf: Record<string, string> = {}) => new Request(`https://w.test/cr-zugang${suche}`, { headers: kopf })

/* Helfer */
assert.equal(tokenAusKopf(anfrage('', { Authorization: `Bearer ${GEHEIM}` })), GEHEIM)
assert.equal(tokenAusKopf(anfrage('', { authorization: `bearer ${GEHEIM}` })), GEHEIM, 'Schema ohne Rücksicht auf Groß-/Kleinschreibung')
assert.equal(tokenAusKopf(anfrage('', { 'X-Lauf-Token': 'alt' })), 'alt', 'bisheriger Kopf gilt weiter')
assert.equal(tokenAusKopf(anfrage('', { Authorization: 'Basic abc' })), '', 'anderes Schema ist kein Token')
assert.equal(tokenAusKopf(anfrage('?token=q')), '', 'tokenAusKopf liest die Adresse nie')

/* Zeitkonstanter Vergleich: gleiche Länge, andere Länge, Präfix, leer, fehlendes Geheimnis */
assert.equal(tokenGleich('abc', 'abc'), true)
assert.equal(tokenGleich('abd', 'abc'), false)
assert.equal(tokenGleich('ab', 'abc'), false)
assert.equal(tokenGleich('abcd', 'abc'), false)
assert.equal(tokenGleich('abb', 'abc'), false, 'A1: Unterschied von genau einem Bit')
assert.equal(tokenGleich('abc' + String.fromCharCode(0), 'abc'), false, 'A2: nur ein angehängtes NUL, gleiche Zeichen sonst')
assert.equal(tokenGleich('', 'abc'), false)
assert.equal(tokenGleich('', ''), false, 'leeres Geheimnis stimmt nie')
assert.equal(tokenGleich('x', undefined), false)

/* Echter Handler /cr-zugang: Kopf ok (404 = hinter der Sperre, kein Paket), Query abgelehnt (403), sonst 403 */
const status = async (suche: string, kopf?: Record<string, string>) => (await handleCrZugang(anfrage(suche, kopf), env)).status
assert.equal(await status('', { Authorization: `Bearer ${GEHEIM}` }), 404, 'Bearer ok')
assert.equal(await status('', { 'X-Lauf-Token': GEHEIM }), 404, 'X-Lauf-Token ok')
assert.equal(await status(`?token=${GEHEIM}`), 403, 'richtiges Token in der Adresse wird abgelehnt')
assert.equal(await status('', { Authorization: 'Bearer falsch' }), 403, 'falscher Bearer')
assert.equal(await status('?token=falsch'), 403, 'falsche Query')
assert.equal(await status('', { Authorization: 'Bearer falsch' }), 403)
assert.equal(await status(''), 403, 'kein Token')
assert.equal(await status('', { Authorization: 'Bearer ' }), 403, 'leerer Bearer')
assert.equal(await status('?token=', { Authorization: 'Bearer falsch' }), 403, 'falscher Kopf wird nicht durch Query gerettet')
assert.equal((await handleCrZugang(anfrage('', { Authorization: `Bearer ${GEHEIM}` }), { ...env, LAUF_TOKEN: undefined } as unknown as Env)).status, 403, 'ohne Secret nie')

/* Lese-Deckel: gültiger Token (Kopf) lässt frei, falscher nicht; LAUF und DEBUG */
const pfad = GEDECKELT[0]
const deckel = (kopf: Record<string, string>, suche = '') => istFrei(new Request(`https://w.test${pfad}${suche}`, { headers: kopf }), env)
assert.equal(deckel({ Authorization: `Bearer ${GEHEIM}` }), true)
assert.equal(deckel({ Authorization: 'Bearer debug-1' }), true)
assert.equal(deckel({ Authorization: 'Bearer falsch' }), false)
assert.equal(deckel({}, `?token=${GEHEIM}`), false, 'richtiges Token in der Adresse lässt nicht frei')
assert.equal(deckel({}), false)

/* Bearer mit zwei Leerzeichen: der Token wird getrimmt (trim-Mutant) */
assert.equal(tokenAusKopf(anfrage('', { Authorization: 'Bearer  x' })), 'x')

/* Schreib-Routen /pruefung (POST, DELETE): Kopf geht, ?token= wird abgelehnt (403) */
for (const methode of ['POST', 'DELETE']) {
  const rufe = async (suche: string, kopf: Record<string, string> = {}) =>
    (await handlePruefung(new Request(`https://w.test/pruefung${suche}`, { method: methode, headers: kopf, body: '{}' }), env)).status
  assert.equal(await rufe(`?token=${GEHEIM}`), 403, `${methode}: richtiges Token in der Adresse wird abgelehnt`)
  assert.equal(await rufe(''), 403, `${methode}: ohne Token`)
  assert.equal(await rufe('', { Authorization: 'Bearer falsch' }), 403, `${methode}: falscher Bearer`)
  assert.notEqual(await rufe('', { Authorization: `Bearer ${GEHEIM}` }), 403, `${methode}: Bearer geht`)
  assert.notEqual(await rufe('', { 'X-Lauf-Token': GEHEIM }), 403, `${methode}: X-Lauf-Token geht`)
}

/* Betreiber-Panel: Token im Kopf, nie in der Adresse */
const aufrufe: { url: string; kopf: unknown }[] = []
const attrappe = async (url: string, init?: RequestInit) => aufrufe.push({ url, kopf: init?.headers })
for (const pfad of ['/debug/digest?frequency=daily', '/debug/monitor', '/status']) await attrappe(...adminAnfrage('https://w.test', pfad, 'geheim'))
assert.deepEqual(aufrufe.map((a) => a.url), ['https://w.test/debug/digest?frequency=daily', 'https://w.test/debug/monitor', 'https://w.test/status'])
assert.deepEqual(aufrufe[0]!.kopf, { Authorization: 'Bearer geheim' })
assert.deepEqual(aufrufe[1]!.kopf, { Authorization: 'Bearer geheim' })
assert.equal(aufrufe[2]!.kopf, undefined, 'öffentliche Pfade ohne Token')
assert.ok(aufrufe.every((a) => !a.url.includes('geheim')), 'Token nie in der Adresse')

console.log('worker-lauf-token.test: 3 Gruppen grün (Helfer, /cr-zugang, Lese-Deckel)')
