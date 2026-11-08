/**
 * Zusicherung: Die Wache `tools/synchro-wartezeit.mjs` und der OmU-Begleiter rechnen den Berliner Tag einer Folge mit derselben Regel
 * (`tools/cr-katalogblock.mjs`) wie der Rest des Baus (`nachBerlin` in `pipeline/lib/crunchyroll-termine.ts`), und beide stimmen mit
 * `shared/time.ts` (`berlinToUtc`) überein — rund um beide Zeitumstellungen 2026 und im Winter wie im Sommer.
 * Aufruf: `npm run check:logic`.
 */
import { nachBerlin as nachBerlinGemeinsam } from '../tools/cr-katalogblock.mjs'
import { nachBerlin as nachBerlinBau } from './lib/crunchyroll-termine.ts'
import { berlinToUtc } from '../shared/time.ts'

let verletzt = 0
let geprueft = 0
function pruefe(ok: boolean, text: string): void {
  geprueft++
  if (!ok) {
    verletzt++
    console.log(`  ✖ ${text}`)
  }
}

/** Zeitumstellungen 2026: 29.03. 01:00Z (Sommerzeit) und 25.10. 01:00Z (Winterzeit); dazu Sommer- und Wintertag. */
const FENSTER = [
  ['2026-03-28T00:00:00Z', '2026-03-30T12:00:00Z'],
  ['2026-10-24T00:00:00Z', '2026-10-26T12:00:00Z'],
  ['2026-01-14T18:00:00Z', '2026-01-15T02:00:00Z'],
  ['2026-07-14T18:00:00Z', '2026-07-15T02:00:00Z'],
] as const
for (const [anfang, ende] of FENSTER) {
  for (let t = Date.parse(anfang); t <= Date.parse(ende); t += 30 * 60_000) {
    const iso = new Date(t).toISOString()
    const gemeinsam = nachBerlinGemeinsam(iso)
    const bau = nachBerlinBau(iso)
    pruefe(JSON.stringify(gemeinsam) === JSON.stringify(bau), `${iso}: gemeinsam ${JSON.stringify(gemeinsam)} gegen Bau ${JSON.stringify(bau)}`)
    // Gegenprobe über shared/time.ts; die doppelte Ortsstunde beim Zurückstellen (25.10. 00:00Z–01:00Z) ist nicht eindeutig.
    const mehrdeutig = t >= Date.parse('2026-10-25T00:00:00Z') && t < Date.parse('2026-10-25T01:00:00Z')
    if (gemeinsam && !mehrdeutig) {
      pruefe(berlinToUtc(gemeinsam.datum, gemeinsam.zeit).getTime() === t, `${iso}: ${gemeinsam.datum} ${gemeinsam.zeit} Berlin ist nicht derselbe Zeitpunkt (shared/time.ts)`)
    }
  }
}
pruefe(nachBerlinGemeinsam('kein Datum') === null && nachBerlinBau('kein Datum') === null, 'ungültiger Zeitstempel ergibt null')
// Winterrand der Wache: 22:30Z am 14.01. ist 23:30 Berlin am 14.01., 23:00Z schon der 15.01.
pruefe(nachBerlinGemeinsam('2026-01-14T22:30:00Z')?.datum === '2026-01-14' && nachBerlinGemeinsam('2026-01-14T23:00:00Z')?.datum === '2026-01-15', 'Winterrand')

if (verletzt) {
  console.log(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-cr-katalogblock: ${geprueft} Zusicherungen halten (nachBerlin gemeinsam = Bau = shared/time.ts, beide Zeitumstellungen 2026).`)
