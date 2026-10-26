/**
 * Zusicherungen zu „freenet meinVOD: Deutsch laut Schwester-Shop“ am gebauten Bestand (13.10.2026): Jede Kennzeichnung hat ihren
 * Schwester-Beleg und kein `dubRanges` daneben, und kein freenet-Weg mit Schwester-Beleg und ohne eigene Angabe bleibt ungekennzeichnet.
 * Läuft in `check:bestand` (nach dem Bau), nicht in `check:logic`. Die Regel selbst prüft `check-schwester-shop.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { schwesterBelegtDeutsch, schwesterFehler } from './lib/schwester-shop.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const OUT = 'public/data/titles.json'
if (!existsSync(OUT)) {
  console.error(`FEHLER: ${OUT} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const titel = readJson<Title[]>(OUT, [])
const freenet = (t: Title) => (t.watchLinks ?? []).filter((w) => /^freenet meinvod$/i.test(w.name))
const mitBeleg = titel.filter((t) => freenet(t).length && schwesterBelegtDeutsch(t.watchLinks ?? []))
const falschGekennzeichnet = meldeVerletzte(titel, 'schwester-shop', 'Kennzeichnung ohne Schwester-Beleg oder neben dubRanges', (t) => schwesterFehler([t]).length > 0)
pruefe('Bestand: keine Kennzeichnung ohne Schwester-Beleg, keine neben dubRanges', falschGekennzeichnet.length === 0, schwesterFehler(titel)[0])
const ungekennzeichnet = meldeVerletzte(mitBeleg, 'schwester-shop', 'freenet-Weg mit Schwester-Beleg ungekennzeichnet', (t) =>
  freenet(t).some((w) => !w.dubRanges?.length && w.dubAbgeleitet !== 'schwester-shop'),
)
pruefe(
  'Bestand: jeder freenet-Weg ohne eigene Angabe, dessen Schwester Deutsch belegt, ist gekennzeichnet',
  ungekennzeichnet.length === 0,
  ungekennzeichnet.map((t) => t.id).join(', '),
)
console.log(`  ${titel.filter((t) => freenet(t).some((w) => w.dubAbgeleitet)).length} Titel mit „laut Schwester-Shop“ bei freenet`)
if (fehler) {
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
