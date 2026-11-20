/**
 * Zusicherung (Daniel, 20.11.2026): Im Detail-Panel steht die Handlung über der Reihe.
 * Gerendert wird `UnterDerAntwort`, der Ort, der beide Blöcke ordnet; Marker statt echter Blöcke.
 * Aufruf: `npm run check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Title } from '../shared/types.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { UnterDerAntwort } from '../web/src/components/detail/unter-der-antwort.tsx'

const titel = { id: 900102, slug: 'x', format: 'TV', jpYear: 2025, hasVoices: true, streams: [], watchLinks: [], titleDe: 'Probe' } as unknown as Title
const marker = (name: string) => createElement('i', { 'data-block': name })

function reihenfolge(): string[] {
  const html = renderToStaticMarkup(
    createElement(UnterDerAntwort, {
      data: { titleById: new Map(), releasesByTitle: new Map() } as unknown as Dataset,
      title: titel,
      favorites: new Set<number>(),
      handlung: marker('handlung'),
      reihe: marker('reihe'),
    }),
  )
  return [...html.matchAll(/data-block="(\w+)"/g)].map((m) => m[1])
}

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const folge = reihenfolge()
pruefe('Handlung vor Reihe', folge.join() === 'handlung,reihe', folge)

if (verletzt) {
  console.error(`check-panel-reihenfolge: ${verletzt} verletzt`)
  process.exit(1)
}
console.log('check-panel-reihenfolge: grün (1 Fall)')
