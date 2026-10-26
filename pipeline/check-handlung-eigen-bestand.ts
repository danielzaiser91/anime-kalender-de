/**
 * Eigene Handlungstexte gegen den gebauten Bestand (`check:bestand`, 12.10.2026): Ein Eintrag in `data/handlung-eigen.yaml`, dessen Titel gar nicht mehr vorkommt, ist ein Fehler.
 * Trägt der Titel inzwischen einen Text aus einer Quelle, gewinnt die Quelle schon im Bau; der Eintrag ist dann nur ein Hinweis (25.10.2026, vorher rot und blockierte den Bestandsbau).
 */
import { SYNOPSIS_GROUPS, type Title } from '../shared/types.ts'
import { readJson } from './lib/util.ts'
import { zurueckgestellt } from './lib/quarantaene.ts'
import { ladeEigeneHandlungen } from './lib/handlung-eigen.ts'
import { bewerteEigeneHandlungen } from './lib/handlung-eigen-bestand.ts'
import { bestandWarnzeile } from './lib/bestand-warnzeile.ts'

type Synopse = { de?: string; eigen?: unknown }

function ausgeliefert(id: number): Synopse | undefined {
  const gruppe = readJson<Record<string, Synopse>>(`public/data/synopses/${id % SYNOPSIS_GROUPS}.json`, {})
  return gruppe[String(id)]
}

const titel = new Set(readJson<Title[]>('public/data/titles.json', []).map((t) => t.id))
const hinterToggle = new Set(readJson<{ id: number }[]>('public/data/ohne-synchro.json', []).map((t) => t.id))
for (const id of zurueckgestellt().ids) titel.add(id) // zurückgestellt (Quarantäne), nicht verloren
const { fehler, hinweise, versteckt } = bewerteEigeneHandlungen(ladeEigeneHandlungen(), titel, ausgeliefert, hinterToggle)

if (hinweise.length) console.log(bestandWarnzeile('Eigene Handlung', 'überholt (Quelle gewinnt, in data/handlung-eigen.yaml bei Gelegenheit löschen)', hinweise))
if (versteckt.length) console.log(bestandWarnzeile('Eigene Handlung', 'ohne deutsche Synchro im Katalog (hinter dem Toggle; der Text bleibt stehen, bis der Titel sichtbar ist)', versteckt))
if (fehler.length) {
  console.error(`FEHLER: ${fehler.length} verwaiste Einträge in data/handlung-eigen.yaml — löschen:\n${fehler.join('\n')}`)
  console.log(`VERSTÖSSE: ${fehler.length}`)
  process.exit(1)
}
console.log(`Eigene Handlung gegen den Bestand: ${hinweise.length} überholt (Hinweis), kein Eintrag verwaist.`)
console.log('VERSTÖSSE: 0')
