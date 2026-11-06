/**
 * Zusicherung zu „Danach auf Joyn" (06.11.2026): ein ProSieben-MAXX-Termin eines Titels mit Joyn-Weg trägt den Link
 * auf dessen Joyn-Seite; andere Sender, andere Plattformen und Titel ohne Joyn-Weg nicht. Gerendert wird `terminPillen`
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
const ANDERE = 'https://www.joyn.de/serien/andere-seite'
const stream = (platform: string, url: string) => ({ platform, name: platform, url, kind: 'stream' })
const titel = (streams: unknown[]) => ({ id: 900001, slug: 'probe', format: 'TV', episodes: 26, streams, watchLinks: [] }) as unknown as Title
const termin = (extra: Partial<Release>): Release =>
  ({ slug: 'probe-1', titleId: 900001, name: 'Probe', platform: 'tv', sender: 'ProSieben MAXX', releaseType: 'episode', sources: [], schedule: { time: '18:25' }, ...extra }) as unknown as Release

function html(r: Release, t: Title): string {
  const zeilen = terminPillen([r], t, [r], '2026-11-06', (() => '') as never)
  return renderToStaticMarkup(createElement(Fragment, null, ...zeilen))
}

const mitJoyn = titel([stream('netflix', 'https://www.netflix.com/title/1'), stream('joyn', JOYN)])
console.log('\nTerminzeile mit „Danach auf Joyn":')
const maxx = html(termin({}), mitJoyn)
pruefe('MAXX-Termin: Link auf die Joyn-Seite des Titels', maxx.includes(`href="${JOYN}"`) && maxx.includes('Danach auf Joyn'), maxx.slice(0, 400))
pruefe('Schreibweise des Senders egal', html(termin({ sender: ' prosieben maxx ' }), mitJoyn).includes(`href="${JOYN}"`))
const mehrere = html(termin({}), titel([stream('joyn', JOYN), stream('joyn', ANDERE)]))
pruefe('mehrere Joyn-Wege: der erste, nicht geraten', mehrere.includes(`href="${JOYN}"`) && !mehrere.includes(ANDERE))
pruefe('anderer Sender (RTLZWEI): kein Link', !html(termin({ sender: 'RTLZWEI' }), mitJoyn).includes('Danach auf Joyn'))
pruefe('Titel ohne Joyn-Weg: kein Link', !html(termin({}), titel([stream('netflix', 'https://www.netflix.com/title/1')])).includes('Danach auf Joyn'))
pruefe('Joyn-Weg ohne Adresse: kein Link', !html(termin({}), titel([stream('joyn', '')])).includes('Danach auf Joyn'))
pruefe('Termin auf einem Stream-Anbieter: kein Link', !html(termin({ platform: 'netflix', sender: undefined }), mitJoyn).includes('Danach auf Joyn'))

if (verletzt) {
  console.error(`\n✖ check-joyn-danach: ${verletzt} verletzt`)
  process.exit(1)
}
console.log('✓ check-joyn-danach: 7 Fälle ok')
