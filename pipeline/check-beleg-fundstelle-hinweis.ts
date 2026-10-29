/**
 * Das Beleg-Fenster darf ein Bild ohne Marke nicht wie einen Ausschnitt zeigen (Rayearth, 29.10.2026: Sammelartikel, Bild von oben, Titel nicht darauf).
 * Lässt die echte `BelegAnsicht` aus `beleg-dialog.tsx` laufen (Mini-DOM, Attrappe-Worker); der Beleg ist der von Rayearth wörtlich aus `news.json` (ohne `markierung`).
 * Aufruf: npx tsx pipeline/check-beleg-fundstelle-hinweis.ts   (Exit 1 bei Verstoß)
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { NewsBeleg, NewsEintrag } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { BelegAnsicht } = await import('../web/src/components/beleg-dialog.tsx')
const { merkeSammelartikel, istSammelartikel } = await import('../web/src/lib/sammel-belege.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HINWEIS = 'Auf dem Bild ist keine Stelle markiert.'
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
const EINZEL: NewsBeleg = { ...RAYEARTH, url: 'https://www.joyn.de/serien/ein-titel', name: 'Joyn' }

function eintrag(titelId: number, belege: NewsBeleg[]): NewsEintrag {
  return { am: '2026-09-15', titelId, titel: `T${titelId}`, slug: `t${titelId}`, meldungen: [{ art: 'angekuendigt', belege }] } as unknown as NewsEintrag
}
merkeSammelartikel([eintrag(178868, [RAYEARTH, EINZEL]), eintrag(900001, [RAYEARTH])])

type Antwort = 'ok' | 'nichtGefunden' | 'netz' | 'offen'
function klassenVonText(k: MiniKnoten, text: string): string | undefined {
  if (k.nodeType === 1 && k.childNodes.some((c) => c.nodeType === 3 && c.data === text)) return k.attribute.get('class') ?? ''
  for (const c of k.childNodes) {
    const r = klassenVonText(c, text)
    if (r !== undefined) return r
  }
  return undefined
}

async function zeige(beleg: NewsBeleg, antwort: Antwort, worker = 'https://worker.test'): Promise<{ text: string; klassen?: string; abgerufen: boolean }> {
  const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
  let abgerufen = false
  const g = globalThis as unknown as Record<string, unknown>
  g.fetch = async () => {
    abgerufen = true
    if (antwort === 'netz') throw new TypeError('offline')
    if (antwort === 'offen') return new Promise(() => undefined)
    return antwort === 'nichtGefunden' ? { ok: false, status: 404 } : { ok: true, status: 200, blob: async () => ({}) }
  }
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => undefined
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(BelegAnsicht, { beleg, zu: () => undefined, worker })))
  const text = dom.wurzel.textContent
  const klassen = klassenVonText(dom.wurzel as unknown as MiniKnoten, HINWEIS)
  await act(async () => wurzel.unmount())
  dom.entferne()
  return { text, klassen, abgerufen }
}

console.log('Beleg-Fenster: Bild ohne Marke im Sammelartikel sagt es')
pruefe('Zählung: Rayearth-Adresse steht bei zwei Titeln, Joyn nur bei einem', istSammelartikel(RAYEARTH.url) && !istSammelartikel(EINZEL.url))
const sammel = await zeige(RAYEARTH, 'ok')
pruefe('Sammelartikel, Bild geladen, keine Marke: Hinweis steht da', sammel.text.includes(HINWEIS), sammel.text)
pruefe('Hinweis steht in eigener Zeile außerhalb der zwei Zeilen Kürzung (Handy)', sammel.klassen !== undefined && !sammel.klassen.includes('line-clamp'), sammel.klassen)
pruefe('alter Wortlaut ist weg', !sammel.text.includes('Fundstelle markiert'), sammel.text)
const mit = await zeige(MIT_MARKE, 'ok')
pruefe('mit Marke: kein Hinweis', !mit.text.includes(HINWEIS), mit.text)
const einzel = await zeige(EINZEL, 'ok')
pruefe('Einzeltitel-Seite ohne Marke: kein Hinweis', !einzel.text.includes(HINWEIS), einzel.text)
const ohneWorker = await zeige(RAYEARTH, 'ok', '')
pruefe('ohne Worker (kein Bild): kein Hinweis, kein Abruf', !ohneWorker.text.includes(HINWEIS) && !ohneWorker.abgerufen, ohneWorker.text)
const nichtDa = await zeige(RAYEARTH, 'nichtGefunden')
pruefe('Bild nicht gefunden (404): kein Hinweis', nichtDa.abgerufen && !nichtDa.text.includes(HINWEIS), nichtDa.text)
const netz = await zeige(RAYEARTH, 'netz')
pruefe('Bild nicht erreichbar (Netzfehler): kein Hinweis', netz.abgerufen && !netz.text.includes(HINWEIS), netz.text)
const laedt = await zeige(RAYEARTH, 'offen')
pruefe('Bild lädt noch: kein Hinweis', laedt.abgerufen && !laedt.text.includes(HINWEIS), laedt.text)

console.log(verletzt ? `✖ ${verletzt} Verstöße` : '✔ Beleg-Fundstelle: Sammelartikel-Bild ohne Marke trägt den Hinweis, sonst nie')
process.exit(verletzt ? 1 : 0)
