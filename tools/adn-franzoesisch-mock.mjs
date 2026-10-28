/**
 * Attrappe von ADN für `pipeline/check-adn-sprachriegel-lauf.ts`: `fetch` antwortet auf jede Serie (`/video/show/<id>`) mit der
 * Datei `$AK_ADN_ANTWORT` (JSON-Liste von Videos), auf die Serienliste (`/show`) mit den Kennungen aus `$AK_ADN_LISTE` (Komma-getrennt,
 * Sprache `vostf`) und auf alles andere mit 404. Kein Netz, kein Server.
 */
import { readFileSync } from 'node:fs'

globalThis.fetch = async (url) => {
  const pfad = new URL(String(url)).pathname
  if (pfad.startsWith('/video/show/')) {
    const videos = JSON.parse(readFileSync(process.env.AK_ADN_ANTWORT, 'utf8'))
    return new Response(JSON.stringify({ videos }), { status: 200 })
  }
  if (pfad === '/show') {
    const ids = (process.env.AK_ADN_LISTE ?? '').split(',').filter(Boolean)
    const shows = ids.map((id) => ({ id: Number(id), title: `Serie ${id}`, languages: ['vostf'] }))
    return new Response(JSON.stringify({ shows }), { status: 200 })
  }
  return new Response('{}', { status: 404 })
}
