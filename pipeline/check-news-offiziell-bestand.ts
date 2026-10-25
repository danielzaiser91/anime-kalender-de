/**
 * Bestandsteil von `check-news-offiziell.ts`: Jede freigegebene Meldung (`data/offizielle-meldungen.yaml`) gehört zu einem Titel, den es in `public/data/titles.json` gibt,
 * und ihr Tag liegt nicht in der Zukunft. Eine falsch getippte Kennung bliebe sonst still ohne Meldung (`offizielleMeldungen` überspringt, was in `titles` fehlt).
 * Liest den gebauten Bestand, deshalb in `check:bestand` (`tools/check-bestand-liste.txt`), nicht in `check:logic`.
 */
import { ROOT, readJson } from './lib/util.ts'
import { offizielleLaden } from './lib/news-offiziell.ts'
import { zurueckgestellt } from './lib/quarantaene.ts'
import { todayIso } from '../shared/time.ts'

const titel = new Set(readJson<{ id: number }[]>('public/data/titles.json', []).map((t) => t.id))
for (const id of zurueckgestellt().ids) titel.add(id) // zurückgestellt (Quarantäne), nicht verloren
const liste = offizielleLaden(ROOT)
const ohneTitel = liste.filter((e) => !titel.has(e.titleId)).map((e) => `${e.id} (Titel ${e.titleId})`)
const zukunft = liste.filter((e) => e.datum > todayIso()).map((e) => e.id)
if (ohneTitel.length || zukunft.length) {
  console.error(`✖ offizielle Meldungen: ohne Titel im Bestand ${JSON.stringify(ohneTitel)}, Tag in der Zukunft ${JSON.stringify(zukunft)}`)
  console.log(`VERSTÖSSE: ${ohneTitel.length + zukunft.length}`)
  process.exit(1)
}
console.log(`  ✓ ${liste.length} freigegebene Meldung(en), jede mit Titel im Bestand und Tag bis heute`)
console.log('VERSTÖSSE: 0')
