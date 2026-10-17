/**
 * Attrappe der aniSearch-Schnittstelle für `pipeline/check-anisearch-marke-nachziehen.ts`: `GET /v1/anime/dubs` liefert `$AK_ROOT/dubs-antwort.json`;
 * jeder andere Aufruf schlägt fehl, statt still zu gelingen. Kein Netz, kein Server.
 */
import { readFileSync } from 'node:fs'

globalThis.fetch = async (url, optionen) => {
  const adresse = new URL(String(url))
  if (optionen?.method || adresse.hostname !== 'api.anisearch.com' || adresse.pathname !== '/v1/anime/dubs') {
    throw new Error(`Attrappe: unerwarteter Aufruf ${optionen?.method ?? 'GET'} ${url}`)
  }
  return new Response(readFileSync(`${process.env.AK_ROOT}/dubs-antwort.json`, 'utf8'), { status: 200 })
}
