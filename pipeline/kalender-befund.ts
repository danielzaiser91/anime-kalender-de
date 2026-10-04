/**
 * Konsistenzmessung des **ausgelieferten** Kalenders — liest nur, schreibt nichts.
 *
 * Gegenstück zu `tools/daten-befund.mjs`, aber für die vier Regeln aus
 * `docs/wissen/befund-2026-10-02.md` (B-02 bis B-06) in der Fassung, die später
 * in die Bauprüfung wandern soll: Slugs eindeutig, jedes Release hat einen
 * Titel, keine Folgennummer doppelt, Datum steigt mit der Folgennummer.
 *
 * Endet **immer** mit Exit 0: Das ist ein Messlauf, kein Tor. Erst wenn die
 * Zahlen klein genug sind, wird daraus eine Zusicherung im Bau.
 *
 * Aufruf: npm run check:kalender
 */
import { readJson } from './lib/util.ts'
import { pruefeKalenderKonsistenz } from './lib/kalender-konsistenz.ts'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'

/** Was jede Regel bedeutet — Reihenfolge der Ausgabe. */
const REGELN: Array<{ kennung: string; name: string }> = [
  { kennung: 'slug', name: 'Slugs eindeutig' },
  { kennung: 'titel', name: 'jedes Release hat einen Titel' },
  { kennung: 'folgennummer', name: 'keine Folgennummer doppelt im Release' },
  { kennung: 'monotonie', name: 'Datum steigt mit der Folgennummer (schedule.observed)' },
]

/** Wie viele Fundstellen je Regel gezeigt werden — der Rest ist nur die Zahl. */
const ZEIGEN = 15

const releases = readJson<Release[]>('public/data/releases.json', [])
const events = readJson<ReleaseEvent[]>('public/data/events.json', [])
const titles = readJson<Title[]>('public/data/titles.json', [])
const titelIds = new Set(titles.map((t) => t.id))

const befunde = pruefeKalenderKonsistenz(releases, events, titelIds)

for (const { kennung, name } of REGELN) {
  const meine = befunde.filter((b) => b.regel === kennung)
  console.log(`${meine.length === 0 ? '✓' : '✗'} ${name}: ${meine.length}`)
  for (const b of meine.slice(0, ZEIGEN)) console.log(`    ${b.wo} — ${b.text}`)
  if (meine.length > ZEIGEN) console.log(`    … und ${meine.length - ZEIGEN} weitere`)
}

console.log(`\n${befunde.length} Fundstelle(n) in ${releases.length} Releases und ${events.length} Terminen.`)
process.exit(0)
