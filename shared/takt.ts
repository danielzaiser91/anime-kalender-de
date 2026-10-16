/**
 * **Wo der Wochentakt nicht trägt — gemessen an belegten Folgen-Tagen** (16.10.2026, Re:ZERO Staffel 4).
 *
 * Grundlage ist allein `schedule.observed` (Folge → Tag, von einem Anbieter gesehen), nie eine Fortschreibung.
 * Ein Tag weicht ab, wenn zwischen ihm und dem vorigen Folgen-Tag keine sieben Tage liegen (mit Sendepausen aus
 * `skipDates` herausgerechnet) oder mehrere Folgen auf einmal kamen. Der Starttag ist keine Abweichung.
 * „Schon da“ (Folgetag) gilt nur außerhalb des Sendetags der Serie, sonst ist ein kurzer Abstand bloß der gewohnte Tag.
 * Meldung (`pipeline/lib/news-takt.ts`) und Detail-Panel („Takt unklar") lesen dieselbe Rechnung.
 */
import { diffDays } from './time.ts'
import type { Release } from './types.ts'

export type TaktArt = 'pause' | 'doppelt' | 'folgetag'

/** Ab so vielen Tagen Abstand (ohne Sendepausen) gilt es als Pause. */
export const PAUSE_AB_TAGEN = 21
/** Bis so viele Tage nach dem vorigen Folgen-Tag ist es „schon da", nicht mehr der Wochentakt. */
export const FOLGETAG_BIS_TAGEN = 5
/** Der Wochentakt erlaubt einen Tag Spielraum (Uhrzeit um Mitternacht, Zeitumstellung). */
const TAKT_VON = 6
const TAKT_BIS = 8
/** So viele jüngste Folgen-Tage entscheiden, ob der Takt noch trägt. */
const LETZTE_TAGE = 3

export interface TaktTag {
  tag: string
  /** Erste und letzte Folge dieses Tages. */
  von: number
  bis: number
  anzahl: number
  /** Letzte Folge des vorigen Folgen-Tages. */
  vorFolge: number
  /** Tage seit dem vorigen Folgen-Tag, Sendepausen (`skipDates`) abgezogen. */
  abstand: number
  /** Weicht vom Wochentakt ab (auch wenn es keine Meldung wert ist). */
  abweichend: boolean
  /** Meldungsart; fehlt bei Abweichungen ohne klare Aussage (neun bis dreizehn Tage). */
  art?: TaktArt
}

function artVon(abstand: number, anzahl: number, abwStammtag: boolean): TaktArt | undefined {
  if (abstand >= PAUSE_AB_TAGEN) return 'pause'
  if (anzahl >= 2) return 'doppelt'
  return abstand <= FOLGETAG_BIS_TAGEN && abwStammtag ? 'folgetag' : undefined
}

const wochentag = (tag: string): number => new Date(`${tag}T12:00:00Z`).getUTCDay()

/**
 * Der Sendetag der Serie: der Wochentag, an dem mehr Folgen-Tage lagen als an jedem anderen.
 * Ohne ihn sagt ein kurzer Abstand nichts — nach einer späten Doppelfolge am Freitag ist der Mittwoch danach
 * der gewohnte Tag und nicht „schon da“.
 */
function stammtag(tage: string[]): number | undefined {
  const jeTag = new Map<number, number>()
  for (const t of tage) jeTag.set(wochentag(t), (jeTag.get(wochentag(t)) ?? 0) + 1)
  const [erster, zweiter] = [...jeTag.entries()].sort((a, b) => b[1] - a[1])
  return erster && erster[1] > (zweiter?.[1] ?? 0) ? erster[0] : undefined
}

/** Folgen je Tag aufsteigend; Folgen ohne Tag und ohne Nummer fallen heraus. */
function folgenJeTag(observed: Record<string, string> | undefined): { tag: string; nummern: number[] }[] {
  const jeTag = new Map<string, number[]>()
  for (const [nr, tag] of Object.entries(observed ?? {})) {
    const n = Number(nr)
    if (!tag || !(n >= 1)) continue
    jeTag.set(tag, [...(jeTag.get(tag) ?? []), n])
  }
  return [...jeTag.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, nummern]) => ({ tag, nummern: nummern.sort((a, b) => a - b) }))
}

/** Sendepausen, die zwischen zwei Tagen liegen, in Tagen (je 7). */
function pausenTage(skipDates: string[] | undefined, von: string, bis: string): number {
  return (skipDates ?? []).filter((d) => d > von && d < bis).length * 7
}

/**
 * Alle Folgen-Tage nach dem ersten, an die eine lückenlose Zählung anschließt (Folge N+1 nach Folge N).
 * Fehlt dazwischen eine Folge in den Beobachtungen, sagt der Tagesabstand nichts und der Tag bleibt draußen.
 */
export function taktTage(s: Pick<NonNullable<Release['schedule']>, 'observed' | 'skipDates'> | undefined): TaktTag[] {
  const tage = folgenJeTag(s?.observed)
  const raus: TaktTag[] = []
  for (let i = 1; i < tage.length; i++) {
    const davor = tage[i - 1]!
    const heute = tage[i]!
    const vorFolge = davor.nummern.at(-1)!
    if (heute.nummern[0] !== vorFolge + 1) continue
    const abstand = diffDays(davor.tag, heute.tag) - pausenTage(s?.skipDates, davor.tag, heute.tag)
    const anzahl = heute.nummern.length
    const stamm = stammtag(tage.slice(0, i + 1).map((t) => t.tag))
    raus.push({
      tag: heute.tag,
      von: heute.nummern[0]!,
      bis: heute.nummern.at(-1)!,
      anzahl,
      vorFolge,
      abstand,
      abweichend: anzahl >= 2 || abstand < TAKT_VON || abstand > TAKT_BIS,
      art: artVon(abstand, anzahl, stamm !== undefined && wochentag(heute.tag) !== stamm),
    })
  }
  return raus
}

/**
 * Trägt der Wochentakt nicht mehr? Ja, wenn einer der letzten drei Folgen-Tage abwich — dann ist jede
 * Fortschreibung „+7 Tage" eine Annahme ohne Rückhalt in den Beobachtungen.
 */
export function taktUnklar(s: Pick<NonNullable<Release['schedule']>, 'observed' | 'skipDates'> | undefined): boolean {
  return taktTage(s).slice(-LETZTE_TAGE).some((t) => t.abweichend)
}

