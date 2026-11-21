/**
 * Bestandsprüfung (`public/data/franchises.json`): zwei Hauptstaffeln einer Reihe tragen dieselbe belegte Staffelnummer (`staffelQuelle`),
 * Regel in `lib/staffelquelle-widerspruch.ts`. Nur eine Warnung (Exit 0): die Korrektur ist ein Handeintrag in `data/staffel-von-hand.yaml`
 * mit Quelle, der Bestandsbau darf bis dahin nicht anhalten.
 */
import type { FranchiseMember } from '../shared/types.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'
import { ladeStaffelGrenzen } from './lib/pokemon-staffeln.ts'
import { staffelQuellenWidersprueche } from './lib/staffelquelle-widerspruch.ts'
import { readJson } from './lib/util.ts'

const reihen = readJson<Record<string, FranchiseMember[]>>('public/data/franchises.json', {})
const erlaubt = new Set(ladeStaffelGrenzen().map((g) => g.anilistId))
const alle = Object.values(reihen)
const funde = alle.flatMap((reihe) => staffelQuellenWidersprueche(reihe, erlaubt))

console.log(`Staffelquelle-Widersprüche (zwei Hauptstaffeln, dieselbe belegte Nummer): ${funde.length} in ${alle.length} Reihen`)
if (funde.length) {
  const ids = funde.flatMap((f) => f.ids)
  console.log(bestandWarnzeile('Staffelquelle', `Einträge mit gleicher belegter Staffelnummer in einer Reihe — Handeintrag in data/staffel-von-hand.yaml mit Quelle (${funde.map((f) => `Staffel ${f.staffel}: ${f.namen.join(' / ')}`).join('; ')})`, ids))
}
console.log('VERSTÖSSE: 0')
