/**
 * Zusicherung am gebauten Bestand (`public/data/releases.json`): jede Kennung in `data/katalog-release-von-hand.yaml` hat ein Release,
 * und ihre Quelle steht in dessen `sources` (Prüfer PR 1075, 13.10.2026). Ein toter Eintrag wäre ein Beleg, der nichts belegt.
 * Läuft in `check:bestand`; die Regel mit Gegenproben steht in `check-katalog-release.ts`.
 */
import type { Release } from '../shared/types.ts'
import { katalogBelegBestandFehler, ladeKatalogBelegEintraege } from './lib/katalog-belege.ts'
import { readJson } from './lib/util.ts'

const eintraege = ladeKatalogBelegEintraege()
const releases = readJson<Release[]>('public/data/releases.json', [])
const fehler = katalogBelegBestandFehler(eintraege, releases)
console.log('\nHanddatei Katalog-Release gegen den gebauten Bestand:')
if (releases.length === 0 || eintraege.length === 0) fehler.push('releases.json oder Handdatei leer')
for (const f of fehler) console.error(`  ✖ ${f}`)
if (!fehler.length) console.log(`  ✓ ${eintraege.length} Einträge: jede Kennung hat ein Release, jede Quelle steht in dessen sources`)
process.exit(fehler.length ? 1 : 0)
