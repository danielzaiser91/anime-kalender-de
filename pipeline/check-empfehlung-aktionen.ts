/**
 * Zusicherung zu den Knöpfen unter den Vorschlägen: „Schon gesehen“ ist als Haken nicht selbsterklärend und behält seinen sichtbaren Text
 * in jeder Lage (auch in der Laptop-Reihe). Das echte Markup von `Vorschlaege.tsx` wird gerendert, `empfehlung.css` in Regeln zerlegt;
 * keine Regel, die versteckt, darf eine Klasse des Textes oder den Knopf selbst treffen. Aufruf: `npm run check:logic`.
 */
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import type { Kandidat } from '../shared/empfehlung-pool.ts'

const g = globalThis as Record<string, unknown>
g.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { ignoriereCss } = await import('../tools/mini-dom.ts')
ignoriereCss()
const { Vorschlaege } = await import('../web/src/components/empfehlung/Vorschlaege.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

interface Regel { selektor: string; versteckt: boolean }

/** Zerlegt CSS in Regeln (verschachtelte `@media` werden durchlaufen); `versteckt`: `display: none` oder `visibility: hidden`. */
function regeln(css: string): Regel[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const aus: Regel[] = []
  let kopf = ''
  const stapel: boolean[] = []
  for (let i = 0; i < text.length; i++) {
    const z = text[i]
    if (z === '{') {
      const k = kopf.trim()
      stapel.push(k.startsWith('@'))
      kopf = ''
      if (!stapel[stapel.length - 1]) {
        const ende = text.indexOf('}', i)
        const koerper = text.slice(i + 1, ende).replace(/\s+/g, '')
        aus.push({ selektor: k, versteckt: koerper.includes('display:none') || koerper.includes('visibility:hidden') })
        stapel.pop()
        i = ende
      }
    } else if (z === '}') {
      stapel.pop()
      kopf = ''
    } else kopf += z
  }
  return aus
}

const kandidat: Kandidat = { id: 900901, n: 'Testserie', f: 'TV', y: 2020, e: 12, g: [], k: [], fsk: 12, v: 70, p: [['netflix']], duell: true }
const kontext = { datei: { einstiege: [kandidat] }, index: new Map([[900901, 0]]) } as unknown as Parameters<typeof Vorschlaege>[0]['kontext']
const nichts = () => {}
const html = renderToStaticMarkup(h(Vorschlaege, {
  kontext,
  gezeigt: [900901],
  favoriten: new Set<number>(),
  stand: { gesamt: 10, rest: 5 } as never,
  vonVorn: nichts,
  aktionen: { favorit: nichts, gesehen: nichts, nein: nichts, oeffne: nichts },
  ablage: { gesehen: [], verworfen: [], zurueckholen: nichts, alleZurueck: nichts } as never,
}))

const knopf = html.match(/<button[^>]*aria-label="Schon gesehen"[^>]*>(.*?)<\/button>/)?.[1] ?? ''
const textKlassen = (knopf.match(/<span class="([^"]*)">Schon gesehen<\/span>/)?.[1] ?? '').split(' ').filter(Boolean)
pruefe('der Gesehen-Knopf trägt sichtbaren Text „Schon gesehen“ in einem eigenen span', textKlassen.length > 0, knopf)
pruefe('der Text trägt nicht die Klasse empf-aktion-text (die versteckt ihn in der Symbolreihe)', !textKlassen.includes('empf-aktion-text'), textKlassen)

const css = regeln(readFileSync(new URL('../web/src/components/empfehlung/empfehlung.css', import.meta.url), 'utf8'))
pruefe('empfehlung.css wird gelesen (Regeln gefunden)', css.length > 10 && css.some((r) => r.selektor.includes('.empf-aktion-text') && r.versteckt), css.length)
const treffer = css.filter((r) => r.versteckt && (r.selektor.includes('.empf-aktionen button') || textKlassen.some((c) => r.selektor.includes(`.${c}`)))).map((r) => r.selektor)
pruefe('keine Regel versteckt den Gesehen-Text oder die Knöpfe der Reihe', treffer.length === 0, treffer)

console.log(`empfehlung-aktionen: ${verletzt === 0 ? 'alle Zusicherungen erfüllt' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
