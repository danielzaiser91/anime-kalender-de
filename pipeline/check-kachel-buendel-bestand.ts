/**
 * Bestandsteil von `check-kachel-buendel.ts`: Je Titel + Weg + Tag höchstens eine Kachel (`releases.json`, `events.json`).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-kachel-buendel.ts`.
 */
import { readFileSync } from 'node:fs'
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { istStaffelstart } from '../web/src/lib/staffelstart.ts'
import { todayIso } from '../shared/time.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Daten = { releaseBySlug: Map<string, Release> }

/** Dieselbe Bündelung wie die Woche (`PosterRaster`) und der Monat (`MonatsZelle`). */
function kacheln(stream: ReleaseEvent[], data: Daten): ReleaseEvent[][] {
  return buendeleKacheln(stream, (e) => istStaffelstart(e, data), (e) => !!e.premiere)
}

function bestandspruefung(): void {
  console.log('\nEchter Bestand: je Titel + Weg + Tag höchstens eine Kachel:')
  const lies = <T>(pfad: string): T => JSON.parse(readFileSync(new URL(`../public/data/${pfad}`, import.meta.url), 'utf8')) as T
  const daten: Daten = { releaseBySlug: new Map(lies<Release[]>('releases.json').map((r) => [r.slug, r])) }
  const nachTag = new Map<string, ReleaseEvent[]>()
  for (const e of lies<ReleaseEvent[]>('events.json')) {
    if (e.platform === 'tv' || e.releaseType === 'disc' || e.zweitanbieter) continue
    nachTag.set(e.date, [...(nachTag.get(e.date) ?? []), e])
  }
  const schluessel = (e: ReleaseEvent) => `${e.titleId}|${e.platform}|${e.sender ?? ''}`
  const doppelt: string[] = []
  let mitZusatz = 0
  for (const [tag, stream] of nachTag) {
    const gruppen = kacheln(stream, daten)
    for (const g of gruppen) {
      if (g[0]!.verpasst || g[0]!.premiere) continue
      if (g.length > 1) mitZusatz++
      const uebrige = gruppen.filter((h) => h !== g && schluessel(h[0]!) === schluessel(g[0]!))
      if (uebrige.some((h) => !h[0]!.verpasst && !h[0]!.premiere)) doppelt.push(`${tag} ${g[0]!.name}`)
    }
  }
  pruefe('keine zweite Kachel desselben Titels beim selben Anbieter am selben Tag', doppelt.length === 0, doppelt.slice(0, 10))
  console.log(`  Info: ${mitZusatz} Kacheln tragen Zusatzfolgen (Stand ${todayIso()}).`)
}

bestandspruefung()

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('check-kachel-buendel-bestand: ok')
console.log('VERSTÖSSE: 0')
