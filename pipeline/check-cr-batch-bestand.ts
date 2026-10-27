/**
 * Bestandswache: Kein Crunchyroll-Abwurf („Neu bei Crunchyroll“) im gebauten Bestand behauptet mehr Folgen, als die Ableitung belegt.
 * Der Anlass war Aoashi Staffel 2 (26.10.2026): eine belegte Folge, „24 Folgen“. Rot, der Titel wird zurückgestellt (Marke), weil die
 * Behauptung sonst live steht. Die Regel steht in `lib/cr-batch-wache.ts`, ihr Test in `check-cr-batch-wache.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { batchUeberBelegt, belegteFolgen } from './lib/cr-batch-wache.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Release } from '../shared/types.ts'

const PFAD = 'public/data/releases.json'
if (!existsSync(PFAD)) {
  console.error(`FEHLER: ${PFAD} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const releases = readJson<Release[]>(PFAD, [])
const zuViel = new Set(batchUeberBelegt(releases))
const treffer = meldeVerletzte(
  releases.map((r) => ({ id: r.titleId, r })),
  'cr-batch-bestand',
  'Crunchyroll-Abwurf behauptet mehr Folgen, als belegt sind',
  (x) => zuViel.has(x.r),
)
for (const { r } of treffer) {
  console.error(`FEHLER: Bestand: ${r.slug}: ${belegteFolgen(r.herkunft)} Folgen belegt, ${r.schedule?.episodeCount} behauptet`)
}
if (treffer.length) {
  console.log(`VERSTÖSSE: ${treffer.length}`)
  process.exit(1)
}
const abwuerfe = releases.filter((r) => r.platform === 'crunchyroll' && r.releaseType === 'batch' && belegteFolgen(r.herkunft) !== null).length
console.log(`Crunchyroll-Abwürfe im Bestand: ${abwuerfe} geprüft, keiner behauptet mehr Folgen als belegt`)
console.log('VERSTÖSSE: 0')
