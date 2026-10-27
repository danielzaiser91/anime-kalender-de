/**
 * Zusicherung zu Zeichen und Randfarbe der Bezugsweg-Pillen (27.10.2026, „Weitere Anbieter“ bei Dragon Ball Super: Beerus):
 * JustWatch/TMDB nennen Anbieter anders als `PLATFORMS` („Disney Plus“, „Animation Digital Network“, „Rtl+“); die Pille
 * blieb dann ohne Zeichen und Farbrand. Die Namen unten sind die Schreibweisen aus `watchLinks` (Stand 27.10.2026),
 * Erwartung fest eingetragen. Gerendert wird `streamZeilen`. Aufruf: `npm run check:logic`.
 */
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Title, WatchLink } from '../shared/types.ts'
import { streamZeilen } from '../web/src/components/detail/wege-zeilen.tsx'
import { gruppiereKaufwege } from '../web/src/components/detail/pillen.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const title = { id: 1, slug: 'x', format: 'TV', episodes: 12, streams: [], watchLinks: [] } as unknown as Title

function pille(name: string): string {
  const w: WatchLink = { name, url: `https://x/${encodeURIComponent(name)}`, kind: 'stream', zugang: 'abo' }
  const zeilen = streamZeilen({
    sortiertNachZugang: [{ plattformen: [], streamWege: gruppiereKaufwege([w]) }] as never,
    title,
    t: ((k: string) => k) as never,
    today: '2026-10-27',
    folgenAngabeFuer: () => '',
    dubZeilen: () => [],
    releaseJePlattform: new Map(),
    streamReleases: [],
    releases: [],
    tvVorbei: [],
  })
  return renderToStaticMarkup(createElement(Fragment, null, ...zeilen))
}

/** Name im Datensatz → erwartete Randfarbe und Zeichendatei (`null`: bewusst ohne, weil kein belegtes Zeichen bzw. keine belegte Farbe vorliegt). */
const ERWARTET: [string, string | null, string | null][] = [
  ['Disney Plus', '#0063e5', 'disneyplus'],
  ['Animation Digital Network', '#0095ff', 'adn'],
  ['Rtl+', '#e2001a', 'rtlplus'],
  ['Netflix', '#e50914', 'netflix'],
  ['Netflix Standard With Ads', '#e50914', 'netflix'],
  ['Paramount+', '#0064ff', 'paramountplus'],
  ['Paramount+ über Apple TV', '#0064ff', 'paramountplus'],
  ['Crunchyroll', '#f47521', 'crunchyroll'],
  ['YouTube', '#ff0000', 'youtube'],
  ['Amazon Prime (Crunchyroll)', '#00a8e1', 'primevideo'],
  ['Apple TV', '#a1a1aa', 'apple-tv'],
  ['Google Play', '#a1a1aa', 'google-play'],
  ['maxdome', '#0094d7', 'maxdome'],
  ['MagentaTV', '#e20074', null],
  ['Videoload', '#e20074', null],
  ['Rakuten TV', '#bf0000', 'rakuten-tv'],
  ['Sky Store', '#0072c9', 'sky-store'],
  ['freenet meinVOD', '#84bc34', 'freenet'],
  ['TOGGO', '#ec6400', 'toggo'],
  ['Hbo Max', null, null],
]

console.log('\nZeichen und Randfarbe je Bezugsweg-Name:')
for (const [name, farbe, datei] of ERWARTET) {
  const html = pille(name)
  const hatFarbe = html.includes('--marke:')
  pruefe(`${name}: Randfarbe ${farbe ?? 'keine'}`, farbe ? html.includes(`--marke:${farbe}`) : !hatFarbe, html.match(/--marke:[^;"]*/)?.[0])
  const hatZeichen = datei ? html.includes(`anbieter/${datei}.svg`) : !/anbieter\/[a-z-]+\.svg/.test(html)
  pruefe(`${name}: Zeichen ${datei ?? 'keines'}`, hatZeichen, html.match(/anbieter\/[a-z-]+\.svg/)?.[0])
}

console.log(`\ncheck-anbieter-logo: ${ERWARTET.length} Namen, ${verletzt} verletzt`)
process.exit(verletzt ? 1 : 0)
