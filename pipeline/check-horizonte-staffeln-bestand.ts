/**
 * Bestandsprüfer: die Staffeln von Pokémon Horizonte (`data/curated/horizonte-staffeln.yaml`) gegen die gesammelten Quellen —
 * de.wikipedia (`data/wikipedia-folgen.json`, Spalte „Folge in der Staffel“) und TOGGO (`data/toggo.json`) — und ihre Wirkung im
 * gebauten Bestand (Detaildatei mit `s`, Kopfzählung bis zur letzten belegten Folge). Eine neue Staffel in einer Quelle ist ein Hinweis.
 */
import { readFileSync } from 'node:fs'
import { HORIZONTE_STAFFELN, abweichungenZurQuelle, folgenJeStaffelAusSt, hoechsteJeStaffel, ladeStaffelGrenzen, letzteFolgen } from './lib/pokemon-staffeln.ts'
import { melde } from './lib/quarantaene.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T
const wiki = lies<{ titel: Record<string, { folgen: { st?: number }[] }> }>('data/wikipedia-folgen.json').titel
const toggo = lies<{ titel: Record<string, { folgen: { staffel: number; folge: number }[] }> }>('data/toggo.json').titel
const zaehlung = lies<Record<string, [number, number]>>('public/data/folgen/zaehlung.json')

let fehler = 0
function fehlt(id: number, text: string): void {
  fehler++
  melde(id, 'horizonte-staffeln', text)
  console.error(`FEHLER: ${id}: ${text}`)
}

for (const g of ladeStaffelGrenzen(HORIZONTE_STAFFELN)) {
  const id = g.anilistId
  const quellen: [string, (number | undefined)[]][] = [
    ['de.wikipedia', folgenJeStaffelAusSt(wiki[id]?.folgen ?? [])],
    ['TOGGO', hoechsteJeStaffel(toggo[id]?.folgen ?? [])],
  ]
  for (const [name, je] of quellen) {
    const { fehler: f, hinweise } = abweichungenZurQuelle(g, je, name)
    for (const text of f) fehlt(id, text)
    for (const text of hinweise) console.log(`HINWEIS: ${id}: ${text}`)
  }
  const detail = lies<{ s?: unknown[] }>(`public/data/folgen/${id}.json`)
  if ((detail.s?.length ?? 0) !== g.staffeln.length) fehlt(id, `Detaildatei trägt ${detail.s?.length ?? 0} Staffeln, die Datei ${g.staffeln.length}`)
  const letzte = letzteFolgen([g]).get(id)!
  if ((zaehlung[id]?.[0] ?? 0) < letzte) fehlt(id, `Kopfzählung ${zaehlung[id]?.[0]} Folgen, belegt sind ${letzte}`)
}
if (fehler) process.exit(1)
console.log('check-horizonte-staffeln-bestand: ok')
