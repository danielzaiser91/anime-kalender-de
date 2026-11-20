/**
 * Bestandsprüfer: die Staffeln von Pokémon Horizonte (`data/curated/horizonte-staffeln.yaml`) gegen die gesammelten Quellen —
 * de.wikipedia (`data/wikipedia-folgen.json`, Spalte „Folge in der Staffel“) und TOGGO (`data/toggo.json`) — und ihre Wirkung im
 * gebauten Bestand (Detaildatei mit `s`, Kopfzählung bis zur letzten belegten Folge). Rot: eine abgeschlossene Staffel zählt in einer
 * Quelle anders, Detaildatei oder Kopf passen nicht. `⚠ WARNUNG` (im Lauf-Log sichtbar): eine Quelle führt eine neue Staffel oder den
 * Titel nicht. Liest relativ zum Arbeitsordner; Prozesstest `check-horizonte-staffeln-bestand-lauf.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { HORIZONTE_STAFFELN, abweichungenZurQuelle, folgenJeStaffelAusSt, hoechsteJeStaffel, ladeStaffelGrenzen, letzteFolgen } from './lib/pokemon-staffeln.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'
import { melde } from './lib/quarantaene.ts'

const lies = <T>(pfad: string): T | undefined => (existsSync(pfad) ? (JSON.parse(readFileSync(pfad, 'utf8')) as T) : undefined)
const wiki = lies<{ titel: Record<string, { folgen: { st?: number }[] }> }>('data/wikipedia-folgen.json')?.titel ?? {}
const toggo = lies<{ titel: Record<string, { folgen: { staffel: number; folge: number }[] }> }>('data/toggo.json')?.titel ?? {}
const zaehlung = lies<Record<string, [number, number]>>('public/data/folgen/zaehlung.json') ?? {}

let fehler = 0
function fehlt(id: number, text: string): void {
  fehler++
  melde(id, 'horizonte-staffeln', text)
  console.error(`FEHLER: ${id}: ${text}`)
}

for (const g of ladeStaffelGrenzen(HORIZONTE_STAFFELN)) {
  const id = g.anilistId
  const quellen: [string, (number | undefined)[] | undefined][] = [
    ['de.wikipedia', wiki[id] && folgenJeStaffelAusSt(wiki[id].folgen)],
    ['TOGGO', toggo[id] && hoechsteJeStaffel(toggo[id].folgen)],
  ]
  for (const [name, je] of quellen) {
    if (!je) {
      console.log(bestandWarnzeile(`Horizonte-Staffeln: ${name}`, 'Titel ohne Folgenliste, Staffeln ungeprüft', [id]))
      continue
    }
    const { fehler: f, hinweise } = abweichungenZurQuelle(g, je, name)
    for (const text of f) fehlt(id, text)
    for (const text of hinweise) console.log(bestandWarnzeile(`Horizonte-Staffeln: ${text}`, 'Titel', [id]))
  }
  const detail = lies<{ s?: unknown[] }>(`public/data/folgen/${id}.json`)
  if (!detail) fehlt(id, `Detaildatei public/data/folgen/${id}.json fehlt`)
  else if ((detail.s?.length ?? 0) !== g.staffeln.length) fehlt(id, `Detaildatei trägt ${detail.s?.length ?? 0} Staffeln, die Datei ${g.staffeln.length}`)
  const letzte = letzteFolgen([g]).get(id)!
  if ((zaehlung[id]?.[0] ?? 0) < letzte) fehlt(id, `Kopfzählung ${zaehlung[id]?.[0]} Folgen, belegt sind ${letzte}`)
}
if (fehler) process.exit(1)
console.log('check-horizonte-staffeln-bestand: ok')
