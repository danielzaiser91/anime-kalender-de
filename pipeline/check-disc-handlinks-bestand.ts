/**
 * Bestandsprüfung (`public/data`): Welche Disc-Kauflinks sind ein Amazon-Handlink (`/dp/<ASIN>`) ohne eindeutige EAN? Ihre
 * Adresse kann veralten (Händler ersetzen Angebote, Amazon nimmt Seiten vom Netz); der Bau setzt die EAN-Suche davor
 * (`lib/disc-ean.ts`), was übrig bleibt, steht hier mit Titel und Datum. Die Zahl darf nur sinken
 * (`data/disc-handlinks-stand.json`, Rechenregel `suchlinkBilanz(…, 'produkt')`). Kein Abruf fremder Seiten.
 *
 * Bewusst nur eine Warnung (Exit 0): Ein Sammler kann jederzeit eine Disc mit Handlink ohne EAN melden, und das darf den
 * Bestandsbau nicht anhalten. Die Zeilen `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log.
 */
import { readJson } from './lib/util.ts'
import { suchlinkBilanz, type SuchlinkStand } from './lib/disc-suchlinks.ts'

const releases = readJson<Parameters<typeof suchlinkBilanz>[0]>('public/data/releases.json', [])
const stand = readJson<SuchlinkStand>('data/disc-handlinks-stand.json', { stand: '', hoechstens: 0, slugs: [] })
const b = suchlinkBilanz(releases, stand, 'produkt')
const zeile = (r: (typeof b.neu)[number]) => `${r.name ?? r.slug} (${r.schedule?.firstEpisodeDate ?? 'ohne Datum'})`

console.log(`Disc-Handlinks ohne EAN: ${b.anzahl} (Stand ${stand.stand}: höchstens ${stand.hoechstens})`)
for (const r of b.alle) console.log(`  Handlink: ${zeile(r)}`)
if (b.neu.length)
  console.log(`  ⚠ WARNUNG Disc-Handlink: ${b.neu.length} neue(r) Amazon-Handlink(s) ohne eindeutige EAN — EAN in anisearch-artikel.json ergänzen oder Ausgabe eindeutig machen: ${b.neu.map(zeile).join(', ')}`)
if (b.ueberGrenze) console.log(`  ⚠ WARNUNG Disc-Handlink: ${b.anzahl} Handlinks, mehr als die Grenze ${stand.hoechstens}`)
if (b.erledigt.length >= 10)
  console.log(`  ⚠ WARNUNG Disc-Handlink: ${b.erledigt.length} Slugs in data/disc-handlinks-stand.json sind kein Handlink mehr — Liste und Grenze kürzen (Ratsche)`)
console.log('VERSTÖSSE: 0')
