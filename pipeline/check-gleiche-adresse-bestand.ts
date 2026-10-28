/**
 * Bestandsprüfung (`data/`): Wie viele Amazon-Seiten tragen Handbelege zu zwei Titeln, obwohl die Zuordnung sie einem gibt?
 * Die Zahl darf nur sinken (`data/gleiche-adresse-stand.json`, Regel in `lib/gleiche-adresse.ts`).
 *
 * Nur Warnung (Exit 0): Die Erweiterung kann jederzeit einen neuen Beleg melden, das darf den Bestandsbau nicht anhalten.
 * Die Zeilen `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { ROOT, readJson } from './lib/util.ts'
import { gleicheAdresseBilanz, type BelegKurz, type GleicheAdresseStand, type ZuordnungKurz } from './lib/gleiche-adresse.ts'

const datei = join(ROOT, 'data', 'dub-confirmed.yaml')
const geladen = existsSync(datei) ? yaml.load(readFileSync(datei, 'utf8')) : []
const belege = Array.isArray(geladen) ? (geladen as BelegKurz[]) : []
const zuordnung = readJson<Record<string, ZuordnungKurz>>('data/prime-zugeordnet.json', {})
const stand = readJson<GleicheAdresseStand>('data/gleiche-adresse-stand.json', { stand: '', hoechstens: 0, adressen: [] })
const b = gleicheAdresseBilanz(belege, zuordnung, stand)

console.log(`Gleiche Amazon-Seite an zwei Titeln: ${b.fehl.length} (Stand ${stand.stand}: höchstens ${stand.hoechstens})`)
if (b.neu.length)
  console.log(`  ⚠ WARNUNG Gleiche Adresse: ${b.neu.length} neue Amazon-Seite(n) mit Beleg an einem Titel, dem sie laut data/prime-zugeordnet.json nicht gehört — Fehlbeleg in data/dub-confirmed.yaml entfernen: ${b.neu.join(', ')}`)
if (b.ueberGrenze) console.log(`  ⚠ WARNUNG Gleiche Adresse: ${b.fehl.length} Seiten, mehr als die Grenze ${stand.hoechstens}`)
if (b.erledigt.length >= 10)
  console.log(`  ⚠ WARNUNG Gleiche Adresse: ${b.erledigt.length} Adressen in data/gleiche-adresse-stand.json sind keine Doppelung mehr — Liste und Grenze kürzen (Ratsche)`)
console.log('VERSTÖSSE: 0')
