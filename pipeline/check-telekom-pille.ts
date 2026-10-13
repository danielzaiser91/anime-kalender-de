/**
 * Zusicherung zur Pille eines Telekom-Wegs (13.10.2026): Videoload/MagentaTV tragen `dubRanges` aus der Annahme
 * (`lib/telekom-annahme.ts`), die Pille zeigt dazu keine Folgenzahl — ein Beleg mit derselben Spanne schon.
 * Gerendert wird `streamZeilen` (`web/src/components/detail/wege-zeilen.tsx`). Aufruf: `npm run check:logic`.
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

const MARKE = 'FOLGENZAHL-DA'
const deutsch = [{ from: 1, to: 12, dub: true }]
const weg = (extra: Partial<WatchLink>): WatchLink => ({ name: 'Videoload', url: 'https://x/Videoload', kind: 'stream', zugang: 'kauf', ...extra })
const title = { id: 1, slug: 'x', format: 'TV', episodes: 12, streams: [], watchLinks: [] } as unknown as Title

function pille(w: WatchLink): string {
  const zeilen = streamZeilen({
    sortiertNachZugang: [{ plattformen: [], streamWege: gruppiereKaufwege([w]) }] as never,
    title,
    t: ((k: string) => k) as never,
    today: '2026-10-13',
    folgenAngabeFuer: () => MARKE,
    dubZeilen: () => [],
    releaseJePlattform: new Map(),
    streamReleases: [],
    releases: [],
    tvVorbei: [],
  })
  return renderToStaticMarkup(createElement(Fragment, null, ...zeilen))
}

console.log('\nPille eines Wegs mit Annahme:')
const angenommen = pille(weg({ dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' }))
const belegt = pille(weg({ dubRanges: deutsch }))
pruefe('Annahme: die Pille nennt keine Folgenzahl', angenommen.includes('Videoload') && !angenommen.includes(MARKE), angenommen.slice(0, 300))
pruefe('Beleg mit derselben Spanne: die Pille nennt die Folgenzahl (Gegenprobe)', belegt.includes(MARKE), belegt.slice(0, 300))

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
