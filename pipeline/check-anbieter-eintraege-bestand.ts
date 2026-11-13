/**
 * Bestandswache: Jeder Eintrag in `DATUM_VOM_ANBIETER` (lib/invarianten.ts) trifft genau ein Release in `public/data/releases.json`.
 * Ohne Release ist er tot (Slug-Wechsel, Titel weg), mit mehreren zu weit; beides verdeckt einen echten DD-01-Fund.
 * `--eintraege=<Datei>` (relativ zur Wurzel, JSON Schlüssel → Grund) ersetzt die Liste, nur für den Prozesstest `check-anbieter-eintraege-bestand-lauf.ts`.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Release } from '../shared/types.ts'
import { anbieterEintragProbleme, DATUM_VOM_ANBIETER } from './lib/invarianten.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import { readJson, ROOT } from './lib/util.ts'

const RELEASES = 'public/data/releases.json'
if (!existsSync(resolve(ROOT, RELEASES))) {
  console.error(`FEHLER: ${RELEASES} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const eintragsDatei = process.argv.find((a) => a.startsWith('--eintraege='))?.slice('--eintraege='.length)
const eintraege = eintragsDatei ? readJson<Record<string, string>>(eintragsDatei, {}) : DATUM_VOM_ANBIETER
const releases = readJson<Release[]>(RELEASES, [])
const probleme = anbieterEintragProbleme(releases, eintraege)
/* Marke je Eintrag auf die Titelkennung im Schlüssel: der Titel wird zurückgestellt, statt dass ein toter Eintrag einen echten DD-01-Fund verdeckt. */
meldeVerletzte(probleme.map((text) => ({ id: Number(/"(\d+):/.exec(text)?.[1]), text })), 'anbieter-eintraege-bestand', 'Anbieterdatum-Eintrag ohne oder mit mehr als einem Release', () => true)
for (const p of probleme) console.error(`FEHLER: ${p}`)
console.log(`Anbieterdatum-Einträge im Bestand: ${Object.keys(eintraege).length} Einträge gegen ${releases.length} Releases geprüft`)
console.log(`VERSTÖSSE: ${probleme.length}`)
process.exit(probleme.length ? 1 : 0)
