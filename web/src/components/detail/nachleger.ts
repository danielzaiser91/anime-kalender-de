import { zeitGeschaetzt } from '@shared/zeit-text.ts'
import { anzeigeFolge, istAusgeblieben } from '@shared/logic.ts'
import { weekdayName } from '@shared/time.ts'
import { anbieterName, type PlatformId, type ReleaseEvent } from '@shared/types.ts'
import { ohneSchonErschienene } from './antwort-regeln.ts'

/** Mehr Zeilen wären eine Liste: Der Kasten nennt die drei nächsten Termine. */
export const MAX_NACHLEGER = 3

/** Ein Anbieter, der Folgen nachlegt, die ein anderer schon gebracht hat — mit seinem nächsten Termin. */
export interface Nachleger {
  platform: PlatformId
  von: number
  bis: number
  date: string
  time?: string
  /** Datum oder Uhrzeit sind abgeleitet, nicht bestätigt — der Text trägt „≈“. */
  geschaetzt: boolean
}

/**
 * **Wer noch nachlegt, was woanders schon da ist** (Daniel, 10.10.2026, Option 2). „Nächste Folge“ zählt nur
 * Folgen, die nirgends erschienen sind (`ohneSchonErschienene`); Netflix' Folge 16 am 17.10. fiel damit aus dem
 * Kasten, obwohl Crunchyroll alle 24 hat. Hier steht je Anbieter der nächste solche Termin.
 * Nur Termine nach `heute`: Einer von heute ohne Uhrzeit gilt erst um 23:59 als erschienen, ist aber schon da.
 * TV, Kino und Disc sind ausgenommen: Die TV-Pille nennt Folge, Tag und Uhrzeit selbst.
 */
export function nachlegerJeAnbieter(events: ReleaseEvent[], heute: string): Nachleger[] {
  const stream = events.filter((e) => !['tv', 'kino', 'disc'].includes(e.platform) && e.releaseType !== 'disc')
  const offen = stream.filter((e) => anzeigeFolge(e) && e.date > heute && !istAusgeblieben(e))
  const neu = new Set(ohneSchonErschienene(offen, stream))
  const jeAnbieter = new Map<PlatformId, ReleaseEvent[]>()
  for (const e of offen.filter((x) => !neu.has(x)))
    jeAnbieter.set(e.platform, [...(jeAnbieter.get(e.platform) ?? []), e])
  return [...jeAnbieter.values()]
    .map(naechster)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_NACHLEGER)
}

/** Der früheste Tag eines Anbieters, samt allen Folgen, die an diesem Tag zusammen kommen. */
function naechster(termine: ReleaseEvent[]): Nachleger {
  const reihe = [...termine].sort((a, b) => a.date.localeCompare(b.date) || (a.episode ?? 0) - (b.episode ?? 0))
  const erster = reihe[0]!
  const amTag = reihe.filter((e) => e.date === erster.date).map((e) => e.episode!)
  return {
    platform: erster.platform,
    von: Math.min(...amTag),
    bis: Math.max(...amTag),
    date: erster.date,
    time: erster.time,
    geschaetzt: zeitGeschaetzt(erster),
  }
}

/** „Netflix: Folge 16 am Sa 17.10.“ — geschätzt: „Folge 16 ≈ Sa 17.10.“; die Uhrzeit nur, wo eine geführt wird. */
export function nachlegerText(n: Nachleger): string {
  const [, monat, tag] = n.date.split('-')
  const folge = n.bis > n.von ? `${n.von}–${n.bis}` : String(n.von)
  const wann = `${weekdayName(n.date, true)} ${tag}.${monat}.`
  const zeit = n.time ? ` um ${n.geschaetzt ? '≈ ' : ''}${n.time} Uhr` : ''
  return `${anbieterName(n.platform)}: Folge ${folge} ${n.geschaetzt ? '≈' : 'am'} ${wann}${zeit}`
}
