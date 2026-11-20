/**
 * Zusicherung zur TV-Karte (Daniel, 20.11.2026, TOGGO plus Fg. 36): Die Fußzeile der Pille gibt es erst ab zwei Knöpfen
 * (Live, Programm, Merken — Merken nur bei künftigem Termin). Ein einzelner Knopf steht rechts neben der Kopfzeile.
 * Die runden Symbolknöpfe tragen einen Rand (`border-ak-rand`). Feste Zeit, keine Uhr. Aufruf: `npm run check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release } from '../shared/types.ts'
import { LiveLink } from '../web/src/components/detail/live-link.tsx'
import { TerminZeile, brauchtFussZeile } from '../web/src/components/detail/termin-zeile.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-10'
const QUELLE = 'https://www.anime2you.de/x/'
const PROGRAMM = 'https://www.tvspielfilm.de/probe-programm'
const LIVE = 'https://www.joyn.de/play/live-tv?channel_id=5'
const tv = (sender: string, datum: string): Release =>
  ({
    slug: 'probe-tv',
    titleId: 900101,
    name: 'Probe',
    platform: 'tv',
    sender,
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: datum,
      time: '18:25',
      episodeCount: 1,
    },
    year: 2026,
    sources: [QUELLE],
    quellen: [{ url: QUELLE, name: 'a' }],
  }) as unknown as Release
const zeile = (r: Release, programm?: string): string =>
  renderToStaticMarkup(createElement(TerminZeile, { release: r, titel: 'Probe', today: HEUTE, tvText: { text: 'Fg. 36', premiere: false, programm } }))
const fussZeile = (h: string): boolean => h.includes('border-t border-ak-linie')

console.log('\nTV-Karte: Fußzeile nach Zahl der Knöpfe:')
pruefe('Regel: 0 und 1 Knopf keine Fußzeile, 2 und 3 schon', [0, 1, 2, 3].map(brauchtFussZeile).join() === 'false,false,true,true')
const toggo = zeile(tv('TOGGO', '2026-11-01'), PROGRAMM)
pruefe('TOGGO, vergangen: nur Programm → ein Knopf, keine Fußzeile', toggo.includes(PROGRAMM) && !fussZeile(toggo))
pruefe('… der Knopf steht neben der Kopfzeile (aktion), nicht in der Fläche', toggo.includes('<div class="flex max-w-full items-center gap-1') && toggo.indexOf(PROGRAMM) > toggo.indexOf('</a>'), toggo.slice(0, 120))
const toggoMerken = zeile(tv('TOGGO', '2026-11-20'), PROGRAMM)
pruefe('TOGGO, künftig: Programm und Merken → zwei Knöpfe, Fußzeile', fussZeile(toggoMerken) && toggoMerken.includes(PROGRAMM) && toggoMerken.includes('<button'), toggoMerken.slice(-300))
const maxx = zeile(tv('ProSieben MAXX', '2026-11-01'), PROGRAMM)
pruefe('MAXX, vergangen: Live und Programm → zwei Knöpfe, Fußzeile', fussZeile(maxx) && maxx.includes(LIVE) && maxx.includes(PROGRAMM))
const nurLive = zeile({ ...tv('ProSieben MAXX', '2026-11-01'), sources: [], quellen: [] } as Release)
pruefe('MAXX, vergangen, ohne Programm und Quelle: nur Live → ein Knopf, keine Fußzeile', nurLive.includes(LIVE) && !fussZeile(nurLive))
const nurLiveMerken = zeile({ ...tv('ProSieben MAXX', '2026-11-20'), sources: [], quellen: [] } as Release)
pruefe('MAXX, künftig, nur Live und Merken: zwei Knöpfe, Fußzeile', nurLiveMerken.includes(LIVE) && fussZeile(nurLiveMerken))
pruefe('Stream-Termin ohne Knöpfe: keine Fußzeile', !fussZeile(zeile({ ...tv('x', '2026-11-01'), platform: 'primevideo', sender: undefined } as Release)))

console.log('\nTV-Karte: runde Symbolknöpfe mit Rand:')
pruefe('Programm-Knopf: rund mit `border-ak-rand`', /<a [^>]*size-11[^>]*rounded-full[^>]*border border-ak-rand/.test(toggo), toggo)
pruefe('Live-Knopf (nur Zeichen): rund mit `border-ak-rand`', /<a [^>]*size-11[^>]*border border-ak-rand/.test(renderToStaticMarkup(createElement(LiveLink, { url: LIVE, hinweis: 'Live' }))))
pruefe('Merken-Knopf: rund mit `border-ak-rand`', /<button [^>]*size-11[^>]*rounded-full[^>]*border border-ak-rand/.test(toggoMerken), toggoMerken.slice(-400))

console.log(`\nTV-Karte Knopfzahl: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
