/**
 * Bestandsprüfung (`public/data`): Wie viele Titel haben eine deutsche Disc im aniSearch-Archiv, aber keinen Disc-Verweis? Die Zahl darf
 * nur sinken (`data/disc-archiv-stand.json`, Regel in `lib/disc-archiv-luecke.ts`).
 *
 * Bewusst nur eine Warnung (Exit 0): Eine neue Archivseite kann jederzeit eine Disc führen, die der Bau nicht eindeutig zuordnet, und das
 * darf den Bestandsbau nicht anhalten. Die Zeilen `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log.
 */
import { readJson } from './lib/util.ts'
import type { Title } from '../shared/types.ts'
import { archivBilanz, titelMitDiscVerweis, type ArchivStand } from './lib/disc-archiv-luecke.ts'
import { archivSeiten, besitzerVon, kandidatenJeKennung, type LeseZaehler } from './extract-disc-ausgaben.ts'

const titles = readJson<Title[]>('public/data/titles.json', [])
const releases = readJson<Parameters<typeof titelMitDiscVerweis>[1]>('public/data/releases.json', [])
const stand = readJson<ArchivStand>('data/disc-archiv-stand.json', { stand: '', hoechstens: 0, ids: [] })

const kandidaten = kandidatenJeKennung(titles, besitzerVon(readJson('data/anisearch.json', {}), titles))
const zaehler: LeseZaehler = { geprueft: 0, auslaendisch: 0, verworfen: 0 }
const archivTitel: number[] = []
for (const [asId, ausgaben] of archivSeiten(kandidaten, zaehler)) {
  if (ausgaben.length) archivTitel.push(...kandidaten.get(asId)!.map((k) => k.id))
}
const b = archivBilanz(archivTitel, titelMitDiscVerweis(titles, releases), stand)

console.log(`Archiv-Disc ohne Disc-Verweis: ${b.anzahl} (Stand ${stand.stand}: höchstens ${stand.hoechstens})`)
if (b.neu.length)
  console.log(`  ⚠ WARNUNG Archiv-Disc: ${b.neu.length} Titel mit deutscher Disc im aniSearch-Archiv ohne Disc-Verweis, neu seit dem Stand: ${b.neu.join(', ')}`)
if (b.ueberGrenze) console.log(`  ⚠ WARNUNG Archiv-Disc: ${b.anzahl} Titel ohne Verweis, mehr als die Grenze ${stand.hoechstens}`)
if (b.erledigt.length >= 10)
  console.log(`  ⚠ WARNUNG Archiv-Disc: ${b.erledigt.length} Kennungen in data/disc-archiv-stand.json haben jetzt einen Verweis — Liste und Grenze kürzen (Ratsche)`)
console.log('VERSTÖSSE: 0')
