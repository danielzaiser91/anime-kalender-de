/**
 * Zusicherung: **jeder Eintrag in `data/staffel-von-hand.yaml` steht im gebauten Bestand
 * (`public/data/franchises.json`) mit genau dieser Staffelnummer als `staffelQuelle`** — fehlt die Kennung (Tippfehler) oder
 * kommt die Nummer nicht an (Verdrahtung in `13-4-zusatzdateien.ts`), heißt der Teil weiter „Teil 2" statt „Staffel 2".
 * Liest den Bestand, deshalb in `check:bestand-liste` (Bestandsbau und `commit-data.sh`), nicht in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './lib/util.ts'
import { staffelEintraegeVonHand } from './bau/staffel-quelle.ts'

type Glied = { id: number; staffelQuelle?: number }
const reihen = JSON.parse(readFileSync(resolve(ROOT, 'public/data/franchises.json'), 'utf8')) as Record<string, Glied[]>
const glieder = new Map(Object.values(reihen).flatMap((r) => r.map((m) => [m.id, m] as const)))
const eintraege = staffelEintraegeVonHand()
const falsch = eintraege.filter((e) => glieder.get(e.anilistId)?.staffelQuelle !== e.staffel)
for (const e of falsch) {
  const ist = glieder.has(e.anilistId) ? `staffelQuelle ${glieder.get(e.anilistId)?.staffelQuelle}` : 'keine Reihe'
  console.error(`FEHLER: AniList ${e.anilistId} (data/staffel-von-hand.yaml) soll Staffel ${e.staffel} sein, im Bestand: ${ist}`)
}
if (!eintraege.length || falsch.length) process.exit(1)
console.log(`Staffel von Hand (Bestand): ${eintraege.length} Eintrag/Einträge, alle mit der Staffelnummer in franchises.json`)
