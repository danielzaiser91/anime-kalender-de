/**
 * Attrappe des Workers für `pipeline/check-urteile-ablauf.ts`: `fetch` liefert Meldungen (`alle=1`) aus `$AK_ROOT/meldungen.json`
 * und Rohfolgen (`rohfolgen=1`) aus `$AK_ROOT/rohfolgen.json`. Ohne den Bearer-Token `test` antwortet sie 401; jeder andere
 * Aufruf schlägt fehl, statt still zu gelingen. Kein Netz, kein Server.
 */
import { readFileSync } from 'node:fs'

const wurzel = process.env.AK_ROOT

globalThis.fetch = async (url, optionen) => {
  const u = new URL(String(url))
  if (u.pathname !== '/pruefung' || optionen?.method) throw new Error(`Attrappe: unerwarteter Aufruf ${optionen?.method ?? 'GET'} ${url}`)
  if (new Headers(optionen?.headers).get('Authorization') !== 'Bearer test') return new Response('', { status: 401 })
  const roh = u.searchParams.has('rohfolgen')
  const inhalt = JSON.parse(readFileSync(`${wurzel}/${roh ? 'rohfolgen' : 'meldungen'}.json`, 'utf8'))
  return new Response(JSON.stringify(roh ? { folgen: inhalt, weiter: null } : { pruefungen: inhalt, weiter: null }), { status: 200 })
}
