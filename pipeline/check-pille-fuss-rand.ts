/**
 * Zusicherung zur Pille mit Fußzeile (`fuss`, z. B. TV-Karte mit Programm-Link; 20.11.2026): Das Kind (`<a>`) malt beim Hover
 * einen eigenen Hintergrund. Liegen Ring und Markenstreifen als inset-Schatten auf dem Außen-div, deckt er sie ab.
 * Sie müssen daher auf einem Overlay (`after:`) über den Kindern liegen. Aufruf: `npm run check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Pille } from '../web/src/components/detail/pille.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function aussenKlassen(farbe?: string): string {
  const html = renderToStaticMarkup(createElement(Pille, { name: 'TOGGO plus', farbe, url: 'https://x/p', fuss: createElement('span', null, 'Knopf') }))
  const m = /^<div[^>]*class="([^"]*)"/.exec(html)
  return m ? m[1].replaceAll('&#x27;', "'") : ''
}

console.log('\nPille mit Fußzeile: Ring und Streifen über dem Hover-Hintergrund des Kinds:')
for (const farbe of ['#f97316', undefined]) {
  const k = aussenKlassen(farbe).split(/\s+/)
  const art = farbe ? 'mit Marke' : 'ohne Marke'
  pruefe(`${art}: kein inset-Schatten direkt am Außen-div`, !k.some((c) => c.startsWith('shadow-[') || c.startsWith('dark:shadow-[')), k)
  pruefe(`${art}: Ring hell und dunkel auf dem Overlay`, k.some((c) => c.startsWith('after:shadow-[inset_0_0_0_1px')) && k.some((c) => c.startsWith('dark:after:shadow-[inset_0_0_0_1px')))
  pruefe(`${art}: Overlay deckt die Fläche und fängt keine Klicks`, ['after:absolute', 'after:inset-0', 'after:pointer-events-none', "after:content-['']"].every((c) => k.includes(c)), k)
  pruefe(`${art}: Streifen nur mit Marke`, k.some((c) => c.includes('inset_3px_0_0_var(--marke)')) === Boolean(farbe))
}
if (verletzt) process.exit(1)
console.log('Pille mit Fußzeile: 8 Zusicherungen erfüllt')
