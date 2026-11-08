// Messskript (Exit 0): welche Titel verlieren durch "jpEnd nur bei FINISHED" ihr jpEnd?
// Aufruf: node tools/jpend-bilanz.mjs <cache-ordner> [titles.json]
// Zählt gegen public/data/titles.json: Titel mit jpEnd = AniList-Starttag, ohne endDate, Status nicht FINISHED.
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const cache = process.argv[2]
const titelDatei = process.argv[3] ?? 'public/data/titles.json'
if (!cache) {
  console.log('Aufruf: node tools/jpend-bilanz.mjs <cache-ordner> [titles.json]')
  process.exit(0)
}

const iso = (d) =>
  d?.year && d.month && d.day ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : undefined

const media = new Map()
for (const f of ['anilist-media.json', 'anilist-by-id.json']) {
  const datei = path.join(cache, f)
  for (const m of Object.values(JSON.parse(readFileSync(datei, 'utf8')))) media.set(m.id, m)
  console.log(`Cache ${f}: ${statSync(datei).mtime.toISOString().slice(0, 10)}`)
}
const titel = JSON.parse(readFileSync(titelDatei, 'utf8'))
const liste = Array.isArray(titel) ? titel : titel.titles
const nachId = new Map(liste.map((t) => [t.id, t]))

const ohneEnde = [...media.values()].filter((m) => !m.isAdult && !iso(m.endDate) && m.status !== 'FINISHED')
const betroffen = ohneEnde.filter((m) => {
  const jpEnd = nachId.get(m.id)?.jpEnd
  return jpEnd !== undefined && jpEnd === iso(m.startDate)
})
const nachStatus = {}
for (const m of ohneEnde) nachStatus[m.status ?? 'null'] = (nachStatus[m.status ?? 'null'] ?? 0) + 1
console.log(`Medien ohne endDate und nicht FINISHED: ${ohneEnde.length} ${JSON.stringify(nachStatus)}`)
console.log(`davon in titles.json mit jpEnd = Starttag (verlieren jpEnd): ${betroffen.length}`)
for (const m of betroffen) {
  const t = nachId.get(m.id)
  console.log(`  ${m.id} ${m.status} jpYear=${t.jpYear} jpEnd=${t.jpEnd} ${t.titleEn ?? t.titleRomaji}`)
}
const fehlend = ohneEnde.filter((m) => !nachId.has(m.id))
console.log(`ohne endDate, nicht FINISHED, nicht in titles.json: ${fehlend.length}`)
process.exit(0)
