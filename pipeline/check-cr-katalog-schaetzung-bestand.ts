/**
 * Bestandswache: Kein laufender Crunchyroll-Wochentermin schätzt („≈“) eine erschienene Folge, die der deutsche Katalog mit Stempel führt
 * (Apothekerin Staffel 3, 08.11.2026). Rot meldet den Titel mit Marke. Regel in `lib/cr-katalog-schaetzung.ts`, Test in `check-cr-block-zaehlung.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { schaetzungTrotzKatalog } from './lib/cr-katalog-schaetzung.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Release } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'

const PFADE = ['public/data/releases.json', 'data/crunchyroll-dub.json']
const fehlt = PFADE.filter((p) => !existsSync(p))
if (fehlt.length) {
  console.error(`FEHLER: ${fehlt.join(', ')} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const releases = readJson<Release[]>(PFADE[0]!, [])
const serien = readJson<CrDubData>(PFADE[1]!, { serien: [] } as never).serien
const offen = schaetzungTrotzKatalog(releases, serien, new Date())
const titelVon = new Map(releases.map((r) => [r.slug, r.titleId]))
const treffer = meldeVerletzte(
  [...new Set(offen.map((o) => o.slug))].map((slug) => ({ id: titelVon.get(slug)!, slug })),
  'cr-katalog-schaetzung-bestand',
  'erschienene Folge steht als „≈“, obwohl der deutsche Katalog sie mit Stempel führt',
  () => true,
)
for (const { slug } of treffer) {
  const folgen = offen.filter((o) => o.slug === slug).map((o) => o.folge).join(', ')
  console.error(`FEHLER: Bestand: ${slug}: Folge ${folgen} geschätzt, der Katalog führt sie`)
}
console.log(`Crunchyroll-Wochentermine mit geschätzter Folge trotz Katalog: ${treffer.length} von ${releases.filter((r) => r.platform === 'crunchyroll' && r.releaseType === 'weekly').length}`)
console.log(`VERSTÖSSE: ${treffer.length}`)
process.exit(treffer.length ? 1 : 0)
