/**
 * Zusicherung zur Kachelzahl am gebauten Bestand (`public/data/events.json`, Daniel 12.10.2026): Zwei Kacheln desselben Titels am selben
 * Tag teilen sich einen Anbieter, sonst wären sie eine. Läuft in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter
 * neueren Rohdaten zurück). Die Einheitenprüfungen stehen in `check-kachel-anbieter.ts`.
 */
import { readFileSync } from 'node:fs'
import type { ReleaseEvent } from '../shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { eigenstaendigBeiAnbietern, vereineAnbieter } from '../web/src/lib/anbieter-kachel.ts'
import { todayIso } from '../shared/time.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kacheln = (termine: ReleaseEvent[]) => vereineAnbieter(buendeleKacheln(termine, () => false, (e) => !!e.premiere), eigenstaendigBeiAnbietern)

function bestandspruefung(): void {
  console.log('\nEchter Bestand: je Titel + Tag höchstens eine Kachel, außer Eigenständiges und Mehrfachbündel:')
  const alle = JSON.parse(readFileSync(new URL('../public/data/events.json', import.meta.url), 'utf8')) as ReleaseEvent[]
  const nachTag = new Map<string, ReleaseEvent[]>()
  for (const e of alle) {
    if (e.platform === 'tv' || e.releaseType === 'disc' || e.zweitanbieter) continue
    nachTag.set(e.date, [...(nachTag.get(e.date) ?? []), e])
  }
  const doppelt: string[] = []
  let zusammengelegt = 0
  for (const [tag, stream] of nachTag) {
    const k = kacheln(stream)
    zusammengelegt += k.filter((x) => x.length > 1).length
    const plattformen = (x: ReleaseEvent[][]): Set<string> => new Set(x.map((b) => b[0]!.platform))
    const lose = k.filter((x) => x[0]![0]!.titleId > 0 && !eigenstaendigBeiAnbietern(x[0]![0]!))
    for (const [i, a] of lose.entries())
      for (const b of lose.slice(i + 1))
        if (a[0]![0]!.titleId === b[0]![0]!.titleId && ![...plattformen(a)].some((pl) => plattformen(b).has(pl))) doppelt.push(`${tag} ${a[0]![0]!.name}`)
  }
  pruefe('zwei Kacheln desselben Titels am Tag teilen sich einen Anbieter (sonst wären sie eine)', doppelt.length === 0, doppelt.slice(0, 5))
  console.log(`  Info: ${zusammengelegt} Kacheln tragen mehrere Anbieter (Stand ${todayIso()}).`)
}

bestandspruefung()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
