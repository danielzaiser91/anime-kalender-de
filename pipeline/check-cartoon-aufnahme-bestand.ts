/**
 * Bestandsteil von `check-cartoon-aufnahme.ts`: Jeder Cartoon in `public/data/cartoons.json` hat in `data/cartoons.json` einen Aufnahmebeleg
 * (`lib/cartoon-aufnahme.ts`). Zweites Netz hinter `check-cartoon-aufnahme-bau.ts`. Liest `public/data`, also `check:bestand`.
 */
import { readJson } from './lib/util.ts'
import { hatAufnahmeBeleg } from './lib/cartoon-aufnahme.ts'
import type { CartoonEintrag } from './lib/cartoons.ts'
import type { Title } from '../shared/types.ts'

const roh = readJson<Record<string, CartoonEintrag>>('data/cartoons.json', {})
const ohne = readJson<Title[]>('public/data/cartoons.json', []).filter((t) => {
  const quelle = roh[String(t.id)]
  return quelle && !hatAufnahmeBeleg(quelle)
})
if (ohne.length) {
  console.error(`✖ ${ohne.length} Cartoon(s) ohne Anbieter, Sender und Studio in cartoons.json: ${ohne.map((t) => t.titleEn).join(', ')}`)
  console.log(`VERSTÖSSE: ${ohne.length}`)
  process.exit(1)
}
console.log('  ✓ jeder Cartoon in public/data/cartoons.json hat einen Aufnahmebeleg')
console.log('VERSTÖSSE: 0')
