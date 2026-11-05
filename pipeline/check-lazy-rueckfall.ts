/**
 * Zusicherungen (05.11.2026): Löst das Nachlade-Paket mit `undefined` auf (Folge von `vite:preloadError` mit preventDefault in
 * `aktualisierung.ts`) oder lehnt es ab, zeigt der Wrapper den Rückfall mit Neuladen-Knopf statt den Baum abzuräumen; ein
 * gutes Paket wird normal gezeigt. Jede `*Lazy.tsx` nimmt den Helfer, kein Wrapper ruft `lazy` selbst. Aufruf: npx tsx pipeline/check-lazy-rueckfall.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, createElement as h, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, ignoriereCss, installiereMiniDom } from '../tools/mini-dom.ts'
ignoriereCss()
const { lazyMitRueckfall } = await import('../web/src/components/lazy-mit-rueckfall.tsx')

let verletzt = 0
let gezaehlt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gezaehlt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Rendert einen Wrapper um das Paket und liefert Text und Zahl der Knöpfe; ein Wurf kommt als Text „WURF“ zurück. */
async function zeige(laden: () => Promise<unknown>): Promise<{ text: string; knoepfe: number }> {
  const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
  const Teil = lazyMitRueckfall<{ wort: string }>(laden, (m) => m.Gut)
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  const fehler = console.error
  let geworfen = false
  console.error = () => {}
  try {
    await act(async () => {
      wurzel.render(h(Suspense, { fallback: null }, h(Teil, { wort: 'Probe-Inhalt' })))
    })
    await act(async () => {
      await Promise.resolve()
    })
  } catch {
    geworfen = true
  }
  console.error = fehler
  const text = geworfen ? 'WURF' : (dom.wurzel.textContent ?? '').replace(/\s+/g, ' ')
  const knoepfe = geworfen ? 0 : dom.wurzel.finde((k) => k.tagName?.toLowerCase() === 'button').length
  await act(async () => wurzel.unmount())
  dom.entferne()
  return { text, knoepfe }
}

const Gut = ({ wort }: { wort: string }) => h('p', null, wort)
const gut = await zeige(() => Promise.resolve({ Gut }))
pruefe('Paket da: der Inhalt erscheint, kein Rückfall', gut.text.includes('Probe-Inhalt') && gut.knoepfe === 0, gut)

const leer = await zeige(() => Promise.resolve(undefined))
pruefe('import() löst mit undefined auf: kein Wurf, Rückfall mit Neuladen-Knopf', leer.text.includes('nicht geladen werden') && leer.knoepfe === 1, leer)

const abgelehnt = await zeige(() => Promise.reject(new Error('Chunk fehlt')))
pruefe('import() lehnt ab: kein Wurf, Rückfall mit Neuladen-Knopf', abgelehnt.text.includes('nicht geladen werden') && abgelehnt.knoepfe === 1, abgelehnt)

/* Verdrahtung: alle Wrapper nehmen den Helfer, keiner `lazy` aus React. */
const ordner = join(import.meta.dirname, '../web/src/components')
const dateien = [...readdirSync(ordner), ...readdirSync(join(ordner, 'kalender')).map((d) => join('kalender', d))].filter((d) => d.endsWith('Lazy.tsx'))
pruefe('alle sieben Lazy-Wrapper gefunden', dateien.length === 7, dateien)
for (const d of dateien) {
  const quelle = readFileSync(join(ordner, d), 'utf8')
  const eigenesLazy = /import\s*\{[^}]*\blazy\b[^}]*\}\s*from\s*'react'/.test(quelle)
  pruefe(`${d}: Helfer statt eigenem lazy`, /\blazyMitRueckfall\s*[<(]/.test(quelle) && !eigenesLazy, d)
}

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-lazy-rueckfall: ${gezaehlt} Zusicherungen erfüllt (Paket da, undefined, abgelehnt, sieben Wrapper am Helfer)`)
