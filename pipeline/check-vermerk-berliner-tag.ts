/**
 * Ausfall-Vermerke zeigen ihre Tage in Berliner Zeit (12.11.2026): `erwartetAm`, `erschienenAm`, `neuErwartet` und `rechercheAm` sind
 * UTC-Zeitpunkte; ein `slice(0, 10)` zeigte zwischen Mitternacht Berlin und 00:00 UTC den Vortag. Gerendert mit `renderToStaticMarkup`.
 * Läuft in `check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReleaseEvent, VermerkAusgeblieben } from '../shared/types.ts'
import { translate } from '../web/src/lib/i18n.tsx'
import { VerpasstMarke } from '../web/src/components/kalender/Marken.tsx'
import { VermerkAuskunft } from '../web/src/components/detail/vermerk.tsx'

let fehler = 0
function pruefe(name: string, ok: boolean, info?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${info === undefined ? '' : ` — gefunden: ${JSON.stringify(info)}`}`)
}

const T = translate as unknown as (k: string, v?: Record<string, string | number>) => string
/* 22:30 UTC am 13.10. ist 00:30 Berlin am 14.10. */
const SPAET = '2026-10-13T22:30:00.000Z'
const ev = (v: Partial<VermerkAusgeblieben>) => ({ id: 'x@2026-10-14', date: '2026-10-14', episode: 3, verpasst: { erwartetAm: SPAET, ...v } }) as unknown as ReleaseEvent

const nachgereicht = renderToStaticMarkup(createElement(VerpasstMarke, { event: ev({ erschienenAm: SPAET, verzugStunden: 1 }), t: T }))
pruefe('„kam …“ nennt den Berliner Tag', nachgereicht.includes('kam 2026-10-14'), nachgereicht)

const auskunft = (v: Partial<VermerkAusgeblieben>) =>
  renderToStaticMarkup(createElement(VermerkAuskunft, { vermerk: { erwartetAm: SPAET, ...v } as VermerkAusgeblieben, ausgeblieben: false, episode: 3, anbieter: 'Crunchyroll', today: '2026-10-20', T }))
const ueberfaellig = auskunft({})
pruefe('überfällige Folge: erwartet für den 14.10.2026', ueberfaellig.includes('für den 14.10.2026 erwartet'), ueberfaellig)
const leer = auskunft({ rechercheAm: SPAET })
pruefe('Recherche ohne Ergebnis: Tag der Recherche in Berliner Zeit', leer.includes('bis zum 14.10.2026 nichts'), leer)

if (fehler) {
  console.error(`check-vermerk-berliner-tag: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-vermerk-berliner-tag: alle Zusicherungen halten.')
