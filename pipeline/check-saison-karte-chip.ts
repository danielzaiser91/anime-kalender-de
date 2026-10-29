/**
 * Lässt die echte `SaisonKarte.tsx` laufen (react-dom/client auf dem Mini-DOM aus `tools/mini-dom.ts`):
 * ein Anbieter-Chip aus nur abgeleitetem Weg trägt gestrichelten Rand und die Zeile „<Anbieter>: Deutsch laut Anbieter“,
 * ein belegter Chip weder noch; Mischfall nennt nur den abgeleiteten Anbieter. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Dataset } from '../web/src/lib/data.ts'
import type { SaisonZeile } from '../web/src/lib/saison.ts'
import type { Release, Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { SaisonKarte } = await import('../web/src/components/SaisonKarte.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const bild = () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() })
const klassen = (k: MiniKnoten) => k.getAttribute('class') ?? ''

const zeileMitWegen = (streams: object[]): SaisonZeile => ({ id: 900700, titel: { id: 900700, titleEn: 'Testtitel', streams } as unknown as Title, deutsch: true, stufe: 'bestaetigt', erschienen: true })

async function zeige(z: SaisonZeile, releases: Release[] = []): Promise<{ chips: MiniKnoten[]; text: string; abbau: () => Promise<void> }> {
  const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, bild)
  const data = { releasesByTitle: new Map([[900700, releases]]) } as unknown as Dataset
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(h(SaisonKarte, { z, data, favorit: false, oeffne: () => undefined }))
  })
  const chips = dom.wurzel.finde((k) => k.tagName === 'SPAN' && k.getAttribute('data-anbieter-chip') !== null)
  const abbau = async () => {
    await act(async () => wurzel.unmount())
    dom.entferne()
  }
  return { chips, text: dom.wurzel.textContent, abbau }
}

const joyn = { platform: 'joyn', dub: true, dubAbgeleitet: 'joyn-pauschal' }
const netflix = { platform: 'netflix', dub: true }

console.log('SaisonKarte.tsx: Anbieter-Chip „laut Anbieter“ läuft wirklich')
{
  const k = await zeige(zeileMitWegen([joyn]))
  pruefe('abgeleitet: ein Chip „Joyn“, gestrichelt', k.chips.length === 1 && k.chips[0]!.textContent === 'Joyn' && klassen(k.chips[0]!).includes('border-dashed'), k.chips.map(klassen))
  pruefe('abgeleitet: Zeile „Joyn: Deutsch laut Anbieter“', k.text.includes('Joyn: Deutsch laut Anbieter'), k.text)
  await k.abbau()
}
{
  const k = await zeige(zeileMitWegen([netflix]))
  pruefe('belegt: Chip „Netflix“ ohne Strich', k.chips.length === 1 && k.chips[0]!.textContent === 'Netflix' && !klassen(k.chips[0]!).includes('border-dashed'), k.chips.map(klassen))
  pruefe('belegt: keine Zeile „laut Anbieter“', !k.text.includes('laut Anbieter'), k.text)
  await k.abbau()
}
{
  const k = await zeige(zeileMitWegen([netflix, joyn]))
  const strich = k.chips.filter((c) => klassen(c).includes('border-dashed')).map((c) => c.textContent)
  pruefe('gemischt: nur Joyn gestrichelt', strich.length === 1 && strich[0] === 'Joyn' && k.chips.length === 2, strich)
  pruefe('gemischt: Zeile nennt nur Joyn', k.text.includes('Joyn: Deutsch laut Anbieter') && !k.text.includes('Netflix, ') && !k.text.includes(', Joyn:'), k.text)
  await k.abbau()
}
{
  const katalog: SaisonZeile = { id: 900701, katalog: { id: 900701, titleEn: 'Katalogtitel', anbieter: ['joyn'] }, deutsch: false, stufe: 'angekuendigt', erschienen: false }
  const k = await zeige(katalog)
  pruefe('Katalogtitel (Ausblick): Chip „Joyn“ ohne Strich und ohne Zeile', k.chips.length === 1 && !klassen(k.chips[0]!).includes('border-dashed') && !k.text.includes('laut Anbieter'), k.text)
  await k.abbau()
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nSaisonKarte (Anbieter-Chip): abgeleitet gestrichelt mit Zeile, belegt ohne, gemischt nur der abgeleitete')
