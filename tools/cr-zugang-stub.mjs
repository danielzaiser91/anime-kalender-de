/**
 * Vorlader für `cr-zugang-holen.test.mjs` (node --import): ersetzt `fetch` und `execFileSync`, damit
 * `cr-zugang-holen.mjs` ohne Netz und ohne gh läuft. Antworten kommen aus der JSON-Datei CR_STUB
 * ({ token: { status, body }, index: { status, body } }); jeder Aufruf steht als JSON-Zeile in CR_STUB_LOG.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'

const antworten = JSON.parse(readFileSync(process.env.CR_STUB, 'utf8'))
const logge = (eintrag) => appendFileSync(process.env.CR_STUB_LOG, `${JSON.stringify(eintrag)}\n`)

globalThis.fetch = async (url, init = {}) => {
  logge({ art: 'fetch', url: String(url), methode: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body ?? null })
  const quelle = String(url).includes('index%2Fv2') || String(url).endsWith('/index/v2') ? antworten.index : antworten.token
  return { ok: quelle.status === 200, status: quelle.status, json: async () => quelle.body }
}

childProcess.execFileSync = (befehl, args) => {
  logge({ art: 'exec', befehl, args })
}
syncBuiltinESMExports()
