/**
 * **Zwei Regeln für den Antwort-Kasten** — ausgelagert, weil `berechneAntwort`
 * die Längengrenze reißt (`tools/umfang-pruefen.mjs`).
 */
import { istErschienen } from '@shared/logic.ts'
import { formatDate, weekdayName } from '@shared/time.ts'
import type { Release, ReleaseEvent, Title } from '@shared/types.ts'

/**
 * **Gezählt werden Folgen, nicht Termine**.
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
 * Wöchentlich" über eine fertige Serie.
 *
 * Ein späterer Abwurf oder eine Wiederholung überschreibt das nicht. Eine
 * **laufende** Serie bleibt unberührt — dort sind die künftigen Folgen wirklich
 * noch offen.
 */
export function istBelegtAbgeschlossen(
  hatSynchro: boolean,
  vollstaendig: boolean,
  abgeschlossen: boolean,
  events: ReleaseEvent[],
): boolean {
  return hatSynchro && vollstaendig && abgeschlossen && !deutscherWochentaktLaeuft(events)
}

/**
 * **Ein wöchentlicher deutscher Release mittendrin ist keine fertige Synchro.**
 * Folge 1 erschienen, die übrigen erst angekündigt: Ein `dub: true` ohne
 * Folgenbereiche hieße sonst „alle N Folgen auf Deutsch", sobald Japan fertig
 * ist (Overgeared). Ein Komplettabwurf (86) oder eine TV-Wiederholung läuft
 * nicht im Wochentakt eines Streams und bleibt davon unberührt.
 */
export function deutscherWochentaktLaeuft(events: ReleaseEvent[]): boolean {
  const jeRelease = new Map<string, ReleaseEvent[]>()
  for (const e of events) {
    if (e.releaseType !== 'weekly' || e.platform === 'tv' || e.platform === 'disc') continue
    jeRelease.set(e.releaseSlug, [...(jeRelease.get(e.releaseSlug) ?? []), e])
  }
  return [...jeRelease.values()].some((l) => l.some((e) => istErschienen(e)) && l.some((e) => !istErschienen(e)))
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

/** Stammt die Gesamtzahl nur aus der fortgeschriebenen Folgenzahl des laufenden Release? */
export function gesamtGeschaetzt(title: Title, releases: Release[], n: ReleaseEvent): boolean {
  return !title.episodes && Boolean(releases.find((r) => r.slug === n.releaseSlug)?.schedule.episodeCountAssumed)
}

/** Eine Zahl oder ein Datum, das auf einer geschätzten Folgenzahl beruht, trägt „≈". */
export function ungefaehr(wert: string | number, geschaetzt: boolean | undefined): string {
  return geschaetzt ? `≈ ${wert}` : String(wert)
}
