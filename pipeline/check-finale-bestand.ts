/**
 * Bestandswache: Kein „Staffelfinale“ im gebauten Bestand ohne belegtes Ende (Regel in `lib/finale-wache.ts`, Test
 * `check-finale-wache.ts`). Anlass: Beyblade X Staffel 3 (26.10.2026). Hart (Finale ohne Folgenzahl oder aus einer Sichtung): rot,
 * der Titel wird zurückgestellt (Marke). Weich (japanisch mehr Folgen): eine Zeile „⚠ WARNUNG“, Exit 0 — ein echtes Teilfinale
 * sperrt nichts; es wird mit `lastEpisodeDate` am Release freigegeben.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'
import { finaleOhneEndbeleg } from './lib/finale-wache.ts'
import { melde } from './lib/quarantaene.ts'
import type { Release, ReleaseEvent } from '../shared/types.ts'

const PFADE = ['public/data/events.json', 'public/data/releases.json']
const fehlt = PFADE.filter((p) => !existsSync(p))
if (fehlt.length) {
  console.error(`FEHLER: ${fehlt.join(', ')} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const events = readJson<ReleaseEvent[]>(PFADE[0]!, [])
const releases = readJson<Release[]>(PFADE[1]!, [])
const zaehlung = readJson<Record<string, number[]>>('public/data/folgen/zaehlung.json', {})
const verstoesse = finaleOhneEndbeleg(events, releases, zaehlung)
const hart = verstoesse.filter((v) => v.hart)
const weich = verstoesse.filter((v) => !v.hart)
if (weich.length) {
  console.log(bestandWarnzeile('Staffelfinale bei weniger Folgen als japanisch', 'Titel', weich.map((v) => v.titleId)))
  for (const v of weich) console.log(`    ${v.slug}: ${v.grund}`)
}
for (const v of hart) {
  melde(v.titleId, 'finale-bestand', v.grund)
  console.error(`FEHLER: Bestand: ${v.slug}: ${v.grund}`)
}
if (hart.length) {
  console.log(`VERSTÖSSE: ${hart.length}`)
  process.exit(1)
}
console.log(`Staffelfinale im Bestand: ${events.filter((e) => e.staffelfinale).length} Termine, ${weich.length} mit Verdacht, keiner aus Sichtung oder ohne Folgenzahl`)
console.log('VERSTÖSSE: 0')
