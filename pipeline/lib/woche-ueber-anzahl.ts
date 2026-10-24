/**
 * **Eine Folge, die nur das Wochenprogramm nennt und die über der belegten Folgenzahl liegt, ist kein Termin**
 * (Daniel, 18.10.2026, „Though I Am an Inept Villainess“ F12: Crunchyroll hat sich im Wochenprogramm geirrt, die Folge kam nicht).
 *
 * Eine gemessene Beobachtung (Kalender) über der Zahl hebt die Zahl weiter an (`folge-ueber-anzahl.ts`); eine bloße
 * Ankündigung tut das nicht. Die Zahl gilt als belegt, wenn sie nicht nur angenommen ist und die Zählung bei Folge 1 beginnt.
 */
import type { CrunchyrollEntry } from './crunchyroll.ts'
import { warn } from './util.ts'

/** Der Eintrag ohne die Wochenprogramm-Folgen über `schedule.episodeCount`; unverändert, wenn die Zahl nicht belegt ist. */
export function ohneWocheUeberAnzahl(slot: CrunchyrollEntry, schedule: { episodeCount?: number; episodeCountAssumed?: boolean; firstEpisodeNumber?: number }, name: string): CrunchyrollEntry {
  const zahl = schedule.episodeCount
  const beob = slot.observations ?? []
  const zaehltAbEins = beob.some((o) => o.quelle !== 'woche' && o.episode === 1)
  if (!zahl || schedule.episodeCountAssumed || !zaehltAbEins) return slot
  const letzte = (schedule.firstEpisodeNumber ?? 1) + zahl - 1
  const ueber = beob.filter((o) => o.quelle === 'woche' && (o.episode ?? 0) > letzte)
  if (!ueber.length) return slot
  warn(`"${name}": Wochenprogramm nennt Folge ${ueber.map((o) => o.episode).join(', ')} über der letzten belegten Folge ${letzte} — nicht übernommen`)
  return { ...slot, observations: beob.filter((o) => !ueber.includes(o)) }
}
