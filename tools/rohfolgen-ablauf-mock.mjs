/**
 * Attrappe des Workers für `pipeline/check-rohfolgen-ablauf.ts`: `fetch` liefert die Rohfolgen aus `$AK_ROOT/rohfolgen.json`
 * und legt den Abhak-Auftrag (POST) nach `$AK_ROOT/post.json`. Kein Netz, kein Server.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const wurzel = process.env.AK_ROOT

globalThis.fetch = async (_url, optionen) => {
  if (optionen?.method === 'POST') {
    writeFileSync(`${wurzel}/post.json`, String(optionen.body))
    return new Response('{}', { status: 200 })
  }
  const folgen = JSON.parse(readFileSync(`${wurzel}/rohfolgen.json`, 'utf8'))
  return new Response(JSON.stringify({ folgen, weiter: null }), { status: 200 })
}
