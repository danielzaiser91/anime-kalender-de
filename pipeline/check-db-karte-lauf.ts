/**
 * Lässt die echte `DbKarte` laufen (react-dom/client auf dem Mini-DOM aus `tools/mini-dom.ts`): Ein Klick auf die Kachel einer
 * Staffel öffnet `titelId`, nicht den Vertreter der Reihe; die Pille nennt „Staffel N · ab TT.MM.". Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Release, Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { DbKarte } = await import('../web/src/components/db-karte.tsx')
const { DbRaster } = await import('../web/src/components/db-bedienung.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
const wurzel = createRoot(dom.wurzel as unknown as Element)

// Staffel 1 ist der Vertreter der Reihe (main), die Kachel meint Staffel 2.
const staffel1 = { id: 158559, titleDe: '2.5 Dimensional Seduction', jpYear: 2024, format: 'TV', streams: [] } as unknown as Title
const staffel2 = { id: 185515, titleDe: '2.5 Dimensional Seduction', format: 'TV', streams: [] } as unknown as Title
const data = { releasesByTitle: new Map<number, Release[]>() } as never

/** Die Eigenschaften, die jede Kachel braucht; `onOpenTitle` schreibt die geöffnete Kennung in `geoeffnet`. */
const gemeinsam = (geoeffnet: number[]) => ({
  data,
  today: '2026-10-28',
  grouped: true,
  favorites: new Set<number>(),
  hidden: new Set<number>(),
  onToggleFavorite() {},
  onToggleHidden() {},
  onOpenTitle: (id: number) => void geoeffnet.push(id),
  share: () => Promise.resolve(),
  copiedSlug: undefined,
})

async function zeige(extra: { titelId?: number; staffel?: string; gruppe?: 'bald' | 'laeuft'; ab?: string }) {
  const geoeffnet: number[] = []
  const props = { main: staffel1, members: [staffel1], ...gemeinsam(geoeffnet), ...extra }
  await act(async () => wurzel.render(h(DbKarte, props)))
  return geoeffnet
}
const knoepfe = (k: MiniKnoten) => k.finde((x) => x.tagName === 'BUTTON' && (x.getAttribute('class') ?? '').includes('ak-oeffnen'))[0]!
const karte = () => dom.wurzel.finde((x) => (x.getAttribute('class') ?? '').includes('cursor-pointer'))[0]!
const text = () => dom.wurzel.textContent

console.log('\nDbKarte läuft wirklich: Klick öffnet die Staffel der Kachel')
{
  const offen = await zeige({ titelId: staffel2.id, staffel: 'Staffel 2', gruppe: 'bald', ab: '2026-10-30' })
  await act(async () => klicke(dom.wurzel, karte()))
  pruefe('Klick auf die Kachel öffnet titelId (185515), nicht main (158559)', offen.length === 1 && offen[0] === 185515, offen)
  await act(async () => klicke(dom.wurzel, knoepfe(dom.wurzel)))
  pruefe('Tastatur-Knopf (sr-only) öffnet ebenfalls titelId', offen.length === 2 && offen[1] === 185515, offen)
  pruefe('Pille nennt „Staffel 2 · ab 30.10."', text().includes('Staffel 2 · ab 30.10.'), text())
}
{
  const offen = await zeige({})
  await act(async () => klicke(dom.wurzel, karte()))
  pruefe('ohne titelId (Suche, A–Z) öffnet die Kachel main', offen.length === 1 && offen[0] === 158559, offen)
}
{
  await zeige({ titelId: staffel2.id, staffel: 'Staffel 2', gruppe: 'laeuft' })
  pruefe('„Läuft jetzt": „Staffel 2" steht ohne Datum auf der Kachel', text().includes('Staffel 2') && !text().includes('ab '), text())
  await zeige({ gruppe: 'bald', ab: '2026-10-30' })
  pruefe('Reihe mit einer Staffel: nur „ab 30.10.", kein „Staffel"-Zusatz', text().includes('ab 30.10.') && !text().includes('· ab'), text())
  await zeige({ gruppe: 'bald' })
  pruefe('„Demnächst" ohne Startdatum: keine Pille, kein Absturz', !text().includes('ab '), text())
}
console.log('\nDbRaster läuft wirklich: titelId und Staffelmarke kommen aus der Liste auf die Kachel')
{
  const geoeffnet: number[] = []
  const rest = gemeinsam(geoeffnet)
  const liste = [{ main: staffel1, members: [staffel1], art: 'bald' as const, ab: '2026-10-30', titelId: staffel2.id, staffel: 'Staffel 2' }]
  await act(async () => wurzel.render(h(DbRaster, { liste, zahlen: { bald: 1 }, ...rest })))
  await act(async () => klicke(dom.wurzel, karte()))
  pruefe('Raster: Klick öffnet titelId aus der Liste', geoeffnet.length === 1 && geoeffnet[0] === 185515, geoeffnet)
  pruefe('Raster: Pille „Staffel 2 · ab 30.10." steht auf der Kachel', text().includes('Staffel 2 · ab 30.10.'), text())
}
await act(async () => wurzel.unmount())
dom.entferne()

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nDbKarte: alles in Ordnung.')
