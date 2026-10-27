/**
 * Bestandsprüfung (`public/data`): Wie viele Disc-Kauflinks sind nur eine Amazon-Namenssuche? Die Zahl darf nur sinken
 * (`data/disc-suchlinks-stand.json`, Regel und Lehre in `lib/disc-suchlinks.ts`).
 *
 * Bewusst nur eine Warnung (Exit 0): Ein Sammler kann jederzeit eine Disc ohne EAN melden, und das darf den Bestandsbau
 * nicht anhalten. Die Zeilen `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log.
 */
import { readJson } from './lib/util.ts'
import { suchlinkBilanz, type SuchlinkStand } from './lib/disc-suchlinks.ts'

const releases = readJson<Parameters<typeof suchlinkBilanz>[0]>('public/data/releases.json', [])
const stand = readJson<SuchlinkStand>('data/disc-suchlinks-stand.json', { stand: '', hoechstens: 0, slugs: [] })
const b = suchlinkBilanz(releases, stand)

console.log(`Disc-Namenssuchen: ${b.anzahl} (Stand ${stand.stand}: höchstens ${stand.hoechstens})`)
if (b.neu.length)
  console.log(`  ⚠ WARNUNG Disc-Kauflink: ${b.neu.length} neue Amazon-Namenssuche(n) — EAN in anisearch-artikel.json fehlt oder Ausgabe nicht eindeutig; Handlink in data/curated/disc-*.yaml eintragen: ${b.neu.map((r) => r.slug).join(', ')}`)
if (b.ueberGrenze) console.log(`  ⚠ WARNUNG Disc-Kauflink: ${b.anzahl} Namenssuchen, mehr als die Grenze ${stand.hoechstens}`)
if (b.erledigt.length >= 10)
  console.log(`  ⚠ WARNUNG Disc-Kauflink: ${b.erledigt.length} Slugs in data/disc-suchlinks-stand.json sind keine Namenssuche mehr — Liste und Grenze kürzen (Ratsche)`)
console.log('VERSTÖSSE: 0')
