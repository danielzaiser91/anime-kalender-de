/**
 * Lässt den echten Hook `useSprungZuHeute` (react-dom/client auf dem Mini-DOM aus `tools/mini-dom.ts`) mit der Lesestelle laufen:
 * ohne Lesestelle springt er weich zu „heute“; mit Lesestelle (Tag schon da oder erst nach dem Zeichnen) setzt `lesestelle.ts` sofort
 * zurück und der weiche Sprung entfällt. Belegt die Verdrahtung `woche-sprung.ts` → `lesestelle.ts`. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { SCHLUESSEL } from '../web/src/lib/lesestelle.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom } from '../tools/mini-dom.ts'
ignoriereCss()
const { useSprungZuHeute } = await import('../web/src/lib/woche-sprung.ts')

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const g = globalThis as unknown as Record<string, unknown>
const TAG = '2026-10-28'
const KOPF = 56

/** Eine Seite: Tag liegt bei `top` 300, Kopfleiste 56 hoch; `gespeichert` ist die Lesestelle aus dem letzten Start (oder keine). */
async function lauf(gespeichert: boolean, tagSchonDa: boolean) {
  const uhr = attrappeUhr()
  const scrolls: ScrollToOptions[] = []
  const fenster = {
    ...uhr,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    scrollTo: (o: ScrollToOptions) => void scrolls.push(o),
    scrollY: 0,
  }
  const dom = installiereMiniDom(fenster as never, () => ({}))
  let tagDa = tagSchonDa
  const tagEl: Record<string, unknown> = {
    dataset: { datum: TAG },
    getBoundingClientRect: () => ({ top: 300, bottom: 800, height: 500 }),
    querySelector: () => null,
    contains: () => false,
  }
  tagEl.closest = () => tagEl
  Object.assign(document, {
    hidden: false,
    querySelector: (sel: string) => {
      if (sel === 'header') return { getBoundingClientRect: () => ({ height: KOPF }) }
      return tagDa && (sel.startsWith('section[data-datum') || sel === '[data-heute="1"]') ? tagEl : null
    },
    querySelectorAll: () => (tagDa ? [tagEl] : []),
  })
  const speicher = new Map<string, string>()
  if (gespeichert) speicher.set(SCHLUESSEL, JSON.stringify({ datum: TAG, abstand: 44, ort: '/#/', zeit: performance.timeOrigin + performance.now() }))
  g.sessionStorage = { getItem: (k: string) => speicher.get(k) ?? null, setItem: () => undefined, removeItem: (k: string) => void speicher.delete(k) }
  g.location = { pathname: '/', hash: '#/' }
  let beobachter: (() => void) | undefined
  g.MutationObserver = class {
    constructor(f: () => void) {
      beobachter = f
    }
    observe() {}
    disconnect() {}
  }
  function Probe() {
    useSprungZuHeute({ days: [{ date: TAG, timed: [], untimed: [] }], today: TAG, monday: '2026-10-26' })
    return null
  }
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(h(Probe))
  })
  return {
    scrolls,
    erscheint: async () => {
      tagDa = true
      await act(async () => beobachter?.())
    },
    nachlauf: () => uhr.schiebe(10_000, (f) => act(async () => f())),
    ende: async () => {
      await act(async () => wurzel.unmount())
      dom.entferne()
    },
  }
}

{
  const k = await lauf(false, true)
  pruefe('ohne Lesestelle: ein weicher Sprung zu „heute“ (Kontrolle)', k.scrolls.length === 1 && k.scrolls[0].behavior === 'smooth', k.scrolls)
  await k.ende()
}
{
  const k = await lauf(true, true)
  pruefe('mit Lesestelle, Tag da: genau ein Scroll, sofort, kein weicher Sprung', k.scrolls.length === 1 && k.scrolls[0].behavior === 'auto' && k.scrolls[0].top === 300 - KOPF - 44, k.scrolls)
  await k.nachlauf()
  pruefe('…auch nach dem Nachlauf kein weicher Sprung', k.scrolls.length === 1, k.scrolls)
  await k.ende()
}
{
  const k = await lauf(true, false)
  pruefe('mit Lesestelle, Tag noch nicht gezeichnet: bisher kein Scroll', k.scrolls.length === 0, k.scrolls)
  await k.erscheint()
  pruefe('…erscheint der Tag, genau ein sofortiger Scroll, kein weicher', k.scrolls.length === 1 && k.scrolls[0].behavior === 'auto', k.scrolls)
  await k.ende()
}

if (verletzt > 0) {
  console.error(`✖ ${verletzt} Fehler`)
  process.exit(1)
}
console.log(`✔ sprung-lesestelle: Hook mit und ohne Lesestelle (Kontrolle weicher Sprung, Tag da, Tag später; ${faelle} Fälle)`)
process.exit(0)
