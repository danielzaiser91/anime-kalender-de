/**
 * Bestandswache: Kein „Staffelfinale“ im gebauten Bestand ohne belegtes Ende (Regel in `lib/finale-wache.ts`, Test
 * `check-finale-wache.ts`). Anlass: Beyblade X Staffel 3 (26.10.2026). Rot, der Titel wird zurückgestellt (Marke).
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
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
for (const v of verstoesse) {
  melde(v.titleId, 'finale-bestand', v.grund)
  console.error(`FEHLER: Bestand: ${v.slug}: ${v.grund}`)
}
if (verstoesse.length) {
  console.log(`VERSTÖSSE: ${verstoesse.length}`)
  process.exit(1)
}
console.log(`Staffelfinale im Bestand: ${events.filter((e) => e.staffelfinale).length} Termine, jedes mit belegtem Ende`)
console.log('VERSTÖSSE: 0')
