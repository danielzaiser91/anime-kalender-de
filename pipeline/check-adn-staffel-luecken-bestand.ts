/**
 * Bestandsprüfung (`public/data`, ADN-Archiv): ADN-Serien, die je Staffel neu zählen (Staffel 2 beginnt wieder bei Folge 1) und an denen kein Titel
 * in `data/adn-staffelzuordnung.yaml` steht. Für sie verteilt der Lauf die Meldungen durchgezählt und warnt nur im Lauf-Log (`bereicheJeAdnTitel`).
 *
 * Bewusst nur eine Warnung (Exit 0): eine neue ADN-Serie kommt ohne Eintrag, und das ist kein falscher Datensatz, Rot würde den Bestandsbau stoppen.
 * Die Zeile `⚠ WARNUNG …` zeigt `commit-data.sh` im Lauf-Log. Test: `check-adn-staffel-luecken.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { adnStaffelLuecken, type AdnRohSerie } from './lib/adn-staffel-luecken.ts'
import { ladeAdnStaffelzuordnung } from './lib/adn-staffelzuordnung.ts'
import { ladeHandbelege } from './lib/dub-confirmed.ts'
import { ROOT, readJson } from './lib/util.ts'

const ordner = resolve(ROOT, 'data/adn-raw')
const dateien = readdirSync(ordner).filter((d) => d.endsWith('.json.gz'))
const serien = dateien.map((d) => JSON.parse(gunzipSync(readFileSync(resolve(ordner, d))).toString('utf8')) as AdnRohSerie)
const titles = readJson<Parameters<typeof adnStaffelLuecken>[1]>('public/data/titles.json', [])
const luecken = adnStaffelLuecken(serien, titles, ladeAdnStaffelzuordnung(), ladeHandbelege())

console.log(`ADN-Serien im Archiv: ${serien.length}, je Staffel neu gezählt ohne Eintrag in der Staffelzuordnung: ${luecken.length}`)
if (luecken.length)
  console.log(`  ⚠ WARNUNG ADN-Staffelzuordnung: ${luecken.length} Serien zählen je Staffel und haben keinen Eintrag in data/adn-staffelzuordnung.yaml — Meldungen werden durchgezählt verteilt: ${luecken.map((l) => `${l.showId} ${l.name}`).join('; ')}`)
console.log('VERSTÖSSE: 0')
