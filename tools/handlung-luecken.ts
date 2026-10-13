/**
 * Titel ohne deutsche Handlung (Lücke für die eigenen Handlungstexte) listen und nach `data/cache/handlung-fakten/luecken.json` schreiben.
 * Die Titel, die der Bau aus dem aniSearch-Seitenarchiv füllt, zählen nicht dazu. Liest nur `public/data` und `data/`.
 *
 *   npx tsx tools/handlung-luecken.ts            Zahlen und Liste
 *   npx tsx tools/handlung-luecken.ts --kurz     nur Zahlen
 *
 * Endet mit Exit 0 (Messlauf). Weiter: `tools/handlung-fakten.ts` sammelt die Fakten. Doku: docs/wissen/datensatz.md, „Eigene Handlungstexte“.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { findeLuecken } from './handlung-fakten/luecken.ts'
import { CACHE } from './handlung-fakten/typen.ts'

const luecken = findeLuecken()
mkdirSync(CACHE, { recursive: true })
writeFileSync(`${CACHE}/luecken.json`, JSON.stringify(luecken, null, 1))
const geteilt = luecken.filter((l) => l.geteilt).length
const ohneSeite = luecken.filter((l) => !l.anisearchSeite).length
console.log(`Lücke: ${luecken.length} Titel (davon ${geteilt} auf geteilter aniSearch-Seite, ${ohneSeite} ohne aniSearch-Seite)`)
if (!process.argv.includes('--kurz')) {
  for (const l of luecken) console.log(`${l.id}\t${l.format ?? '-'}\t${l.jpYear ?? '-'}\t${l.titleDe ?? l.titleEn ?? l.titleRomaji}`)
}
console.log('ENDE 0')
