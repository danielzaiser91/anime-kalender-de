import type { ReleaseEvent } from '@shared/types.ts'

/**
 * Fasst die Termine eines Tages zusammen, die denselben Titel beim selben Anbieter (im Fernsehen:
 * beim selben Sender) zeigen. One Piece läuft auf ProSieben MAXX viermal am Tag — als vier Karten
 * verdrängte das die wenigen Neustarts der Woche aus dem Blick.
 *
 * Die Reihenfolge bleibt die der Eingabe; ein Bündel steht dort, wo sein erster Termin stand.
 * Was `eigenstaendig` meldet, wird nie eingeklappt — ein ausgebliebener Termin oder eine
 * TV-Premiere trägt eine eigene Auskunft, die hinter dem Zähler verschwände.
 */
export function buendeleTermine(
  termine: ReleaseEvent[],
  eigenstaendig: (ev: ReleaseEvent) => boolean,
): ReleaseEvent[][] {
  const gruppen: ReleaseEvent[][] = []
  const nachSchluessel = new Map<string, ReleaseEvent[]>()
  for (const ev of termine) {
    if (eigenstaendig(ev)) {
      gruppen.push([ev])
      continue
    }
    const schluessel = [ev.titleId > 0 ? ev.titleId : ev.name, ev.platform, ev.sender ?? ''].join('|')
    const gruppe = nachSchluessel.get(schluessel)
    if (gruppe) {
      gruppe.push(ev)
      continue
    }
    const neu = [ev]
    nachSchluessel.set(schluessel, neu)
    gruppen.push(neu)
  }
  return gruppen
}
