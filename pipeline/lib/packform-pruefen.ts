import { isDeepStrictEqual } from 'node:util'
import type { WochenDatei } from '../../shared/wochen-datei.ts'
import { entpackeKachel } from '../../shared/wochen-packen.ts'

/** Widersprüche zwischen der Kachel-Datei und ihrer Packform (leer = Auspacken gibt jeden Wert zurück; die Reihenfolge der Schlüssel zählt nicht). */
export function pruefePackform(kachel: WochenDatei, gepackt: WochenDatei): string[] {
  const zurueck = entpackeKachel(JSON.parse(JSON.stringify(gepackt)) as WochenDatei)
  const fehler: string[] = []
  if (zurueck.titles.length !== kachel.titles.length || !isDeepStrictEqual(zurueck.titles, kachel.titles)) fehler.push('Packform: Titel weichen nach dem Auspacken ab')
  kachel.releases.forEach((r, i) => {
    if (!isDeepStrictEqual(zurueck.releases[i], r)) fehler.push(`Packform: Release ${r.slug} weicht nach dem Auspacken ab`)
  })
  kachel.events.forEach((e, i) => {
    if (!isDeepStrictEqual(zurueck.events[i], e)) fehler.push(`Packform: Termin ${e.id} weicht nach dem Auspacken ab`)
  })
  if (zurueck.releases.length !== kachel.releases.length || zurueck.events.length !== kachel.events.length) fehler.push('Packform: Anzahl Releases oder Termine weicht ab')
  return fehler.slice(0, 20)
}
