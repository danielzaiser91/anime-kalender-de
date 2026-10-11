import { istErschienen } from '@shared/logic.ts'
import type { ReleaseEvent } from '@shared/types.ts'

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
