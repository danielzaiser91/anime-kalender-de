/**
 * Zusicherungen zur Pille „Deutsch laut Anbieter“: Ein Weg, dessen Ja der Bau ableitet (`dubAbgeleitet`: Joyn pauschal,
 * Prime-Kanal erbt), zeigt nicht „✓ Deutsch“ wie ein gemessener. Aufruf: `npm run check:logic`.
 */
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { StreamLink, Title } from '../shared/types.ts'
import { legendeDerZeilen, streamStatus, zeilenGruppen } from '../web/src/components/detail/legende-zeilen.ts'
import { falteTeilwege } from '../web/src/components/detail/wege-falten.ts'
import { pillenSchluessel, sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { streamZeilen } from '../web/src/components/detail/wege-zeilen.tsx'
import { legendeFuer } from '../web/src/components/detail/pille.tsx'
import { TEXTE_ZEILEN } from '../web/src/lib/i18n-zeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = { id: 900001, slug: 'x', streams: [] } as unknown as Title
const weg = (extra: Partial<StreamLink>): StreamLink => ({ platform: 'joyn', url: 'https://x/y', ...extra }) as StreamLink
const art = (extra: Partial<StreamLink>) => streamStatus(titel, weg(extra), [])
const text = (k: string) => TEXTE_ZEILEN[k as keyof typeof TEXTE_ZEILEN] ?? k

console.log('\nPille je Wert von dubAbgeleitet:')
pruefe('joyn-pauschal: laut Anbieter', art({ dub: true, dubAbgeleitet: 'joyn-pauschal' }) === 'anbieter')
pruefe('kanal-erbt (Prime-Kanal, mit Bereichen): laut Anbieter', art({ platform: 'primevideo', dub: true, dubAbgeleitet: 'kanal-erbt', dubRanges: [{ from: 1, to: 3, dub: true }] }) === 'anbieter')
pruefe('kanal-erbt ohne Bereiche: laut Anbieter', art({ platform: 'primevideo', dub: true, dubAbgeleitet: 'kanal-erbt' }) === 'anbieter')
pruefe('gemessenes Ja ohne Kennzeichen bleibt „✓ Deutsch“', art({ dub: true }) === 'belegt')
pruefe('Handbeleg an Joyn (dub true, ohne Kennzeichen) bleibt „✓ Deutsch“', art({ dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }) === 'belegt')

console.log('\nNichtauskunft und Nein zeigen nie „laut Anbieter“:')
pruefe('dub false mit Kennzeichen: keine Anbieter-Pille', art({ dub: false, dubAbgeleitet: 'joyn-pauschal' }) !== 'anbieter')
pruefe('ohne dub mit Kennzeichen: keine Anbieter-Pille', art({ dubAbgeleitet: 'kanal-erbt' }) !== 'anbieter')
pruefe('JustWatch-Ton (dubQuelle) ohne dub bleibt JustWatch', art({ dubQuelle: 'justwatch', dubStand: '2026-10-01', dubHintOnly: true }) === 'justwatch')

console.log('\nText:')
const legende = legendeFuer(['anbieter'], false, text)
pruefe('Blase: „Deutsch laut Anbieter“', text('detail.statusAnbieter') === 'Deutsch laut Anbieter')
pruefe('Legende erklärt „Deutsch laut Anbieter“', legende?.includes('Deutsch laut Anbieter') === true, legende)
pruefe('belegt braucht keine Legende (Gegenprobe)', legendeFuer(['belegt'], false, text) === undefined)

console.log('\nPanel (Renderfall, Titel 163132 Horimiya: zwei Prime-Streams, einer kanal-erbt, einer gemessen):')
const prime = (adresse: string, extra: Partial<StreamLink>): StreamLink =>
  ({ platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/${adresse}`, dub: true, zugang: 'abo', kanal: 'Crunchyroll', ...extra }) as StreamLink
const joyn = weg({ url: 'https://www.joyn.de/serien/x', dub: true, zugang: 'kostenlos', dubAbgeleitet: 'joyn-pauschal' })
const abgeleitet = prime('B0CG8SW2YQ', { dubAbgeleitet: 'kanal-erbt' })
const gemessen = prime('B0CJJG6LNR', {})
const titelMit = (streams: StreamLink[]): Title => ({ id: 900002, slug: 'y', format: 'TV', episodes: 13, streams, watchLinks: [] }) as unknown as Title
const sortiertVon = (streams: StreamLink[]) => sortiereNachZugang({ title: titelMit(streams) })

function markup(streams: StreamLink[]): string {
  const zeilen = streamZeilen({
    sortiertNachZugang: sortiertVon(streams),
    title: titelMit(streams),
    t: ((k: string) => k) as never,
    today: '2026-10-13',
    folgenAngabeFuer: () => '',
    dubZeilen: () => [],
    releaseJePlattform: new Map(),
    streamReleases: [],
    releases: [],
    tvVorbei: [],
  })
  return renderToStaticMarkup(createElement(Fragment, null, ...zeilen))
}
const gefuellt = (streams: StreamLink[]) => `${markup(streams)}`
const nurAbgeleitet = gefuellt([abgeleitet])
const nurJoyn = gefuellt([joyn])
const nurGemessen = gefuellt([gemessen])
pruefe('kanal-erbt: Blase „Deutsch laut Anbieter“, nicht „✓ Deutsch“', nurAbgeleitet.includes('Deutsch laut Anbieter') && !nurAbgeleitet.includes('✓ Deutsch'), nurAbgeleitet.slice(0, 300))
pruefe('joyn-pauschal: Blase „Deutsch laut Anbieter“, nicht „✓ Deutsch“', nurJoyn.includes('Deutsch laut Anbieter') && !nurJoyn.includes('✓ Deutsch'), nurJoyn.slice(0, 300))
pruefe('Blase des Anbieters ist grau (bg-[#475569]), nicht grün', nurAbgeleitet.includes('bg-[#475569]') && !nurAbgeleitet.includes('bg-ak-gut'), nurAbgeleitet.slice(0, 300))
pruefe('gemessener Stream bleibt „Deutsch“ in Grün (Gegenprobe)', nurGemessen.includes('✓ Deutsch') && nurGemessen.includes('bg-ak-gut') && !nurGemessen.includes('Deutsch laut Anbieter'), nurGemessen.slice(0, 300))
const beide = sortiertVon([abgeleitet, gemessen]).flatMap((x) => x.plattformen)
pruefe('Horimiya: abgeleiteter und gemessener Prime-Weg bleiben beide Pillen', beide.length === 2 && beide.some((s) => !s.dubAbgeleitet), beide)
pruefe('Horimiya, gemessener zuerst: ebenso beide Pillen', sortiertVon([gemessen, abgeleitet]).flatMap((x) => x.plattformen).length === 2)
const horimiya = markup([abgeleitet, gemessen])
pruefe('Horimiya: die Zeile zeigt auch „✓ Deutsch“ des gemessenen Wegs', horimiya.includes('✓ Deutsch') && horimiya.includes('Deutsch laut Anbieter'), horimiya.slice(0, 300))
const teil = (von: number, bis: number, extra: Partial<StreamLink>): StreamLink => ({ ...prime('B0TEILWEG', extra), teilBereich: { von, bis } })
pruefe('Teilwege: anschließend, aber einer abgeleitet, einer gemessen: nicht zu einer Pille gefaltet', falteTeilwege([teil(1, 6, { dubAbgeleitet: 'kanal-erbt' }), teil(7, 12, {})]).length === 2)
pruefe('Teilwege: anschließend und beide gemessen: eine Pille (Gegenprobe)', falteTeilwege([teil(1, 6, {}), teil(7, 12, {})]).length === 1)
const mitAnbieter = { sortiert: sortiertVon([abgeleitet]), title: titelMit([abgeleitet]) }
const legendeKasten = legendeDerZeilen({ ...mitAnbieter, releases: [], folgenAngabeFuer: () => '', t: ((k: string) => text(k)) as never })
pruefe('legendeDerZeilen mit Anbieter-Stream nennt die Legende', legendeKasten?.includes('Deutsch laut Anbieter') === true, legendeKasten)
const gruppen = zeilenGruppen(mitAnbieter.sortiert, mitAnbieter.title, [])
pruefe('zeilenGruppen: der Anbieter-Stream bleibt unter „Auf Deutsch“ (nicht offen)', gruppen.length === 1 && gruppen[0][1] === 'abo' && gruppen[0][0] === pillenSchluessel(abgeleitet), gruppen)

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ Pille „Deutsch laut Anbieter“: 22 Zusicherungen ok')
