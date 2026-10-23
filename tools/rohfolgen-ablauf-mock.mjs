/**
 * Attrappe des Workers für `pipeline/check-rohfolgen-ablauf.ts`: `fetch` liefert die Rohfolgen aus `$AK_ROOT/rohfolgen.json`
 * und legt den Abhak-Auftrag (POST auf `/pruefung`) nach `$AK_ROOT/post.json`, mit Status `$AK_POST_STATUS` (Vorgabe 200).
 * Ohne Token antwortet sie 401; ein anderer Pfad oder eine andere Methode schlägt fehl, statt still zu gelingen. Kein Netz, kein Server.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const wurzel = process.env.AK_ROOT

globalThis.fetch = async (url, optionen) => {
  const pfad = new URL(String(url)).pathname
  if (optionen?.method === 'POST' && pfad === '/pruefung') {
    if (new Headers(optionen.headers).get('X-Lauf-Token') !== 'test') return new Response('', { status: 401 })
    writeFileSync(`${wurzel}/post.json`, String(optionen.body))
    return new Response('{}', { status: Number(process.env.AK_POST_STATUS ?? 200) })
  }
  if (!optionen?.method && pfad === '/pruefung') {
    const folgen = JSON.parse(readFileSync(`${wurzel}/rohfolgen.json`, 'utf8'))
    return new Response(JSON.stringify({ folgen, weiter: null }), { status: 200 })
  }
  throw new Error(`Attrappe: unerwarteter Aufruf ${optionen?.method ?? 'GET'} ${url}`)
}
