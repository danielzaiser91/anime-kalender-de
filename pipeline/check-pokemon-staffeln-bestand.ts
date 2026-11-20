/** Bestandsprüfer: die deutschen Staffelgrenzen (`data/curated/pokemon-staffeln.yaml`) enden bei der Folgenzahl jedes Titels in `titles.json`. */
import { readFileSync } from 'node:fs'
import { fehlerInGrenzen, ladeStaffelGrenzen } from './lib/pokemon-staffeln.ts'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number; episodes?: number }[]
const jeId = new Map(titel.map((t) => [t.id, t]))
let fehler = 0
for (const g of ladeStaffelGrenzen()) {
  const t = jeId.get(g.anilistId)
  const probleme = t ? fehlerInGrenzen(g, t.episodes) : ['steht nicht in titles.json']
  for (const p of probleme) {
    fehler++
    console.error(`FEHLER: ${g.anilistId} (${g.titel ?? ''}): ${p}`)
  }
}
if (fehler) process.exit(1)
console.log('check-pokemon-staffeln-bestand: ok')
