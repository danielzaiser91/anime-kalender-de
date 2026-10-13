import type { ReleaseEvent } from '@shared/types.ts'

/**
 * Fasst die Termine eines Tages zusammen, die denselben Titel beim selben Anbieter (im Fernsehen:
 * beim selben Sender) zeigen. One Piece läuft auf ProSieben MAXX viermal am Tag — als vier Karten
 * verdrängte das die wenigen Neustarts der Woche aus dem Blick.
 *
 * Die Reihenfolge bleibt die der Eingabe; ein Bündel steht dort, wo sein erster Termin stand.
 * Was `eigenstaendig` meldet, wird nie eingeklappt — ein ausgebliebener Termin oder eine
 * TV-Premiere trägt eine eigene Auskunft, die hinter dem Zähler verschwände.
 *
 * `kopf` (Staffelstart): Der Termin führt sein Bündel an und nimmt die weiteren Folgen desselben
 * Tages auf, auch wenn er sonst eigenständig wäre — sonst stünden Folge 1 und Folge 2 als zwei
 * Kacheln nebeneinander (Avatar: Die sieben Häfen, 11.10.2026).
 */
export function buendeleTermine(
  termine: ReleaseEvent[],
  eigenstaendig: (ev: ReleaseEvent) => boolean,
  kopf: (ev: ReleaseEvent) => boolean = () => false,
): ReleaseEvent[][] {
  const gruppen: ReleaseEvent[][] = []
  const nachSchluessel = new Map<string, ReleaseEvent[]>()
  for (const ev of termine) {
    const fuehrt = kopf(ev)
    if (eigenstaendig(ev) && !fuehrt) {
      gruppen.push([ev])
      continue
    }
    const schluessel = buendelSchluessel(ev)
    const gruppe = nachSchluessel.get(schluessel)
    if (gruppe) {
      if (fuehrt) gruppe.unshift(ev)
      else gruppe.push(ev)
      continue
    }
    const neu = [ev]
    nachSchluessel.set(schluessel, neu)
    gruppen.push(neu)
  }
  return gruppen
}

const buendelSchluessel = (ev: ReleaseEvent): string => [ev.titleId > 0 ? ev.titleId : ev.name, ev.platform, ev.sender ?? ''].join('|')

/**
 * Die Bündelung der Kalender-Kacheln (Woche und Monat): Alle Folgen eines Titels beim selben Anbieter am selben Tag sind eine
 * Kachel, auch das Finale (Mushoku Tensei Staffel 3: Folge 13 und 14, 13.10.2026); der Staffelstart führt sie an. Eigenständig
 * bleiben Ausgebliebenes und `sonst` (Woche: Premieren) — sie tragen eine eigene Auskunft.
 */
export function buendeleKacheln(
  termine: ReleaseEvent[],
  istStart: (ev: ReleaseEvent) => boolean,
  sonst: (ev: ReleaseEvent) => boolean = () => false,
): ReleaseEvent[][] {
  return buendeleTermine(termine, (ev) => !!ev.verpasst || sonst(ev), (ev) => !ev.verpasst && istStart(ev))
}
