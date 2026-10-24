/**
 * Einmalige Probe am echten Bestand (nicht in der Kette, liest public/data): bekommen die Disney+-Wiedervorlagen
 * (`seit`) über die Adresse eine Zuordnung? Aufruf: `node tools/weg-zuordnung-echt.mjs`
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ergaenzeUmEntfernte } from '../pipeline/lib/entfernte-verweise.ts'
import { baueNachUrl } from '../pipeline/lib/nach-url.ts'
import { ladePruefTitel } from '../pipeline/lib/pruef-titel.ts'
import { schluesselAdresse } from '../pipeline/lib/zuordnung.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const roh = readFileSync(join(wurzel, 'extension/offene-disney.js'), 'utf8')
const liste = JSON.parse(roh.slice(roh.indexOf('{'), roh.lastIndexOf('}') + 1))
const nachUrl = baueNachUrl(ladePruefTitel(wurzel))
ergaenzeUmEntfernte(nachUrl, resolve(wurzel, 'data/verweise-entfernt.json'))
let ohne = 0
for (const e of Object.values(liste).filter((x) => x.seit)) {
  const einzeln = new Set(e.staffeln.map((s) => s.id)).size === 1 // dann trägt die Meldung die titelId
  const ids = einzeln ? [e.staffeln[0].id] : (nachUrl.get(schluesselAdresse(e.url)) ?? [])
  if (!ids.length) ohne++
  console.log(`${e.titel.slice(0, 40).padEnd(40)} seit ${e.seit} → ${ids.length} Titel (${einzeln ? 'titelId' : 'Adresse'})`)
}
console.log(`ohne Zuordnung: ${ohne}`)
