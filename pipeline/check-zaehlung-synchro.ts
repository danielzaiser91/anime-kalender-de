/**
 * Zusicherung zur Datenbank-Kopfzeile (Daniel, 11.10.2026): „· N mit 🇩🇪" ist mit und ohne den Schalter
 * „Anime ohne deutsche Synchro" dieselbe Zahl — Titel mit `os` (Bau) und mit `ohneSynchro` (ohne-synchro.json) zählen nie mit.
 * Misst gegen die echten Dateien in public/data. Läuft in `check:bestand` (`tools/check-bestand-liste.txt`), nicht in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { titelQuelle } from '../web/src/lib/titel-quelle.ts'
import { zaehleMitSynchro } from '../web/src/components/db-kopfzeile.tsx'
import type { Title } from '../shared/types.ts'

const lies = (datei: string): Title[] => JSON.parse(readFileSync(new URL(`../public/data/${datei}`, import.meta.url), 'utf8'))
const alle = lies('titles.json')
const ohne = lies('ohne-synchro.json').map((t) => ({ ...t, slug: String(t.id), keywords: [], streams: [] }) as Title)

const einzeln = (zeigeOhne: boolean) => titelQuelle([], alle, ohne, zeigeOhne, undefined).map((t) => ({ members: [t] }))
const aus = zaehleMitSynchro(einzeln(false))
const an = zaehleMitSynchro(einzeln(true))
const mitOs = alle.filter((t) => (t as Title & { os?: boolean }).os).length

console.log(`mit Synchro: Schalter aus ${aus}, Schalter an ${an} (${mitOs} Titel mit os in titles.json)`)
let verletzt = 0
if (aus !== an) {
  verletzt++
  console.error(`  ✖ Zahl „mit 🇩🇪" ändert sich mit dem Schalter: ${aus} -> ${an}`)
}
if (mitOs === 0) {
  verletzt++
  console.error('  ✖ keine os-Titel in titles.json — der Test misst nichts mehr')
}
if (verletzt) {
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('  ✓ Zahl „mit 🇩🇪" ist mit und ohne Schalter gleich')
console.log('VERSTÖSSE: 0')
