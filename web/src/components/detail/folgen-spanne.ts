import { expandEvents, istErschienen } from '@shared/logic.ts'
import type { Release, ReleaseEvent, StreamLink } from '@shared/types.ts'

/** Ein Weg im Panel: `ergaenzteFolgen` sind die Folgen in `dubRanges`, die nicht belegt, sondern aus dem Wochenplan ergänzt sind (nie im Datensatz). */
export type WegMitHerkunft = StreamLink & { ergaenzteFolgen?: number[] }

const spanne = (von: number, bis: number): string => (von === bis ? String(von) : `${von}–${bis}`)

/**
 * Die erschienenen Folgen als Spanne („1–15"), mit den echten Nummern statt gezählt: Ein Anbieter, der bei
 * Folge 101 einsetzt, hieße sonst „1–16". Ein Abwurf ohne Nummern („Folge 1–11") zählt vorn dazu, wenn die
 * nummerierten Folgen direkt danach beginnen. Leer, wenn die Nummern Lücken haben — dann sagt nur die Zahl etwas Wahres.
 */
export function erschieneneSpanne(events: ReleaseEvent[]): string | undefined {
  const raus = events.filter((e) => istErschienen(e))
  if (!raus.length) return undefined
  const ohneNummer = raus.filter((e) => e.episode == null).reduce((summe, e) => summe + (e.episodeCount ?? 1), 0)
  const nummern = new Set(raus.filter((e) => e.episode != null).map((e) => e.episode!))
  if (!nummern.size) return spanne(1, ohneNummer)
  const von = Math.min(...nummern)
  const bis = Math.max(...nummern)
  if (bis - von + 1 !== nummern.size) return undefined
  if (!ohneNummer) return spanne(von, bis)
  return von === ohneNummer + 1 ? spanne(1, bis) : undefined
}

/**
 * Ruht eine erschienene Folge nur auf einem fortgeschriebenen Termin (`estimated`), und deckt sie kein belegter Bereich?
 * Dann ist die Spanne abgeleitet und trägt „≈“ (Stichprobe 12.10.2026: 3 von 741 Bereichs-Pillen).
 * Die aus dem Wochenplan ergänzten Folgen (`ergaenzt`) stehen zwar in den Bereichen, belegt sind sie dadurch nicht.
 */
export function planGeschaetzt(
  events: ReleaseEvent[],
  bereiche: { from: number; to: number; dub: boolean }[] | undefined,
  ergaenzt: number[] = [],
): boolean {
  const belegt = (n: number | undefined): boolean =>
    n != null && !ergaenzt.includes(n) && (bereiche ?? []).some((b) => b.dub && n >= b.from && n <= b.to)
  return events.some((e) => istErschienen(e) && e.estimated && !belegt(e.episode))
}

/** Steht in den Bereichen eine Folge, die nur der fortgeschriebene Wochenplan liefert (ergänzt, ihr Termin `estimated`)? */
export function ergaenzungGeschaetzt(releases: Release[], ergaenzt: number[] = []): boolean {
  return releases
    .flatMap((r) => expandEvents(r))
    .some((e) => istErschienen(e) && e.estimated && e.episode != null && ergaenzt.includes(e.episode))
}
