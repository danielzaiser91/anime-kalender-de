/**
 * Attrappe von ADN für `pipeline/check-adn-sprachriegel-lauf.ts`: `fetch` antwortet auf jede Serie (`/video/show/<id>`) mit der
 * Datei `$AK_ADN_ANTWORT` (JSON-Liste von Videos), auf die Serienliste (`/show`) mit den Kennungen aus `$AK_ADN_LISTE` (Komma-getrennt,
 * Sprache `vostf`) und auf alles andere mit 404. `$AK_ADN_STATUS` ("<id>:<status>,…") setzt für einzelne Serien einen festen
 * Statuscode (500 = Abbruch, 404 = nicht im Angebot). Kein Netz, kein Server.
 */
import { readFileSync } from 'node:fs'

/** Statuscode, den `$AK_ADN_STATUS` für diese Serie vorgibt, sonst undefined. */
function festerStatus(id) {
  const eintraege = (process.env.AK_ADN_STATUS ?? '').split(',').map((e) => e.split(':'))
  return eintraege.find(([k]) => k === id)?.[1]
}

globalThis.fetch = async (url) => {
  const pfad = new URL(String(url)).pathname
  if (pfad.startsWith('/video/show/')) {
    const status = festerStatus(pfad.split('/').pop())
    if (status) return new Response('{}', { status: Number(status) })
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
