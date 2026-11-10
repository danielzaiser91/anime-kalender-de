/**
 * Bestandswache: Kein automatischer, geschätzter Joyn-Block-Termin neben Joyn-Fenstern desselben Titels (Yaiba, 09.11.2026).
 * Die Regel steht in `lib/joyn-block-wache.ts`, ihr Test in `check-joyn-block-wache.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { joynBlockTrotzFenster } from './lib/joyn-block-wache.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Release, Title } from '../shared/types.ts'

if (!existsSync('public/data/releases.json') || !existsSync('public/data/titles.json')) {
  console.error('FEHLER: public/data/releases.json oder titles.json fehlt — erst bauen')
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const releases = readJson<Release[]>('public/data/releases.json', [])
const titles = readJson<Title[]>('public/data/titles.json', [])
const falsch = new Set(joynBlockTrotzFenster(releases, titles))
const treffer = meldeVerletzte(
  releases.map((r) => ({ id: r.titleId, r })),
  'joyn-block-bestand',
  'geschätzter Joyn-Block-Termin trotz Joyn-Fenstern',
  (x) => falsch.has(x.r),
)
for (const { r } of treffer) console.error(`FEHLER: Bestand: ${r.slug}: geschätzter Joyn-Block ${r.schedule.firstEpisodeDate}, aber der Titel hat Joyn-Fenster — Handtermin in data/curated anlegen`)
if (treffer.length) {
  console.log(`VERSTÖSSE: ${treffer.length}`)
  process.exit(1)
}
console.log('Joyn-Block-Termine neben Joyn-Fenstern: keiner')
console.log('VERSTÖSSE: 0')
