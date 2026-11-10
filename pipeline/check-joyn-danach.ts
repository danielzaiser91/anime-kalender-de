/**
 * Zusicherung gegen eine Dublette im Detail-Panel (10.11.2026): „Danach auf Joyn" steht nicht in der TV-Zeile eines
 * ProSieben-MAXX-Termins. Die Information trägt schon die Joyn-Pille des Titels (Link, Fenster „ab …"); in der Knopfzeile
 * der TV-Box nahm der Text 102 px und quetschte den Sendernamen auf 48 px. Gerendert wird `terminPillen`
 * (`web/src/components/detail/wege-zeilen.tsx`), also der echte Weg bis in die Terminzeile. Aufruf: `npm run check:logic`.
 */
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release, Title } from '../shared/types.ts'
import { terminPillen } from '../web/src/components/detail/wege-zeilen.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const JOYN = 'https://www.joyn.de/serien/probe-yaiba'
const NETFLIX = 'https://www.netflix.com/title/1'
const stream = (platform: string, url: string) => ({ platform, name: platform, url, kind: 'stream' })
const titel = (streams: unknown[]) => ({ id: 900001, slug: 'probe', format: 'TV', episodes: 26, streams, watchLinks: [] }) as unknown as Title
const termin = (extra: Partial<Release>): Release =>
  ({ slug: 'probe-1', titleId: 900001, name: 'Probe', platform: 'tv', sender: 'ProSieben MAXX', releaseType: 'episode', sources: [], schedule: { time: '18:25' }, ...extra }) as unknown as Release

function html(r: Release, t: Title): string {
  const zeilen = terminPillen([r], t, [r], '2026-11-06', (() => '') as never)
  return renderToStaticMarkup(createElement(Fragment, null, ...zeilen))
}

const mitJoyn = titel([stream('netflix', NETFLIX), stream('joyn', JOYN)])
console.log('\nTV-Zeile eines MAXX-Termins mit Joyn-Weg:')
const maxx = html(termin({}), mitJoyn)
pruefe('Kontrolle: die Zeile ist gerendert (Livestream-Knopf da)', maxx.includes('aria-label="Live auf Joyn"'), maxx.slice(0, 400))
pruefe('keine Dublette: kein „Danach auf Joyn"', !maxx.includes('Danach auf Joyn'), maxx.slice(0, 400))
pruefe('keine Dublette: kein Link auf die Joyn-Seite des Titels (den trägt die Pille)', !maxx.includes(JOYN), maxx.slice(0, 400))
pruefe('anderer Sender (RTLZWEI): auch kein „Danach auf Joyn"', !html(termin({ sender: 'RTLZWEI' }), mitJoyn).includes('Danach auf Joyn'))
pruefe('Titel ohne Joyn-Weg: kein „Danach auf Joyn"', !html(termin({}), titel([stream('netflix', NETFLIX)])).includes('Danach auf Joyn'))

if (verletzt) {
  console.error(`\n✖ check-joyn-danach: ${verletzt} verletzt`)
  process.exit(1)
}
console.log('✓ check-joyn-danach: 5 Fälle ok')
