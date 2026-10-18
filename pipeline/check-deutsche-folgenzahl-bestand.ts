/**
 * Deutsche Folgenzahl gegen den gebauten Bestand (`check:bestand`, 12.10.2026): Ein `deFolgen` in `data/erstausgabe-von-hand.yaml`, dessen Zahl im Bestand nicht unter der Folgenzahl
 * des Werks liegt (oder dessen Titel fehlt), wird nicht genutzt — er soll nicht veralten, sondern gelöscht werden. Dass die Detaildaten die Zahl schon tragen, prüft der nächste Bestandsbau.
 */
import type { Title } from '../shared/types.ts'
import { readJson } from './lib/util.ts'
import { zurueckgestellt } from './lib/quarantaene.ts'
import { deFolgenGilt, ladeErstausgabeVonHand } from './lib/erstausgabe-von-hand.ts'

const titel = new Map(readJson<Title[]>('public/data/titles.json', []).map((t) => [t.id, t]))
const meldungen: string[] = []
const zurueck = zurueckgestellt().ids
for (const e of ladeErstausgabeVonHand()) {
  if (!e.deFolgen) continue
  const t = titel.get(e.anilistId ?? 0)
  if (!t && zurueck.has(e.anilistId ?? 0)) continue // zurückgestellt (Quarantäne), nicht verloren
  if (!t) meldungen.push(`Deutsche Folgenzahl ${e.anilistId} (${e.title}): Titel nicht im Bestand`)
  else if (!deFolgenGilt(e.deFolgen, t.episodes)) meldungen.push(`Deutsche Folgenzahl ${e.anilistId} (${e.title}): ${e.deFolgen.n} liegt nicht unter den ${t.episodes} Folgen des Werks`)
}

if (meldungen.length) {
  console.error(`FEHLER: ${meldungen.length} überholte Einträge mit deFolgen in data/erstausgabe-von-hand.yaml — löschen:\n${meldungen.join('\n')}`)
  process.exit(1)
}
console.log('Deutsche Folgenzahl gegen den Bestand: kein Eintrag überholt.')
