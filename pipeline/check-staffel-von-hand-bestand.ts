/**
 * Zusicherung: **jede Kennung in `data/staffel-von-hand.yaml` steht in einer Reihe des gebauten Bestands**
 * (`public/data/franchises.json`) — ein Tippfehler bliebe sonst stumm. Liest den Bestand, deshalb in
 * `check:bestand-liste` (Bestandsbau und `commit-data.sh`), nicht in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './lib/util.ts'
import { staffelEintraegeVonHand } from './bau/staffel-quelle.ts'

const reihen = JSON.parse(readFileSync(resolve(ROOT, 'public/data/franchises.json'), 'utf8')) as Record<string, { id: number }[]>
const inReihen = new Set(Object.values(reihen).flatMap((r) => r.map((m) => m.id)))
const eintraege = staffelEintraegeVonHand()
const ohneReihe = eintraege.filter((e) => !inReihen.has(e.anilistId))
for (const e of ohneReihe) console.error(`FEHLER: AniList ${e.anilistId} (data/staffel-von-hand.yaml) steht in keiner Reihe`)
if (!eintraege.length || ohneReihe.length) process.exit(1)
console.log(`Staffel von Hand (Bestand): ${eintraege.length} Eintrag/Einträge, alle in einer Reihe`)
