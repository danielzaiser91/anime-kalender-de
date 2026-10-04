/**
 * **Hinter einer Lücke kann nichts erschienen sein** (Daniel, 04.10.2026, „You and I Are Polar Opposites" S2).
 *
 * Folge 8 kam vom 13.09. an dreimal nicht; Crunchyroll legte sie erst am 04.10. zusammen mit 9 bis 11
 * nach. Der Kalender behauptete bis dahin „Folge 8 ist nicht erschienen" **und** „9 von 13 Folgen erschienen":
 * Der dritte Ausfall (27.09.) fiel in `expandEvents` weg, weil dort schon eine fortgeschriebene Folge stand,
 * und diese und die folgende zählten als erschienen, weil ihr Datum verstrichen war.
 *
 * Zwei Regeln: (1) Ein Ausfall an einem Tag, an dem schon eine fortgeschriebene Folge derselben Nummer
 * steht, vermerkt **diese** Folge als ausgeblieben. (2) Jede fortgeschriebene Folge mit höherer Nummer als
 * die erste offene Lücke trägt `nachLuecke` und zählt nicht als erschienen.
 */
import type { ReleaseEvent, VermerkAusgeblieben } from './types.ts'

const istAusgeblieben = (e: ReleaseEvent): boolean => Boolean(e.verpasst && !e.verpasst.erschienenAm)

/** Vermerkt `v` an der vorhandenen Folge; `true`, wenn es eine gab (dann entsteht kein zweiter Eintrag). */
export function verpasstAnVorhandenes(events: ReleaseEvent[], tag: string, episode: number, v: VermerkAusgeblieben): boolean {
  const e = events.find((x) => x.date === tag && x.episode === episode)
  if (!e) return false
  if (!e.verpasst) {
    e.verpasst = v
    e.estimated = undefined
  }
  return true
}

export function markiereNachLuecke(events: ReleaseEvent[]): ReleaseEvent[] {
  const luecke = Math.min(...events.filter(istAusgeblieben).map((e) => e.episode ?? Infinity))
  if (!Number.isFinite(luecke)) return events
  for (const e of events) if (e.estimated && !e.verpasst && (e.episode ?? 0) > luecke) e.nachLuecke = true
  return events
}
