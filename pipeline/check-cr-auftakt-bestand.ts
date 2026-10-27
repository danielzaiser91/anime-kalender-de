/**
 * Bestandswache: Kein „Neu bei Crunchyroll“ für den Auftakt einer in diesem Jahr gestarteten, noch laufenden Staffel (Psyren, 26.10.2026).
 * Rot, der Titel wird zurückgestellt (Marke). Die Regel steht in `lib/cr-auftakt-wache.ts`, ihr Test in `check-cr-auftakt-wache.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { auftaktAlsKatalog } from './lib/cr-auftakt-wache.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Release, Title } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'

const PFADE = ['public/data/releases.json', 'public/data/titles.json', 'data/crunchyroll-dub.json']
const fehlt = PFADE.filter((p) => !existsSync(p))
if (fehlt.length) {
  console.error(`FEHLER: ${fehlt.join(', ')} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const releases = readJson<Release[]>(PFADE[0]!, [])
const titelDatei = readJson<Title[] | { titles: Title[] }>(PFADE[1]!, [])
const titel = new Map((Array.isArray(titelDatei) ? titelDatei : titelDatei.titles).map((t) => [t.id, t]))
const falsch = new Set(auftaktAlsKatalog(releases, titel, readJson<CrDubData>(PFADE[2]!, { serien: [] } as never).serien))
const treffer = meldeVerletzte(
  releases.map((r) => ({ id: r.titleId, r })),
  'cr-auftakt-bestand',
  'laufende Staffel dieses Jahres steht als „Neu bei Crunchyroll“ statt als Staffelstart',
  (x) => falsch.has(x.r),
)
for (const { r } of treffer) console.error(`FEHLER: Bestand: ${r.slug}: Block führt mehr Folgen als deutsche, Serie startete im Terminjahr, Termin ist ein Katalogtermin`)
console.log(`Crunchyroll-Auftakte im Bestand: ${releases.filter((r) => r.platform === 'crunchyroll' && r.dateMeaning === 'available-from').length} Katalogtermine geprüft`)
console.log(`VERSTÖSSE: ${treffer.length}`)
process.exit(treffer.length ? 1 : 0)
