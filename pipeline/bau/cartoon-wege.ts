/**
 * Die Wege der Cartoons auf die Staffeln verteilen (11.10.2026, Teil 2 von 3). Regel und Begründung in `lib/cartoon-wege.ts`.
 * Nur Titel mit mindestens zwei belegten Staffeln: was auf der Prüfliste steht (`bau/cartoon-staffeln.ts`), behält den Weg ganz.
 */
import { log } from '../lib/util.ts'
import { jwTonAnbieter, plattformVon } from '../lib/cartoons.ts'
import { staffelBereiche, verteileWeg } from '../lib/cartoon-wege.ts'
import type { Staffel } from '../lib/jw-staffeln.ts'
import type { PlatformId, Title } from '../../shared/types.ts'

type Befund = { geprueftAm?: string; staffeln?: Staffel[] }

/**
 * Das Datum des Befunds, wenn JustWatch für diese Staffel deutschen Ton bei diesem Anbieter nennt. JustWatchs Staffelnummern
 * gelten nur, wo auch die Staffeln von JustWatch stammen (`staffelnQuelle`): bei TMDB-Staffeln wäre es dieselbe Verwechslung
 * wie bei den Mehrteilern (95,5 %, `lib/jw-vertrauen.ts`).
 */
function jwStandJeStaffel(t: Title, befund: Befund | undefined, platform: PlatformId): (nr: number) => string | undefined {
  if (t.staffelnQuelle !== 'justwatch' || !befund?.geprueftAm) return () => undefined
  return (nr) => {
    return jwTonAnbieter(befund.staffeln?.find((s) => s.nr === nr)?.angebote).some((name) => plattformVon(name) === platform) ? befund.geprueftAm : undefined
  }
}

export function verteileWege(titel: Title[], jw: Record<string, Befund>, ungeprueft: Set<number>): void {
  let titelAnzahl = 0
  let wege = 0
  for (const t of titel) {
    if (!t.staffeln || t.staffeln.length < 2 || ungeprueft.has(t.id)) continue
    const bereiche = staffelBereiche(t.staffeln)
    const vorher = t.streams.length
    t.streams = t.streams.flatMap((s) => {
      const teile = verteileWeg(s, bereiche, jwStandJeStaffel(t, jw[String(t.id)], s.platform))
      if (teile.length > 1) wege++
      return teile
    })
    if (t.streams.length !== vorher) titelAnzahl++
  }
  log(`Cartoon-Wege: ${wege} Wege von ${titelAnzahl} Titeln auf Staffeln verteilt`)
}
