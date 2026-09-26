/**
 * Messung (26.09.2026): Welche automatischen Disc-Termine aus den News bekommen ihre aniSearch-Ausgabe?
 * Läuft gegen den ausgelieferten Datensatz und `data/disc-ausgaben.json`, schreibt nichts.
 *
 *   npx tsx tools/archiv/disc-termine-messen.ts
 */
import { readFileSync } from 'node:fs'
import { ausgabeZumDiscTermin, type DiscAusgabe } from '../../pipeline/lib/disc-termin.ts'

const releases = JSON.parse(readFileSync('public/data/releases.json', 'utf8'))
const liste = Array.isArray(releases) ? releases : releases.releases
const ausgaben = JSON.parse(readFileSync('data/disc-ausgaben.json', 'utf8')) as Record<string, DiscAusgabe[]>
let mit = 0
let ohne = 0
for (const r of liste) {
  if (r.releaseType !== 'disc' || !r.automatisch) continue
  const datum = r.schedule?.firstEpisodeDate
  const a = datum ? ausgabeZumDiscTermin({ datum, hinweise: [...(r.sources ?? []), r.herkunft ?? ''] }, ausgaben[String(r.titleId)] ?? []) : null
  if (a) mit++
  else ohne++
  console.log(`${a ? 'ja  ' : 'nein'} ${r.slug} ${datum} ${String(r.name).slice(0, 40)}${a ? ` → ${a.edition} ${a.url}` : ''}`)
}
console.log(`\n${mit} verknüpft, ${ohne} ohne`)
