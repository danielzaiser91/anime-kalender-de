/**
 * Eigene Handlungstexte gegen den gebauten Bestand (`check:bestand`, 12.10.2026): Ein Eintrag in `data/handlung-eigen.yaml`, dessen Titel im Bestand schon einen Text
 * aus einer Quelle trägt (oder gar nicht mehr vorkommt), wird nicht mehr genutzt — er soll nicht ungenutzt veralten, sondern gelöscht werden.
 */
import { SYNOPSIS_GROUPS, type Title } from '../shared/types.ts'
import { readJson } from './lib/util.ts'
import { zurueckgestellt } from './lib/quarantaene.ts'
import { ladeEigeneHandlungen } from './lib/handlung-eigen.ts'

type Synopse = { de?: string; eigen?: unknown }

function ausgeliefert(id: number): Synopse | undefined {
  const gruppe = readJson<Record<string, Synopse>>(`public/data/synopses/${id % SYNOPSIS_GROUPS}.json`, {})
  return gruppe[String(id)]
}

const titel = new Set(readJson<Title[]>('public/data/titles.json', []).map((t) => t.id))
for (const id of zurueckgestellt().ids) titel.add(id) // zurückgestellt (Quarantäne), nicht verloren
const meldungen: string[] = []
for (const e of ladeEigeneHandlungen()) {
  const s = ausgeliefert(e.id)
  if (!titel.has(e.id)) meldungen.push(`Eigene Handlung ${e.id}: Titel nicht im Bestand`)
  else if (s?.de && !s.eigen) meldungen.push(`Eigene Handlung ${e.id}: der Bestand führt einen Text aus einer Quelle`)
}

if (meldungen.length) {
  console.error(`FEHLER: ${meldungen.length} überholte Einträge in data/handlung-eigen.yaml — löschen:\n${meldungen.join('\n')}`)
  process.exit(1)
}
console.log('Eigene Handlung gegen den Bestand: kein Eintrag überholt.')
