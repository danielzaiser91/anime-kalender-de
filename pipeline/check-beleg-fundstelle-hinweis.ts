/**
 * Das Beleg-Fenster darf ein Bild ohne Marke nicht wie einen Ausschnitt zeigen (Rayearth, 29.10.2026: Sammelartikel, Bild von oben, Titel nicht darauf).
 * Lässt die echte `Erklaerung` aus `beleg-dialog.tsx` laufen (Mini-DOM); der Beleg ist der von Rayearth wörtlich aus `news.json` (ohne `markierung`).
 * Aufruf: npx tsx pipeline/check-beleg-fundstelle-hinweis.ts   (Exit 1 bei Verstoß)
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { NewsBeleg } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom } from '../tools/mini-dom.ts'
ignoriereCss()
const { Erklaerung, fundstellenHinweis } = await import('../web/src/components/beleg-dialog.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const RAYEARTH: NewsBeleg = {
  url: 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-deutsche-synchros-herbst-2026',
  name: 'Crunchyroll News',
  erstGeprueftAm: '2026-10-05',
  zuletztGeprueftAm: '2026-10-23',
  bildAm: '2026-10-23',
  bild: 'www.crunchyroll.com/c6ad766905564915/2026-10-23-5f0c54e1191716f2.webp',
  veroeffentlichtAm: '2026-09-15',
}
const MIT_MARKE: NewsBeleg = { ...RAYEARTH, markierung: [0.048, 0.639, 0.904, 0.033] }

async function text(beleg: NewsBeleg, mitBild: boolean): Promise<string> {
  const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(Erklaerung, { beleg, mitBild })))
  const t = dom.wurzel.textContent
  await act(async () => wurzel.unmount())
  dom.entferne()
  return t
}

console.log('Beleg-Fenster: Bild ohne Marke sagt es')
const ohne = await text(RAYEARTH, true)
pruefe('Rayearth (Bild, keine Marke): Hinweis steht im Fenster', ohne.includes('keine Fundstelle markiert'), ohne)
const mit = await text(MIT_MARKE, true)
pruefe('mit Marke: kein Hinweis', !mit.includes('Fundstelle markiert'), mit)
const ohneBild = await text(RAYEARTH, false)
pruefe('ohne Bild (Worker aus): kein Hinweis', !ohneBild.includes('Fundstelle markiert'), ohneBild)
pruefe('fundstellenHinweis: Bild und Marke ergeben leer, Bild ohne Marke nicht', fundstellenHinweis(MIT_MARKE, true) === '' && fundstellenHinweis(RAYEARTH, true) !== '')

console.log(verletzt ? `✖ ${verletzt} Verstöße` : '✔ Beleg-Fundstelle: Bild ohne Marke trägt den Hinweis, mit Marke nicht')
process.exit(verletzt ? 1 : 0)
