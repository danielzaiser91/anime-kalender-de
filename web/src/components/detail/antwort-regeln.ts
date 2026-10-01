/**
 * **Zwei Regeln für den Antwort-Kasten** — ausgelagert, weil `berechneAntwort`
 * die Längengrenze reißt (`tools/umfang-pruefen.mjs`).
 */
import { istErschienen } from '@shared/logic.ts'
import { formatDate, weekdayName } from '@shared/time.ts'
import type { ReleaseEvent } from '@shared/types.ts'

/**
 * **Gezählt werden Folgen, nicht Termine** (Daniel, 01.10.2026).
 *
 * Ein Komplettabwurf ist **ein** Termin, aber N Folgen. Vorher zählte die
 * Schleife Ereignisse — ein ADN-Block mit 12 Folgen stand nach dem Start als
 * „1 von 12 erschienen" da. Wöchentliche Termine tragen je eine Folge, dort
 * ändert die Summe nichts.
 */
export function zaehleErschienen(events: ReleaseEvent[]): number {
  let n = 0
  for (const e of events) if (istErschienen(e)) n += e.episode != null ? 1 : (e.episodeCount ?? 1)
  return n
}

/**
 * **Ein abgeschlossenes, vollständig deutsches Werk ist die feste Wahrheit.**
 *
 * „86: Eighty Six" liegt seit 2021 vollständig auf Deutsch vor; im Oktober 2026
 * nimmt ADN dieselben Folgen als Komplettabwurf ins Angebot. Der Kasten las den
 * künftigen Termin als Sendeplan und schrieb „0 von 12 Folgen erschienen ·
 * Wöchentlich" über eine fertige Serie (Daniel, 01.10.2026: „einmal belegt
 * erschienen auf de, ist die feste wahrheit").
 *
 * Ein späterer Abwurf oder eine Wiederholung überschreibt das nicht. Eine
 * **laufende** Serie bleibt unberührt — dort sind die künftigen Folgen wirklich
 * noch offen.
 */
export function istBelegtAbgeschlossen(
  hatSynchro: boolean,
  vollstaendig: boolean,
  abgeschlossen: boolean,
): boolean {
  return hatSynchro && vollstaendig && abgeschlossen
}

/**
 * **Der Terminsatz im Kopf** — „erscheint am …" bzw. beim Komplettabwurf
 * „im Angebot ab …". Ausgelagert, damit `AntwortKasten` die Längengrenze hält.
 */
export function terminSatz(
  komplett: boolean | undefined,
  rel: string,
  datum: string,
  T: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (komplett) {
    return rel
      ? T('antwort.angebotRelativ', { rel, tag: weekdayName(datum), datum: formatDate(datum) })
      : T('antwort.angebotDatum', { tag: weekdayName(datum), datum: formatDate(datum) })
  }
  return rel
    ? T('antwort.erscheintRelativ', { rel, tag: weekdayName(datum), datum: formatDate(datum) })
    : T('antwort.erscheintDatum', { tag: weekdayName(datum), datum: formatDate(datum) })
}
