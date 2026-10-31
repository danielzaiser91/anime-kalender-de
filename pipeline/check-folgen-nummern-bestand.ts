/**
 * Bestand zu `bau/folgen-nummern.ts` (30.10.2026): Keine Folgenliste `public/data/folgen/<id>.json` führt eine Nummer zweimal,
 * außer den vermerkten echten Doppelungen (`ECHTE_DOPPELUNGEN`). 34 Doppelungen in 7 Dateien am 30.10.2026, davor.
 * Liest den gebauten Bestand, deshalb `check:bestand`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { unerlaubteDoppelte } from './bau/folgen-nummern.ts'
import { melde } from './lib/quarantaene.ts'

let listen = 0
let fehler = 0
for (const datei of readdirSync('public/data/folgen').filter((f) => /^\d+\.json$/.test(f))) {
  const id = Number(datei.slice(0, -5))
  const liste = JSON.parse(readFileSync(`public/data/folgen/${datei}`, 'utf8')) as { f: [number, string][] }
  listen++
  const doppelt = unerlaubteDoppelte(id, liste.f.map(([nr]) => nr))
  if (!doppelt.length) continue
  fehler++
  melde(id, 'folgen-nummern-bestand', 'Folgenliste mit doppelter Nummer')
  console.error(`FEHLER: ${id}: Nummer ${doppelt.join(', ')} steht mehrfach in der Folgenliste`)
}

/* Untergrenze, sonst ist ein Wächter ohne Daten grün: 1.809 Dateien am 30.10.2026. */
if (listen < 1000) {
  fehler++
  console.error(`FEHLER: nur ${listen} Folgenlisten gelesen — der Wächter misst nichts`)
}

console.log(`check-folgen-nummern-bestand: ${fehler ? `${fehler} Fehler` : 'ok'} (${listen} Folgenlisten, keine doppelte Nummer außer den vermerkten)`)
console.log(`VERSTÖSSE: ${fehler}`)
process.exit(fehler ? 1 : 0)
