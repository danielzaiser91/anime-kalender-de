/**
 * Zusicherungen zur Pille „Deutsch laut Anbieter“: Ein Weg, dessen Ja der Bau ableitet (`dubAbgeleitet`: Joyn pauschal,
 * Prime-Kanal erbt), zeigt nicht „✓ Deutsch“ wie ein gemessener. Aufruf: `npm run check:logic`.
 */
import type { StreamLink, Title } from '../shared/types.ts'
import { streamStatus } from '../web/src/components/detail/legende-zeilen.ts'
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

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ Pille „Deutsch laut Anbieter“: 11 Zusicherungen ok')
