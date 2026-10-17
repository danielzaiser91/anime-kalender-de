/**
 * Attrappe des Workers für `pipeline/check-vorfaelle-ablauf.ts`: GET `/vorfall` liefert `$AK_ROOT/vorfaelle.json`,
 * DELETE `/vorfall` legt den Auftrag nach `$AK_ROOT/delete.json` (Status `$AK_DELETE_STATUS`, Vorgabe 200).
 * Ohne Token antwortet sie 401, jeder andere Aufruf schlägt fehl. Kein Netz, kein Server.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const wurzel = process.env.AK_ROOT

globalThis.fetch = async (url, optionen) => {
  const pfad = new URL(String(url)).pathname
  if (optionen?.method === 'DELETE' && pfad === '/vorfall') {
    if (new Headers(optionen.headers).get('X-Lauf-Token') !== 'test') return new Response('', { status: 401 })
    writeFileSync(`${wurzel}/delete.json`, String(optionen.body))
    return new Response('{}', { status: Number(process.env.AK_DELETE_STATUS ?? 200) })
  }
  if (!optionen?.method && pfad === '/vorfall') {
    return new Response(readFileSync(`${wurzel}/vorfaelle.json`, 'utf8'), { status: 200 })
  }
  throw new Error(`Attrappe: unerwarteter Aufruf ${optionen?.method ?? 'GET'} ${url}`)
}
