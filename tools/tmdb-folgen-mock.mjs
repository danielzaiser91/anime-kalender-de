/**
 * Attrappe für `pipeline/check-tmdb-folgen-lauf.ts`: feste Uhr (24.10.2026 10:00 UTC) und ein `fetch`, das TMDB nachstellt
 * und jede Serien-Kennung in Abrufreihenfolge nach `$AK_ROOT/abrufe.txt` schreibt. Kein Netz; andere Adressen schlagen fehl.
 */
import { appendFileSync } from 'node:fs'

const FEST = Date.parse('2026-10-24T10:00:00Z')
const EchtesDate = Date

class FestesDate extends EchtesDate {
  constructor(...args) {
    if (args.length === 0) super(FEST)
    else super(...args)
  }

  static now() {
    return FEST
  }
}
globalThis.Date = FestesDate

globalThis.fetch = async (url) => {
  const u = new URL(String(url))
  const serie = /^\/3\/tv\/(\d+)$/.exec(u.pathname)
  if (serie) {
    appendFileSync(`${process.env.AK_ROOT}/abrufe.txt`, `${serie[1]}\n`)
    return new Response(JSON.stringify({ name: 'Kulisse', seasons: [{ season_number: 1 }] }), { status: 200 })
  }
  if (/^\/3\/tv\/\d+\/season\/1$/.test(u.pathname)) {
    const episodes = [{ episode_number: 1, name: 'Der Anfang', air_date: '2026-10-20', runtime: 24 }]
    return new Response(JSON.stringify({ episodes }), { status: 200 })
  }
  throw new Error(`Attrappe: unerwarteter Aufruf ${url}`)
}
